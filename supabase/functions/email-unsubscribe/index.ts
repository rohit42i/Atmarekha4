import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const page=(title:string,message:string,status=200)=>new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="margin:0;background:#101010;color:#f5f5f5;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><main style="max-width:520px;padding:32px"><h1>${title}</h1><p>${message}</p><a style="color:#b6c7ff" href="https://www.atmarekha.in">Return to Atma Rekha</a></main></body></html>`,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
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

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST", "Cache-Control": "no-store" } });
  }

  const parsedUrl = new URL(req.url);
  const token = parsedUrl.searchParams.get("token") || "";
  let oneClick = false;
  if (req.method === "POST") {
    let body = "";
    try { body = await req.text(); } catch { return new Response("Invalid unsubscribe request.", { status: 400 }); }
    const form = new URLSearchParams(body);
    if (form.get("List-Unsubscribe") !== "One-Click") {
      return new Response("Invalid unsubscribe request.", { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    oneClick = true;
  }

  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return oneClick ? new Response("Invalid unsubscribe token.", { status: 400 }) :
      page("Invalid link", "This unsubscribe link is invalid.", 400);
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = readSupabaseServiceRoleKey();
  if (!url || !key) {
    return oneClick ? new Response("Temporarily unavailable.", { status: 503 }) :
      page("Temporarily unavailable", "Please try again later.", 503);
  }

  const db = createClient(url, key);
  const { data, error } = await db.from("email_marketing_preferences")
    .select("user_id").eq("unsubscribe_token", token).maybeSingle();
  if (error || !data) {
    return oneClick ? new Response("Unsubscribe link unavailable.", { status: 404 }) :
      page("Link unavailable", "This unsubscribe link is invalid or expired.", 404);
  }

  const { error: updateError } = await db.from("email_marketing_preferences")
    .update({ marketing_unsubscribed: true, updated_at: new Date().toISOString() })
    .eq("user_id", data.user_id);
  if (updateError) {
    console.error("Could not persist email opt-out.", updateError.message);
    return oneClick ? new Response("Unable to update preferences.", { status: 503 }) :
      page("Unable to update preferences", "Please try again later.", 503);
  }

  // Opt-out is committed in Supabase. No Resend Contacts API or external key is
  // required; every future campaign checks this preference immediately.
  if (oneClick) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  return page("You’re unsubscribed", "You will no longer receive Atma Rekha chapter updates or promotional emails. Essential account and security emails may still be sent.");
});
