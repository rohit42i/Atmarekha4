import "jsr:@supabase/functions-js/edge-runtime.d.ts";

async function readLimitedBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return '';
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) { try { await reader.cancel(); } catch {} return null; } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

import { createClient } from "npm:@supabase/supabase-js@2";
import sanitizeHtml from "npm:sanitize-html@2.17.0";

const ALLOWED_ORIGINS = new Set(["https://www.atmarekha.in", "https://atmarekha.in", "http://localhost:5173"]);
const corsFor = (req: Request) => {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
};
const response = (req: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsFor(req) });

function stripHtmlToText(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {}, disallowedTagsMode: "discard" })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \\t]+\\n/g, "\\n")
    .replace(/\\n{3,}/g, "\\n\\n")
    .trim();
}

function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "hr", "a", "span", "div", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }, true) },
    disallowedTagsMode: "discard",
  }).trim();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readSupabaseServiceRoleKey() {
  const configured = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  if (configured) {
    try {
      const parsed = JSON.parse(configured);
      if (parsed?.default) return String(parsed.default).trim();
    } catch (_) {}
  }
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsFor(req) });
  if (req.method !== "POST") return response(req, { ok: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = readSupabaseServiceRoleKey();
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    const configuredSender = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "Atma Rekha <no-reply@atmarekha.in>";

    if (!supabaseUrl || !serviceKey) return response(req, { ok: false, error: "Supabase server configuration is missing." }, 503);
    if (!resendKey) return response(req, { ok: false, error: "RESEND_API_KEY is not configured yet." }, 503);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return response(req, { ok: false, error: "Authentication required." }, 401);

    const db = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return response(req, { ok: false, error: "Invalid authentication." }, 401);

    const { data: admin, error: adminError } = await db
      .from("admins")
      .select("user_id,role")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!admin || !["owner", "admin"].includes(String(admin.role || "").trim().toLowerCase())) return response(req, { ok: false, error: "Admin access required." }, 403);

    const { data: rateAllowed, error: rateError } = await db.rpc("consume_rate_limit", { p_rate_key: `admin-bulk-email:${authData.user.id}`, p_limit: 5, p_window_seconds: 3600 });
    if (rateError) { console.error("Bulk email rate-limit check failed."); return response(req, { ok: false, error: "Email service is temporarily unavailable." }, 503); }
    if (rateAllowed === false) return response(req, { ok: false, error: "Email sending limit reached. Please try again later." }, 429);

    const rawBody = await readLimitedBody(req, 1024 * 1024);
    if (rawBody === null) return response(req, { ok: false, error: "Request body is too large." }, 413);
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return response(req, { ok: false, error: "Invalid JSON body." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return response(req, { ok: false, error: "Invalid request body." }, 400);
    const action = String(body.action || "").trim();
    const query = String(body.query || "").trim().toLowerCase();

    if (action === "search_users") {
      if (!query || query.length < 2) return response(req, { ok: false, error: "Enter at least 2 characters to search." }, 422);
      const matches: Array<{ email: string; name: string }> = [];
      let page = 1;
      while (page <= 20 && matches.length < 20) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        for (const user of data.users) {
          if (!user.email || !user.email_confirmed_at) continue;
          const name = String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
          const haystack = (user.email + " " + name).toLowerCase();
          if (haystack.includes(query)) {
            matches.push({ email: user.email, name });
            if (matches.length >= 20) break;
          }
        }
        if (!data.users.length || data.users.length < 1000) break;
        page++;
      }
      return response(req, { ok: true, users: matches });
    }

    if (action === "resend_email_change_confirmation") {
      const requestId = String(body.request_id || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
        return response(req, { ok: false, error: "A valid email-change request is required." }, 422);
      }

      const { data: request, error: requestError } = await db
        .from("email_change_requests")
        .select("id,user_id,current_email,requested_email,status,resend_count")
        .eq("id", requestId)
        .maybeSingle();
      if (requestError) return response(req, { ok: false, error: "Unable to load the email-change request." }, 503);
      if (!request || request.status !== "pending" || !request.user_id) {
        return response(req, { ok: false, error: "This request is no longer pending. Refresh the request list." }, 409);
      }

      const { data: targetResult, error: targetError } = await db.auth.admin.getUserById(request.user_id);
      const target = targetResult?.user;
      if (targetError || !target) return response(req, { ok: false, error: "The account is no longer available." }, 404);
      const currentEmail = String(target.email || "").trim();
      const requestedEmail = String(target.new_email || "").trim();
      if (
        !validEmail(currentEmail) ||
        !validEmail(requestedEmail) ||
        currentEmail.toLowerCase() !== String(request.current_email || "").trim().toLowerCase() ||
        requestedEmail.toLowerCase() !== String(request.requested_email || "").trim().toLowerCase()
      ) {
        return response(req, { ok: false, error: "The verification state changed. Refresh the request list before retrying." }, 409);
      }

      const redirectTo = "https://www.atmarekha.in/";
      const [currentLinkResult, newLinkResult] = await Promise.all([
        db.auth.admin.generateLink({
          type: "email_change_current",
          email: currentEmail,
          newEmail: requestedEmail,
          options: { redirectTo },
        }),
        db.auth.admin.generateLink({
          type: "email_change_new",
          email: currentEmail,
          newEmail: requestedEmail,
          options: { redirectTo },
        }),
      ]);
      const currentLink = currentLinkResult.data?.properties?.action_link;
      const newLink = newLinkResult.data?.properties?.action_link;
      const authOrigin = new URL(supabaseUrl).origin;
      const validActionLink = (value: unknown) => {
        if (typeof value !== "string") return false;
        try {
          const link = new URL(value);
          return link.protocol === "https:" && link.origin === authOrigin;
        } catch {
          return false;
        }
      };
      if (
        currentLinkResult.error || newLinkResult.error ||
        !validActionLink(currentLink) || !validActionLink(newLink)
      ) {
        return response(req, {
          ok: false,
          error: "Secure verification links could not be generated. Check the Supabase Secure email change setting; no emails were sent.",
        }, 503);
      }

      const now = new Date().toISOString();
      const { data: event, error: eventError } = await db
        .from("email_change_request_events")
        .insert({
          request_id: request.id,
          user_id: target.id,
          actor_user_id: authData.user.id,
          event_type: "verification_resent",
          details: { attempt_started_at: now },
        })
        .select("id")
        .single();
      if (eventError || !event) {
        return response(req, { ok: false, error: "The request history could not be recorded. No emails were sent." }, 503);
      }

      const { data: activeRequest, error: activeRequestError } = await db
        .from("email_change_requests")
        .update({
          last_admin_resend_at: now,
          last_admin_resend_by: authData.user.id,
          resend_count: Number(request.resend_count || 0) + 1,
        })
        .eq("id", request.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (activeRequestError || !activeRequest) {
        await db.from("email_change_request_events").update({
          details: { attempt_started_at: now, outcome: "not_sent_request_state_changed" },
        }).eq("id", event.id);
        return response(req, { ok: false, error: "This request changed before it could be sent. Refresh the list." }, 409);
      }

      const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[char] || char));
      const makeHtml = (heading: string, copy: string, link: string) =>
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body style="margin:0;background:#f4f4f2;color:#191919;font-family:Arial,Helvetica,sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px 16px">' +
        '<div style="background:#fff;border:1px solid #e1e1de;padding:32px 28px">' +
        '<p style="margin:0 0 22px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#555">ATMA REKHA</p>' +
        '<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;font-weight:700">' + escapeHtml(heading) + '</h1>' +
        '<p style="font-size:15px;line-height:1.7;color:#383838">' + escapeHtml(copy) + '</p>' +
        '<p style="font-size:14px;line-height:1.8;color:#383838">Current address: <strong>' + escapeHtml(currentEmail) + '</strong><br>Requested address: <strong>' + escapeHtml(requestedEmail) + '</strong></p>' +
        '<p style="margin:28px 0"><a href="' + escapeHtml(link) + '" style="display:inline-block;padding:13px 18px;background:#171717;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Confirm email change</a></p>' +
        '<p style="font-size:12px;line-height:1.7;color:#6b6b6b">This verification link expires according to your account security settings. If you did not request this change, do not use the link and secure your account.</p>' +
        '</div><p style="font-size:11px;color:#777;text-align:center">Atma Rekha · Original Indian fantasy adventure manga</p></div></body></html>';

      const sendVerification = async (to: string, heading: string, copy: string, link: string) => {
        try {
          const result = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: configuredSender,
              to: [to],
              subject: "Confirm your Atma Rekha email change",
              html: makeHtml(heading, copy, link),
              text: heading + "\n\n" + copy + "\nCurrent address: " + currentEmail +
                "\nRequested address: " + requestedEmail + "\n\nConfirm securely: " + link +
                "\n\nIf you did not request this, do not use the link.",
            }),
          });
          return { ok: result.ok, status: result.status };
        } catch {
          return { ok: false, status: 0 };
        }
      };

      const [currentDelivery, newDelivery] = await Promise.all([
        sendVerification(
          currentEmail,
          "Approve this email change",
          "A request was made to change the sign-in email on your Atma Rekha account. Confirm this request only if you initiated it.",
          currentLink,
        ),
        sendVerification(
          requestedEmail,
          "Verify your new email address",
          "Confirm that you can receive email at this address to complete the sign-in email change on your Atma Rekha account.",
          newLink,
        ),
      ]);
      const deliveryDetails = {
        current_address: { sent: currentDelivery.ok, status_code: currentDelivery.status },
        requested_address: { sent: newDelivery.ok, status_code: newDelivery.status },
        completed_at: new Date().toISOString(),
      };
      const { error: eventUpdateError } = await db
        .from("email_change_request_events")
        .update({ details: { attempt_started_at: now, delivery: deliveryDetails } })
        .eq("id", event.id);
      if (eventUpdateError) console.error("Email-change delivery history update failed.");

      const { error: auditError } = await db.from("admin_activity_log").insert({
        admin_user_id: authData.user.id,
        action: "resend_email_change_confirmation",
        entity_type: "email_change_request",
        entity_id: request.id,
        details: {
          user_id: target.id,
          current_address_sent: currentDelivery.ok,
          requested_address_sent: newDelivery.ok,
        },
      });
      if (auditError) console.error("Email-change admin audit event failed.");

      const sent = currentDelivery.ok || newDelivery.ok;
      return response(req, {
        ok: sent,
        sent_to_current: currentDelivery.ok,
        sent_to_new: newDelivery.ok,
        partial_delivery: currentDelivery.ok !== newDelivery.ok,
        ...(!sent ? { error: "Resend could not deliver either verification email. Check delivery logs and try again." } : {}),
        ...(eventUpdateError || auditError ? { audit_warning: "Email delivery was attempted, but one history record could not be updated. Check admin activity and Resend logs." } : {}),
      }, sent ? 200 : 502);
    }

    const subject = String(body.subject || "").trim();
    const html = cleanHtml(String(body.html || "").trim());
    const suppliedText = String(body.text || "").trim();
    const testEmail = String(body.testEmail || "").trim();
    const suppliedRecipients = Array.isArray(body.recipients) ? body.recipients : [];

    if (!subject || !html) return response(req, { ok: false, error: "Subject and HTML message are required." }, 422);
    if (subject.length > 200) return response(req, { ok: false, error: "Subject is too long." }, 422);
    if (html.length > 500000) return response(req, { ok: false, error: "Email body is too large." }, 422);
    if (testEmail && !validEmail(testEmail)) return response(req, { ok: false, error: "Invalid test email address." }, 422);
    if (suppliedRecipients.length > 100) return response(req, { ok: false, error: "You can select up to 100 recipients at once." }, 422);

    const recipients: string[] = [];
    if (testEmail) {
      recipients.push(testEmail);
    } else if (suppliedRecipients.length) {
      for (const value of suppliedRecipients) {
        const email = String(value || "").trim().toLowerCase();
        if (!validEmail(email)) return response(req, { ok: false, error: "One or more selected recipients are invalid." }, 422);
        recipients.push(email);
      }
    } else {
      let page = 1;
      while (page <= 20) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        for (const user of data.users) {
          if (user.email && user.email_confirmed_at) recipients.push(user.email);
        }
        if (!data.users.length || data.users.length < 1000) break;
        page++;
      }
    }

    const unique = [...new Set(recipients.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    if (!unique.length) return response(req, { ok: false, error: "No confirmed user email addresses found." }, 422);

    const textBody = suppliedText || stripHtmlToText(html);
    if (textBody.length > 500000) return response(req, { ok: false, error: "Plain text message is too large." }, 422);

    const chapterTemplateId = ["566311c5","dbe6-4341-b459-d1d4fdc4e032"].join("-");
    const useChapterReleaseTemplate = String(body.templateId || "").trim() === chapterTemplateId;

    const base = useChapterReleaseTemplate
      ? {
          from: configuredSender,
          template: { id: chapterTemplateId },
        }
      : {
          from: configuredSender,
          subject,
          html,
          text: textBody,
        };

    let sent = 0;
    let failed = 0;
    const failures: string[] = [];

    async function sendOne(to: string) {
      return fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + resendKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...base, to: [to] }),
      });
    }

    if (testEmail) {
      const result = await sendOne(unique[0]);
      if (result.ok) sent = 1;
      else {
        failed = 1;
        failures.push((await result.text().catch(() => "")).slice(0, 300));
      }
    } else {
      for (let i = 0; i < unique.length; i += 100) {
        const chunk = unique.slice(i, i + 100);
        const result = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + resendKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk.map((to) => ({ ...base, to: [to] }))),
        });

        if (result.ok) {
          sent += chunk.length;
          continue;
        }

        for (const email of chunk) {
          const single = await sendOne(email);
          if (single.ok) sent++;
          else {
            failed++;
            if (failures.length < 10) {
              failures.push(email + ": " + (await single.text().catch(() => "")).slice(0, 220));
            }
          }
        }
      }
    }

    const { error: auditError } = await db.from("admin_activity_log").insert({ admin_user_id: authData.user.id, action: "send_bulk_email", entity_type: "email_campaign", entity_id: null, details: { mode: testEmail ? "test" : suppliedRecipients.length ? "selected" : "all_users", total: unique.length, sent, failed, subject: subject.slice(0, 200) } });
    if (auditError) console.error("Bulk email audit event could not be recorded:", auditError.message);

    return response(req, {
      ok: sent > 0,
      mode: testEmail ? "test" : suppliedRecipients.length ? "selected" : "all_users",
      total: unique.length,
      sent,
      failed,
      failures,
      textFallback: true,
    }, sent > 0 ? 200 : 502);
  } catch (error) {
    console.error("Bulk email failed:", error);
    return response(req, {
      ok: false,
      error: "Bulk email operation failed. Please try again.",
    }, 500);
  }
});