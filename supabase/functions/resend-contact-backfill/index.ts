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

async function loadAllUsers(db: any) {
  const users: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 1000) return users;
  }
  const { data, error } = await db.auth.admin.listUsers({ page: 21, perPage: 1 });
  if (error) throw error;
  if ((data?.users || []).length) throw new Error("Account directory exceeds the 20,000-account safety limit.");
  return users;
}

async function loadRows(db: any, table: string, columns: string, ids: string[]) {
  const result: any[] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const { data, error } = await db.from(table).select(columns).in("user_id", ids.slice(offset, offset + 500));
    if (error) throw error;
    result.push(...(data || []));
  }
  return result;
}

/**
 * Historical admin action kept for compatibility, now deliberately checks the live
 * Supabase audience rather than uploading duplicate contacts into Resend. Email
 * campaigns are sent directly through Resend and already enforce these same DB rules.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, { ok: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = readSupabaseServiceRoleKey();
  if (!supabaseUrl || !serviceKey) return reply(req, { ok: false, error: "Supabase server configuration is missing." }, 503);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "").trim();
    if (!token) return reply(req, { ok: false, error: "Authentication required." }, 401);

    const db = createClient(supabaseUrl, serviceKey);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth?.user) return reply(req, { ok: false, error: "Invalid session." }, 401);

    const { data: admin, error: adminError } = await db.from("admins").select("role").eq("user_id", auth.user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin || !["owner", "admin"].includes(String(admin.role || "").trim().toLowerCase())) {
      return reply(req, { ok: false, error: "Admin access required." }, 403);
    }

    const accounts = await loadAllUsers(db);
    const confirmed = accounts.filter((account: any) => account.email && account.email_confirmed_at);
    const ids = confirmed.map((account: any) => account.id);
    const [preferences, consentRows] = await Promise.all([
      loadRows(db, "email_marketing_preferences", "user_id,marketing_unsubscribed", ids),
      loadRows(db, "dpdp_consent_records", "user_id,purposes,withdrawn_at", ids)
    ]);

    const optOuts = new Set((preferences || []).filter((row: any) => row.marketing_unsubscribed === true).map((row: any) => row.user_id));
    const activeConsents = (consentRows || []).filter((row: any) => !row.withdrawn_at);
    const updateConsents = new Set(activeConsents.filter((row: any) =>
      Array.isArray(row.purposes) &&
      (row.purposes.includes("atma_rekha_updates") ||
       row.purposes.includes("chapter_announcements") ||
       row.purposes.includes("marketing_email"))
    ).map((row: any) => row.user_id));
    const marketingConsents = new Set(activeConsents.filter((row: any) =>
      Array.isArray(row.purposes) && row.purposes.includes("marketing_promotion")
    ).map((row: any) => row.user_id));

    const eligibleForUpdates = confirmed.filter((account: any) =>
      updateConsents.has(account.id) && !optOuts.has(account.id)
    ).length;
    const eligibleForMarketing = confirmed.filter((account: any) =>
      marketingConsents.has(account.id) && !optOuts.has(account.id)
    ).length;

    return reply(req, {
      ok: true,
      mode: "database_source_of_truth",
      providerSync: false,
      total: confirmed.length,
      eligibleForUpdates,
      eligibleForMarketing,
      unsubscribed: optOuts.size,
      noUpdateConsent: Math.max(0, confirmed.length - eligibleForUpdates - optOuts.size),
      failed: 0,
      message: "Audience eligibility was reconciled from Supabase consent and preference records. No duplicate provider contacts were uploaded."
    });
  } catch (error) {
    console.error("Email audience reconciliation failed.", error instanceof Error ? error.message : "unknown error");
    return reply(req, { ok: false, error: "Could not reconcile the email audience. Please retry." }, 500);
  }
});
