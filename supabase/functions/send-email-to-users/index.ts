import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/\s+on[a-z]+\s*=/gi, " data-blocked=")
    .replace(/javascript\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .replace(/data\s*:/gi, "")
    .trim();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ ok: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";

    if (!supabaseUrl || !serviceKey) return response({ ok: false, error: "Supabase server configuration is missing." }, 503);
    if (!resendKey) return response({ ok: false, error: "RESEND_API_KEY is not configured yet." }, 503);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return response({ ok: false, error: "Authentication required." }, 401);

    const db = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return response({ ok: false, error: "Invalid authentication." }, 401);

    const { data: admin, error: adminError } = await db
      .from("admins")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!admin) return response({ ok: false, error: "Admin access required." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    const query = String(body.query || "").trim().toLowerCase();

    if (action === "search_users") {
      if (!query || query.length < 2) return response({ ok: false, error: "Enter at least 2 characters to search." }, 422);
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
      return response({ ok: true, users: matches });
    }

    const subject = String(body.subject || "").trim();
    const html = cleanHtml(String(body.html || "").trim());
    const suppliedText = String(body.text || "").trim();
    const testEmail = String(body.testEmail || "").trim();
    const suppliedRecipients = Array.isArray(body.recipients) ? body.recipients : [];

    if (!subject || !html) return response({ ok: false, error: "Subject and HTML message are required." }, 422);
    if (subject.length > 200) return response({ ok: false, error: "Subject is too long." }, 422);
    if (html.length > 500000) return response({ ok: false, error: "Email body is too large." }, 422);
    if (testEmail && !validEmail(testEmail)) return response({ ok: false, error: "Invalid test email address." }, 422);
    if (suppliedRecipients.length > 100) return response({ ok: false, error: "You can select up to 100 recipients at once." }, 422);

    const recipients: string[] = [];
    if (testEmail) {
      recipients.push(testEmail);
    } else if (suppliedRecipients.length) {
      for (const value of suppliedRecipients) {
        const email = String(value || "").trim().toLowerCase();
        if (!validEmail(email)) return response({ ok: false, error: "One or more selected recipients are invalid." }, 422);
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
    if (!unique.length) return response({ ok: false, error: "No confirmed user email addresses found." }, 422);

    const textBody = suppliedText || stripHtmlToText(html);
    if (textBody.length > 500000) return response({ ok: false, error: "Plain text message is too large." }, 422);

    const chapterTemplateId = ["566311c5","dbe6-4341-b459-d1d4fdc4e032"].join("-");
    const useChapterReleaseTemplate = String(body.templateId || "").trim() === chapterTemplateId;

    const base = useChapterReleaseTemplate
      ? {
          from: "Atma Rekha <atmarekhaoffical@gmail.com>",
          template: { id: chapterTemplateId },
        }
      : {
          from: "Atma Rekha <atmarekhaoffical@gmail.com>",
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

    return response({
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
    return response({
      ok: false,
      error: error instanceof Error ? error.message : "Bulk email failed.",
    }, 500);
  }
});