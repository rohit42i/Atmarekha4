import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = "https://www.atmarekha.in";
const ALLOWED_ORIGINS = new Set([
  "https://www.atmarekha.in",
  "https://atmarekha.in",
  "https://feature-resend-email-studio-atmarekha4.rohitbaswaraj.workers.dev"
]);
const responseHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Vary": "Origin"
});
const reply = (body: Record<string, unknown>, status = 200, origin = SITE_URL) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]!));
const render = (source: string, vars: Record<string, string>) =>
  source.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => vars[key] ?? "");

function emailLayout(source: string, previewText: string) {
  const bodyMatch = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : source;
  content = content.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<html\b[^>]*>|<\/html>/gi, "");
  const preheader = escapeHtml(previewText).slice(0, 180);
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>ATMA REKHA</title></head>' +
    '<body style="margin:0;padding:0;width:100%;background-color:#ffffff;font-family:Roboto,Arial,Helvetica,sans-serif;font-weight:500;font-size:16px;line-height:1.6;color:#222222;">' +
    '<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">' + preheader + '</div>' +
    '<div style="width:100%;margin:0;padding:0;background-color:#ffffff;font-family:Roboto,Arial,Helvetica,sans-serif;font-weight:500;font-size:16px;line-height:1.6;color:#222222;">' +
    content +
    '</div></body></html>';
}

async function limitedBody(req: Request, limit: number) {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > limit) return null;
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      try { await reader.cancel(); } catch { /* Ignore stream cancellation errors. */ }
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

async function loadAllAuthUsers(db: any) {
  const users: any[] = [];
  const pageSize = 1000;
  const maxPages = 20;
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < pageSize) return users;
  }
  const { data, error } = await db.auth.admin.listUsers({ page: maxPages + 1, perPage: 1 });
  if (error) throw error;
  if ((data?.users || []).length) {
    throw new Error("The recipient directory exceeds the 20,000-account safety limit.");
  }
  return users;
}

async function loadRowsForIds(db: any, table: string, columns: string, ids: string[], key = "user_id") {
  const result: any[] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const { data, error } = await db.from(table).select(columns).in(key, ids.slice(offset, offset + 500));
    if (error) throw error;
    result.push(...(data || []));
  }
  return result;
}

async function loadActiveSubscriptions(db: any) {
  const rows: any[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data, error } = await db.from("user_subscriptions")
      .select("user_id,status,current_period_end")
      .in("status", ["active", "trialing"])
      .range(offset, offset + 999);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
  throw new Error("The active membership query exceeded the safety limit.");
}

async function loadRecipientDirectory(db: any) {
  const accounts = await loadAllAuthUsers(db);
  const confirmed = accounts.filter((account: any) => Boolean(account.email && account.email_confirmed_at));
  const ids = confirmed.map((account: any) => account.id);
  const [profiles, preferences, consentRows, subscriptions] = await Promise.all([
    loadRowsForIds(db, "profiles", "id,username,display_name", ids, "id"),
    loadRowsForIds(db, "email_marketing_preferences", "user_id,marketing_unsubscribed", ids, "user_id"),
    loadRowsForIds(db, "dpdp_consent_records", "user_id,purposes,withdrawn_at", ids, "user_id"),
    loadActiveSubscriptions(db)
  ]);
  const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const optedOut = new Set((preferences || []).filter((item: any) => item.marketing_unsubscribed).map((item: any) => item.user_id));
  const marketingConsented = new Set((consentRows || []).filter((item: any) => !item.withdrawn_at && Array.isArray(item.purposes) && item.purposes.includes("marketing_promotion")).map((item: any) => item.user_id));
  const updatesConsented = new Set((consentRows || []).filter((item: any) => !item.withdrawn_at && Array.isArray(item.purposes) && (item.purposes.includes("atma_rekha_updates") || item.purposes.includes("chapter_announcements") || item.purposes.includes("marketing_email"))).map((item: any) => item.user_id));
  const now = Date.now();
  const activeMemberIds = new Set((subscriptions || [])
    .filter((item: any) => !item.current_period_end || new Date(item.current_period_end).getTime() >= now)
    .map((item: any) => item.user_id));

  const users = confirmed.map((account: any) => {
    const profile: any = profileMap.get(account.id) || {};
    return {
      id: account.id,
      email: String(account.email),
      username: profile.username || "",
      display_name: profile.display_name || "",
      created_at: account.created_at,
      membership_active: activeMemberIds.has(account.id),
      marketing_opted_out: optedOut.has(account.id),
      marketing_consented: marketingConsented.has(account.id),
      updates_consented: updatesConsented.has(account.id)
    };
  });
  const cutoff = now - 30 * 86400000;
  const audiences = {
    all: users,
    members: users.filter((user: any) => user.membership_active),
    free: users.filter((user: any) => !user.membership_active),
    recent: users.filter((user: any) => new Date(user.created_at).getTime() >= cutoff)
  };
  const counts: Record<string, number> = {};
  for (const [name, members] of Object.entries(audiences)) {
    counts[name] = members.length;
    counts[name + "Marketing"] = members.filter((user: any) => user.marketing_consented && !user.marketing_opted_out).length;
    counts[name + "Updates"] = members.filter((user: any) => user.updates_consented && !user.marketing_opted_out).length;
  }
  return { users, counts };
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function checkedChapterUrl(value: unknown) {
  const raw = cleanText(value, 2048);
  if (!raw) return null;
  try {
    const parsed = new URL(raw, SITE_URL);
    if (parsed.protocol !== "https:" || !["www.atmarekha.in", "atmarekha.in"].includes(parsed.hostname) || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
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

Deno.serve(async req => {
  const origin = req.headers.get("Origin") || SITE_URL;
  const respond = (body: Record<string, unknown>, status = 200) => reply(body, status, origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
  if (req.method !== "POST") return respond({ ok: false, error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = readSupabaseServiceRoleKey();
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const configuredSender = Deno.env.get("RESEND_FROM_EMAIL") || "Atma Rekha <no-reply@atmarekha.in>";
  if (!url || !serviceKey) return respond({ ok: false, error: "Supabase service configuration is missing." }, 503);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return respond({ ok: false, error: "Authentication required." }, 401);
    const db = createClient(url, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return respond({ ok: false, error: "Invalid session." }, 401);
    const { data: admin, error: adminError } = await db.from("admins").select("user_id,role").eq("user_id", user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin || !["owner", "admin"].includes(String(admin.role || "").trim().toLowerCase())) {
      return respond({ ok: false, error: "Admin access required." }, 403);
    }

    const raw = await limitedBody(req, 128 * 1024);
    if (raw === null) return respond({ ok: false, error: "Request body too large." }, 413);
    let input: any;
    try { input = JSON.parse(raw || "{}"); } catch { return respond({ ok: false, error: "Invalid JSON request." }, 400); }
    const action = String(input.action || "send");
    if (!["save-template", "list-recipients", "send"].includes(action)) {
      return respond({ ok: false, error: "Unsupported Email Studio action." }, 400);
    }

    if (action === "save-template") {
      const row = {
        slug: cleanText(input.slug, 80).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"),
        name: cleanText(input.name, 100),
        category: input.category === "marketing" ? "marketing" : input.category === "updates" ? "updates" : "transactional",
        subject: cleanText(input.subject, 200),
        html_body: String(input.html_body || "").slice(0, 50000),
        text_body: String(input.text_body || "").slice(0, 20000),
        active: true,
        updated_at: new Date().toISOString()
      };
      if (!row.slug || !row.name || !row.subject || !row.html_body.trim()) {
        return respond({ ok: false, error: "Template name, slug, subject and HTML body are required." }, 422);
      }
      const { data, error } = await db.from("email_templates").upsert(row, { onConflict: "slug" })
        .select("id,slug,name,category,subject,html_body,text_body,active,updated_at").single();
      if (error) throw error;
      return respond({ ok: true, template: data });
    }

    if (action === "list-recipients") {
      const directory = await loadRecipientDirectory(db);
      return respond({ ok: true, users: directory.users, counts: directory.counts });
    }

    const templateId = cleanText(input.templateId, 80);
    let template: any = null;
    if (templateId) {
      const { data, error } = await db.from("email_templates")
        .select("id,slug,category,subject,html_body,text_body,active")
        .eq("id", templateId).maybeSingle();
      if (error) throw error;
      template = data;
      if (!template) return respond({ ok: false, error: "The selected template no longer exists. Refresh Email Studio." }, 422);
      if (template.active === false) return respond({ ok: false, error: "This template is inactive. Activate or choose another template." }, 422);
    }

    const templateSlug = String(template?.slug || input.templateSlug || "");
    const requestedCategory = input.category === "marketing" || input.category === "transactional" || input.category === "updates"
      ? input.category : template?.category || "transactional";
    // New chapter announcements are reader updates: never allow a client
    // or misconfigured template to bypass saved preferences and unsubscribe checks.
    const category = templateSlug === "new-chapter" ? "updates" : requestedCategory;
    // Chapter-release emails always use the short brand-only subject.
    const subjectSource = cleanText(input.subject || template?.subject, 200);
    const htmlSource = String(input.html_body || template?.html_body || "").slice(0, 50000);
    const textSource = String(input.text_body || template?.text_body || "").slice(0, 20000);
    if (!subjectSource || (!htmlSource.trim() && !textSource.trim())) {
      return respond({ ok: false, error: "Select a template or provide a subject and email content." }, 422);
    }

    const variables = input.variables && typeof input.variables === "object" && !Array.isArray(input.variables)
      ? input.variables : {};
    if (templateSlug !== "new-chapter" && /\bchapter\s*\d+/i.test(cleanText(input.subject, 200))) {
      return respond({ ok: false, error: "Chapter announcement blocked: select the New chapter announcement template so the email body matches the chapter details." }, 422);
    }
    let chapterNumber = "";
    let chapterTitle = "";
    let chapterDescription = "";
    let chapterUrl = "";
    if (templateSlug === "new-chapter") {
      chapterNumber = cleanText(variables.chapter_number, 20);
      chapterTitle = cleanText(variables.chapter_title, 180);
      chapterDescription = cleanText(variables.chapter_description, 2000);
      chapterUrl = checkedChapterUrl(variables.chapter_url) || "";
      if (!chapterNumber || !chapterTitle || !chapterUrl) {
        return respond({ ok: false, error: "For a new-chapter email, provide the chapter number, title and a valid HTTPS reading link on atmarekha.in." }, 422);
      }
    }

    const audience = input.audience && typeof input.audience === "object" ? input.audience : { type: "selected", userIds: [] };
    const audienceType = String(audience.type || "selected");
    if (!["selected", "all", "members", "free", "recent"].includes(audienceType)) {
      return respond({ ok: false, error: "Choose a valid recipient audience." }, 422);
    }

    const directory = await loadRecipientDirectory(db);
    const byId = new Map(directory.users.map((recipient: any) => [recipient.id, recipient]));
    let candidates: any[] = [];
    if (audienceType === "selected") {
      const requestedIds = [...new Set((Array.isArray(audience.userIds) ? audience.userIds : [])
        .map((value: unknown) => String(value))
        .filter((value: string) => /^[0-9a-f-]{36}$/i.test(value)))];
      if (!requestedIds.length) return respond({ ok: false, error: "Select at least one reader." }, 422);
      candidates = requestedIds.map(id => byId.get(id)).filter(Boolean);
    } else if (audienceType === "all") {
      candidates = directory.users;
    } else if (audienceType === "members") {
      candidates = directory.users.filter((recipient: any) => recipient.membership_active);
    } else if (audienceType === "free") {
      candidates = directory.users.filter((recipient: any) => !recipient.membership_active);
    } else {
      const cutoff = Date.now() - 30 * 86400000;
      candidates = directory.users.filter((recipient: any) => new Date(recipient.created_at).getTime() >= cutoff);
    }
    if (!candidates.length) return respond({ ok: false, error: "No eligible confirmed email accounts were found." }, 422);

    let skippedOptOuts = category === "marketing"
      ? candidates.filter((recipient: any) => !recipient.marketing_consented || recipient.marketing_opted_out).length
      : category === "updates" ? candidates.filter((recipient: any) => !recipient.updates_consented || recipient.marketing_opted_out).length : 0;
    const recipients = category === "marketing"
      ? candidates.filter((recipient: any) => recipient.marketing_consented && !recipient.marketing_opted_out)
      : category === "updates" ? candidates.filter((recipient: any) => recipient.updates_consented && !recipient.marketing_opted_out) : candidates;
    if (!recipients.length) return respond({ ok: false, error: category === "marketing" ? "No recipients have marketing consent, or all have opted out." : category === "updates" ? "No readers have Atma Rekha updates enabled, or all have unsubscribed." : "No eligible recipients were found." }, 422);
    if (!resendKey) return respond({ ok: false, error: "Email sending is not configured: add RESEND_API_KEY in Supabase Edge Function secrets." }, 503);
    if (!configuredSender.includes("@") || !configuredSender.includes("<") || !configuredSender.includes(">")) return respond({ ok: false, error: "RESEND_FROM_EMAIL must be a valid sender such as Atma Rekha <no-reply@atmarekha.in>." }, 503);

    const selectedIds = recipients.map((recipient: any) => recipient.id);
    const profileMap = new Map(recipients.map((recipient: any) => [recipient.id, recipient]));
    const { data: campaign, error: campaignError } = await db.from("email_campaigns").insert({
      created_by: user.id,
      template_id: template?.id || null,
      subject: subjectSource,
      audience: { type: audienceType, requested_count: candidates.length, eligible_count: recipients.length, category, skipped_opt_outs: skippedOptOuts },
      status: "sending",
      total_count: recipients.length
    }).select("id").single();
    if (campaignError) throw campaignError;

    let sent = 0;
    let failed = 0;
    const resendIds: string[] = [];
    const errors: string[] = [];
    const sender = configuredSender;

    for (let offset = 0; offset < selectedIds.length; offset += 10) {
      const batch = selectedIds.slice(offset, offset + 10);
      const results = await Promise.all(batch.map(async id => {
        try {
          const recipient: any = profileMap.get(id);
          const email = String(recipient?.email || "").trim();
          if (!email) return { ok: false, error: "Missing email" };

          let unsubscribeUrl = "";
          if (category === "marketing" || category === "updates") {
            let { data: preference, error: preferenceError } = await db.from("email_marketing_preferences")
              .select("unsubscribe_token,marketing_unsubscribed").eq("user_id", id).maybeSingle();
            if (preferenceError) throw preferenceError;
            if (preference?.marketing_unsubscribed) return { ok: false, skipped: true, error: category === "updates" ? "Atma Rekha updates unsubscribed" : "Marketing opt-out" };
            if (!preference) {
              const inserted = await db.from("email_marketing_preferences")
                .insert({ user_id: id }).select("unsubscribe_token,marketing_unsubscribed").single();
              if (inserted.error) {
                const retry = await db.from("email_marketing_preferences")
                  .select("unsubscribe_token,marketing_unsubscribed").eq("user_id", id).maybeSingle();
                if (retry.error || !retry.data) throw inserted.error;
                preference = retry.data;
              } else preference = inserted.data;
            }
            if (preference?.marketing_unsubscribed) return { ok: false, skipped: true, error: category === "updates" ? "Atma Rekha updates unsubscribed" : "Marketing opt-out" };
            unsubscribeUrl = url.replace(/\/$/, "") + "/functions/v1/email-unsubscribe?token=" + preference.unsubscribe_token;
          }

          const plainVars: Record<string, string> = {
            name: String(recipient?.display_name || recipient?.username || "Reader"),
            email,
            site_url: SITE_URL,
            action_url: chapterUrl || SITE_URL,
            chapter_number: chapterNumber,
            chapter_title: chapterTitle,
            chapter_description: chapterDescription,
            chapter_url: chapterUrl || SITE_URL,
            announcement_title: cleanText(variables.announcement_title || "Atma Rekha update", 180),
            announcement_body: cleanText(variables.announcement_body, 2000),
            expiry_date: cleanText(variables.expiry_date, 100),
            amount: cleanText(variables.amount, 80),
            payment_reference: cleanText(variables.payment_reference, 160),
            maintenance_message: cleanText(variables.maintenance_message, 1500),
            support_message: cleanText(variables.support_message, 1500),
            unsubscribe_url: unsubscribeUrl
          };
          const htmlVars = Object.fromEntries(Object.entries(plainVars).map(([key, value]) => [key, escapeHtml(value)])) as Record<string, string>;
          const subject = render(subjectSource, plainVars).replace(/[\r\n]+/g, " ").slice(0, 200);
          const htmlBody = htmlSource ? render(htmlSource, htmlVars).replace(/<p\b[^>]*>\s*<\/p>/gi, "") : undefined;
          const plainBody = textSource ? render(textSource, plainVars) : "";
          const bodyWithFooter = category === "marketing" || category === "updates"
            ? (htmlBody || "") + '<p style="margin-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#777">Atma Rekha updates · <a href="' + escapeHtml(unsubscribeUrl) + '" style="color:#555;text-decoration:underline">Unsubscribe</a></p>'
            : (htmlBody || "");
          const htmlWithFooter = bodyWithFooter ? emailLayout(bodyWithFooter, subject) : undefined;
          const text = plainBody + (category === "marketing" || category === "updates" ? "\n\nUnsubscribe from Atma Rekha emails: " + unsubscribeUrl : "");
          const message = {
            from: sender,
            reply_to: ["atmarekhasupport@gmail.com"],
            to: [email],
            subject,
            html: htmlWithFooter || undefined,
            text: text || undefined,
            tags: [
              { name: "campaign_id", value: campaign.id },
              { name: "template", value: templateSlug || "custom" },
              { name: "category", value: category }
            ]
          };
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
            body: JSON.stringify(message)
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) return { ok: false, error: String(data.message || data.name || response.status).slice(0, 180) };
          return { ok: true, id: data.id };
        } catch (error) {
          console.error("Email send failed for one recipient.", error);
          return { ok: false, error: "Unexpected recipient error" };
        }
      }));

      for (const result of results) {
        if (result.ok) {
          sent++;
          if (result.id) resendIds.push(result.id);
        } else if (result.skipped) {
          skippedOptOuts++;
        } else {
          failed++;
          if (errors.length < 5) errors.push(String(result.error || "Send failed"));
        }
      }
    }

    const status = sent === recipients.length ? "sent" : sent > 0 ? "partial" : "failed";
    const { error: updateError } = await db.from("email_campaigns").update({
      status,
      total_count: recipients.length,
      sent_count: sent,
      failed_count: failed,
      resend_ids: resendIds,
      error_summary: errors.join("; ") || null,
      completed_at: new Date().toISOString()
    }).eq("id", campaign.id);
    if (updateError) console.error("Could not finalize email campaign history.", updateError);
    const { error: activityError } = await db.from("admin_activity_log").insert({
      admin_user_id: user.id,
      action: "resend_email_campaign",
      entity_type: "email_campaign",
      entity_id: campaign.id,
      details: { subject: subjectSource, category, audience: audienceType, requested: candidates.length, total: recipients.length, sent, failed, skippedOptOuts, template: templateSlug || "custom" }
    });
    if (activityError) console.error("Could not write email campaign activity.", activityError);

    return respond({
      ok: sent > 0,
      campaignId: campaign.id,
      requested: candidates.length,
      total: recipients.length,
      sent,
      failed,
      skippedOptOuts,
      status,
      errors
    });
  } catch (error) {
    console.error("Email Studio request failed.", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("20,000-account safety limit") || message.includes("exceeded the safety limit")) {
      return respond({ ok: false, error: message }, 422);
    }
    return respond({ ok: false, error: "Email operation failed. Check configuration and delivery logs." }, 500);
  }
});
