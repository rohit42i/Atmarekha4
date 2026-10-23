import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = "https://www.atmarekha.in";
const cors = (req: Request) => {
  const origin = req.headers.get("Origin") || SITE_URL;
  return {
    "Access-Control-Allow-Origin": [SITE_URL, "https://atmarekha.in"].includes(origin) ? origin : SITE_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
};
const reply = (req: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

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

/**
 * Compatibility endpoint for older signup/sign-in clients.
 *
 * Supabase is the source of truth for consent and unsubscribe state. Email Studio
 * queries those records and sends directly through Resend's send-only API key, so
 * synchronizing a duplicate provider contact is unnecessary and must not block sign-in.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, { ok: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = readSupabaseServiceRoleKey();
  if (!supabaseUrl || !serviceKey) {
    return reply(req, { ok: false, error: "Supabase server configuration is missing." }, 503);
  }

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return reply(req, { ok: false, error: "Authentication required." }, 401);

    const db = createClient(supabaseUrl, serviceKey);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    const userId = auth?.user?.id;
    if (authError || !userId) return reply(req, { ok: false, error: "Invalid session." }, 401);

    const [accountResult, consents, preference] = await Promise.all([
      db.auth.admin.getUserById(userId),
      db.from("dpdp_consent_records").select("purposes,withdrawn_at").eq("user_id", userId).order("consented_at", { ascending: false }).limit(20),
      db.from("email_marketing_preferences").select("marketing_unsubscribed").eq("user_id", userId).maybeSingle()
    ]);
    const account = accountResult.data?.user;
    if (accountResult.error || !account?.email) return reply(req, { ok: false, error: "Account not found." }, 404);
    if (consents.error || preference.error) return reply(req, { ok: false, error: "Could not verify email preferences." }, 503);

    const consented = (consents.data || []).some((row: any) =>
      !row.withdrawn_at && Array.isArray(row.purposes) &&
      (row.purposes.includes("atma_rekha_updates") ||
       row.purposes.includes("chapter_announcements") ||
       row.purposes.includes("marketing_email"))
    );
    const updatesSubscribed = Boolean(account.email_confirmed_at && consented && preference.data?.marketing_unsubscribed !== true);

    return reply(req, {
      ok: true,
      confirmed: Boolean(account.email_confirmed_at),
      updatesSubscribed,
      sourceOfTruth: "supabase",
      providerContactSync: false
    });
  } catch (error) {
    console.error("Email preference reconciliation failed.", error instanceof Error ? error.message : "unknown error");
    return reply(req, { ok: false, error: "Could not verify email preferences. Please retry." }, 500);
  }
});
