import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const escapeHtml = (value: string) => String(value).replace(/[&<>"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;"
}[char] || char));

const page = (title: string, message: string, status = 200, showConfirmation = false) => {
  const confirmation = showConfirmation
    ? '<form method="post" style="margin-top:24px"><input type="hidden" name="List-Unsubscribe" value="One-Click"><button type="submit" style="border:1px solid #f5f5f5;border-radius:4px;background:#f5f5f5;color:#101010;padding:12px 18px;font:inherit;cursor:pointer">Unsubscribe</button></form>'
    : "";
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      escapeHtml(title) + '</title></head><body style="margin:0;background:#101010;color:#f5f5f5;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><main style="max-width:520px;padding:32px"><h1>' +
      escapeHtml(title) + '</h1><p>' + escapeHtml(message) + '</p>' + confirmation +
      '<p><a style="color:#b6c7ff" href="https://www.atmarekha.in/">Return to Atma Rekha</a></p></main></body></html>',
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
};

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
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST", "Cache-Control": "no-store" } });
  }

  const requestUrl = new URL(req.url);
  const token = requestUrl.searchParams.get("token") || "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return page("Invalid link", "This unsubscribe link is invalid.", 400);
  }

  // Ordinary link scanners often prefetch GET links. A GET must not unsubscribe a reader.
  // RFC 8058 one-click requests use POST with List-Unsubscribe=One-Click.
  if (req.method === "GET") {
    return page("Unsubscribe from Atma Rekha updates", "Confirm below to stop chapter announcements and promotional emails. Essential account and security emails may still be sent.", 200, true);
  }

  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return page("Invalid request", "The unsubscribe request could not be verified.", 400);
  }
  let body = "";
  try { body = await req.text(); } catch { return page("Invalid request", "The unsubscribe request could not be read.", 400); }
  if (body.length > 1024) return page("Invalid request", "The unsubscribe request is too large.", 413);
  if (new URLSearchParams(body).get("List-Unsubscribe") !== "One-Click") {
    return page("Invalid request", "The unsubscribe request could not be verified.", 400);
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = readSupabaseServiceRoleKey();
  if (!url || !key) return page("Temporarily unavailable", "Please try again later.", 503);

  const db = createClient(url, key);
  const { data, error } = await db.from("email_marketing_preferences")
    .select("user_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (error || !data) return page("Link unavailable", "This unsubscribe link is invalid or expired.", 404);

  const { data: updated, error: updateError } = await db.from("email_marketing_preferences")
    .update({ marketing_unsubscribed: true, updated_at: new Date().toISOString() })
    .eq("user_id", data.user_id)
    .eq("unsubscribe_token", token)
    .select("user_id")
    .maybeSingle();
  if (updateError) return page("Unable to update preferences", "Please try again later.", 500);
  if (!updated) return page("Link unavailable", "This unsubscribe link is invalid or expired.", 404);

  const contactKey = Deno.env.get("RESEND_CONTACTS_API_KEY") || "";
  if (contactKey) {
    try {
      const { data: userData } = await db.auth.admin.getUserById(data.user_id);
      const email = String(userData?.user?.email || "").trim();
      if (email) {
        const sync = await fetch("https://api.resend.com/contacts/" + encodeURIComponent(email), {
          method: "PATCH",
          headers: { Authorization: "Bearer " + contactKey, "Content-Type": "application/json" },
          body: JSON.stringify({ unsubscribed: true })
        });
        if (!sync.ok && sync.status !== 404) console.error("Resend unsubscribe sync failed.", sync.status);
      }
    } catch (error) {
      console.error("Resend unsubscribe sync failed.", error);
    }
  }

  return page("You’re unsubscribed", "You will no longer receive Atma Rekha chapter updates or promotional emails. Essential account and security emails may still be sent.");
});
