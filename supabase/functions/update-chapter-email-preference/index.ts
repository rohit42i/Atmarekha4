import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = "https://www.atmarekha.in";
const POLICY_VERSION = "2026-10-20-chapter-email-opt-in-v1";
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, { ok: false, error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = readSupabaseServiceRoleKey();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !serviceKey) return reply(req, { ok: false, error: "Consent service is not configured." }, 503);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(req, { ok: false, error: "Authentication required." }, 401);
  const db = createClient(url, serviceKey);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user || !user.email) return reply(req, { ok: false, error: "Valid account required." }, 401);
  try {
    const raw = await req.json();
    const action = String(raw?.action || "");
    if (action === "get") {
      const [consents, preference] = await Promise.all([
        db.from("dpdp_consent_records").select("purposes,withdrawn_at").eq("user_id", user.id),
        db.from("email_marketing_preferences").select("marketing_unsubscribed").eq("user_id", user.id).maybeSingle()
      ]);
      if (consents.error || preference.error) throw new Error("Could not load email preferences.");
      // A reader may have opted in at signup before this dedicated preference was added.
      // Recognize that explicit signup choice as well as the newer chapter-specific consent.
      const hasActiveEmailConsent = (consents.data || []).some((row: { purposes: string[] | null; withdrawn_at: string | null }) =>
        !row.withdrawn_at && Array.isArray(row.purposes) &&
        (row.purposes.includes("chapter_announcements") || row.purposes.includes("atma_rekha_updates") || row.purposes.includes("marketing_email"))
      );
      return reply(req, { ok: true, enabled: hasActiveEmailConsent && preference.data?.marketing_unsubscribed !== true });
    }
    if (action !== "set" || typeof raw?.enabled !== "boolean") return reply(req, { ok: false, error: "Invalid preference request." }, 422);
    const enabled = raw.enabled;
    if (enabled && !user.email_confirmed_at) return reply(req, { ok: false, error: "Verify your email before enabling chapter emails." }, 422);
    const now = new Date().toISOString();
    const { error: ensureError } = await db.from("email_marketing_preferences").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    if (ensureError) throw ensureError;
    if (enabled) {
      const { error } = await db.from("dpdp_consent_records").upsert({
        user_id: user.id,
        policy_version: POLICY_VERSION,
        purposes: ["atma_rekha_updates", "chapter_announcements"],
        consented_at: now,
        withdrawn_at: null,
        source: "notification_preferences"
      }, { onConflict: "user_id,policy_version" });
      if (error) throw error;
      const { error: prefError } = await db.from("email_marketing_preferences").update({ marketing_unsubscribed: false, updated_at: now }).eq("user_id", user.id);
      if (prefError) throw prefError;
    } else {
      const { error } = await db.from("dpdp_consent_records").update({ withdrawn_at: now }).eq("user_id", user.id).eq("policy_version", POLICY_VERSION);
      if (error) throw error;
      const { error: prefError } = await db.from("email_marketing_preferences").update({ marketing_unsubscribed: true, updated_at: now }).eq("user_id", user.id);
      if (prefError) throw prefError;
    }
    // Keep the email provider aligned with the reader's explicit choice.
    if (anonKey) {
      const sync = await fetch((url.endsWith("/") ? url.slice(0, -1) : url) + "/functions/v1/resend-contact-sync", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, apikey: anonKey, "Content-Type": "application/json" },
        body: "{}"
      });
      if (!sync.ok) console.error("Email contact preference sync deferred.", sync.status);
    }
    return reply(req, { ok: true, enabled });
  } catch (error) {
    console.error("Chapter email preference update failed.", error);
    return reply(req, { ok: false, error: "Could not save your email preference. Try again." }, 500);
  }
});
