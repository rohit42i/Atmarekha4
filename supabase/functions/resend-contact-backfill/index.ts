import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = "https://www.atmarekha.in";
const SEGMENT_ID = Deno.env.get("RESEND_CONTACT_SEGMENT_ID") || "d48526c4-b3d8-4a13-9c64-25f2756e6b62";
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

async function resend(path: string, key: string, init: RequestInit = {}) {
  return fetch("https://api.resend.com" + path, {
    ...init,
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init.headers || {}) }
  });
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

async function loadRows(db: any, table: string, columns: string, ids: string[], key = "user_id") {
  const rows: any[] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const { data, error } = await db.from(table).select(columns).in(key, ids.slice(offset, offset + 500));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, { ok: false, error: "Method not allowed." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const contactKey = Deno.env.get("RESEND_CONTACTS_API_KEY") || "";
  if (!supabaseUrl || !serviceKey || !contactKey) return reply(req, { ok: false, error: "Contact backfill is not configured." }, 503);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return reply(req, { ok: false, error: "Authentication required." }, 401);
    const db = createClient(supabaseUrl, serviceKey);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth?.user) return reply(req, { ok: false, error: "Invalid session." }, 401);
    const { data: admin, error: adminError } = await db.from("admins").select("role").eq("user_id", auth.user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin || !["owner", "admin"].includes(String(admin.role || "").toLowerCase())) return reply(req, { ok: false, error: "Admin access required." }, 403);

    const accounts = await loadAllUsers(db);
    const confirmed = accounts.filter((u: any) => u.email && u.email_confirmed_at);
    const ids = confirmed.map((u: any) => u.id);
    const [profiles, preferences, consentRows] = await Promise.all([
      loadRows(db, "profiles", "id,display_name,username", ids, "id"),
      loadRows(db, "email_marketing_preferences", "user_id,marketing_unsubscribed", ids),
      loadRows(db, "dpdp_consent_records", "user_id,purposes,withdrawn_at", ids)
    ]);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const optOuts = new Set((preferences || []).filter((p: any) => p.marketing_unsubscribed).map((p: any) => p.user_id));
    const consented = new Set((consentRows || []).filter((r: any) => !r.withdrawn_at && Array.isArray(r.purposes) && (r.purposes.includes("atma_rekha_updates") || r.purposes.includes("chapter_announcements") || r.purposes.includes("marketing_email"))).map((r: any) => r.user_id));
    const targets = confirmed.map((account: any) => {
      const profile: any = profileMap.get(account.id) || {};
      const name = String(profile.display_name || profile.username || account.user_metadata?.full_name || account.user_metadata?.name || "").trim();
      return {
        email: String(account.email).trim().toLowerCase(),
        firstName: name.split(/\s+/).filter(Boolean)[0] || "Reader",
        eligible: consented.has(account.id) && !optOuts.has(account.id)
      };
    });

    let added = 0, updated = 0, unsubscribed = 0, failed = 0;
    const errors: string[] = [];
    for (let offset = 0; offset < targets.length; offset += 10) {
      const results = await Promise.all(targets.slice(offset, offset + 10).map(async (target: any) => {
        try {
          const path = "/contacts/" + encodeURIComponent(target.email);
          const lookup = await resend(path, contactKey);
          let contactId = "";
          let wasCreated = false;
          if (lookup.ok) {
            const existing: any = await lookup.json();
            contactId = String(existing.id || "");
            const update = await resend(path, contactKey, {
              method: "PATCH",
              body: JSON.stringify({
                first_name: target.firstName,
                unsubscribed: !target.eligible,
                properties: { website: "Atma Rekha", atma_rekha_updates_enabled: String(target.eligible) }
              })
            });
            if (!update.ok) throw new Error("Contact update failed (" + update.status + ")");
          } else if (lookup.status === 404) {
            const create = await resend("/contacts", contactKey, {
              method: "POST",
              body: JSON.stringify({
                email: target.email,
                first_name: target.firstName,
                unsubscribed: !target.eligible,
                segments: [{ id: SEGMENT_ID }],
                properties: { website: "Atma Rekha", atma_rekha_updates_enabled: String(target.eligible) }
              })
            });
            if (!create.ok) {
              if (create.status === 409) throw new Error("Contact already exists; retry on next sync");
              throw new Error("Contact creation failed (" + create.status + ")");
            }
            const created: any = await create.json();
            contactId = String(created.id || "");
            wasCreated = true;
          } else {
            throw new Error("Contact lookup failed (" + lookup.status + ")");
          }
          if (contactId) {
            const segment = await resend("/contacts/" + encodeURIComponent(contactId) + "/segments/" + encodeURIComponent(SEGMENT_ID), contactKey, { method: "POST" });
            if (!segment.ok && segment.status !== 409 && segment.status !== 422) throw new Error("Audience assignment failed (" + segment.status + ")");
          }
          return { ok: true, added: wasCreated, eligible: target.eligible };
        } catch (error) {
          return { ok: false, email: target.email, error: String(error instanceof Error ? error.message : "Sync failed").slice(0, 160), eligible: target.eligible };
        }
      }));
      for (const item of results) {
        if (!item.ok) {
          failed++;
          if (errors.length < 5) errors.push(item.error || "Contact sync failed");
        } else {
          if (item.added) added++; else updated++;
          if (!item.eligible) unsubscribed++;
        }
      }
    }
    return reply(req, { ok: failed === 0, total: targets.length, added, updated, unsubscribed, eligibleForUpdates: targets.filter((t: any) => t.eligible).length, failed, errors });
  } catch (error) {
    console.error("Resend contact backfill failed.", error);
    return reply(req, { ok: false, error: "Could not sync the contact list. Please retry." }, 500);
  }
});
