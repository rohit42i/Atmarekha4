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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, { ok: false, error: "Method not allowed." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const contactKey = Deno.env.get("RESEND_CONTACTS_API_KEY") || "";
  if (!supabaseUrl || !serviceKey || !contactKey) return reply(req, { ok: false, error: "Contact sync is not configured: set RESEND_CONTACTS_API_KEY with Contacts API permissions." }, 503);
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return reply(req, { ok: false, error: "Authentication required." }, 401);
    const db = createClient(supabaseUrl, serviceKey);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    const userId = auth?.user?.id;
    if (authError || !userId) return reply(req, { ok: false, error: "Invalid session." }, 401);

    const { data: accountData, error: accountError } = await db.auth.admin.getUserById(userId);
    const account = accountData?.user;
    const email = String(account?.email || "").trim().toLowerCase();
    if (accountError || !account || !email) return reply(req, { ok: false, error: "Account not found." }, 404);

    const [consents, preference, profile] = await Promise.all([
      db.from("dpdp_consent_records").select("purposes,withdrawn_at").eq("user_id", userId).order("consented_at", { ascending: false }).limit(20),
      db.from("email_marketing_preferences").select("marketing_unsubscribed").eq("user_id", userId).maybeSingle(),
      db.from("profiles").select("display_name,username").eq("id", userId).maybeSingle()
    ]);
    if (consents.error || preference.error || profile.error) return reply(req, { ok: false, error: "Could not verify email preferences." }, 503);
    const consented = (consents.data || []).some((row: any) => !row.withdrawn_at && Array.isArray(row.purposes) && (row.purposes.includes("atma_rekha_updates") || row.purposes.includes("chapter_announcements") || row.purposes.includes("marketing_email")));
    const optedOut = preference.data?.marketing_unsubscribed === true;
    // Contacts without explicit permission stay unsubscribed in Resend, including unverified accounts.
    const subscribed = Boolean(account.email_confirmed_at && consented && !optedOut);
    const displayName = String(profile.data?.display_name || profile.data?.username || account.user_metadata?.full_name || "").trim();
    const firstName = displayName.split(/\s+/).filter(Boolean)[0] || "Reader";
    const path = "/contacts/" + encodeURIComponent(email);
    const lookup = await resend(path, contactKey);
    let contactId = "";

    const contactFields = {
      first_name: firstName,
      unsubscribed: !subscribed,
      properties: { website: "Atma Rekha", atma_rekha_updates_enabled: String(subscribed) }
    };
    if (lookup.ok) {
      const existing: any = await lookup.json();
      contactId = String(existing.id || existing.data?.id || "");
      const update = await resend(path, contactKey, { method: "PATCH", body: JSON.stringify(contactFields) });
      if (!update.ok) {
        console.error("Resend contact update failed.", update.status);
        return reply(req, { ok: false, error: "Resend contact update failed." }, 502);
      }
    } else if (lookup.status === 404) {
      const create = await resend("/contacts", contactKey, {
        method: "POST",
        body: JSON.stringify({ email, ...contactFields, segments: [{ id: SEGMENT_ID }] })
      });
      if (!create.ok) {
        const details = await create.text();
        if (create.status === 409 || create.status === 422) {
          const retry = await resend(path, contactKey);
          if (!retry.ok) {
            console.error("Resend contact create failed.", create.status, details.slice(0, 160));
            return reply(req, { ok: false, error: "Resend contact creation failed." }, 502);
          }
          const existing: any = await retry.json();
          contactId = String(existing.id || existing.data?.id || "");
          const update = await resend(path, contactKey, { method: "PATCH", body: JSON.stringify(contactFields) });
          if (!update.ok) return reply(req, { ok: false, error: "Resend contact update failed." }, 502);
        } else {
          console.error("Resend contact create failed.", create.status, details.slice(0, 160));
          return reply(req, { ok: false, error: "Resend contact creation failed." }, 502);
        }
      } else {
        const created: any = await create.json();
        contactId = String(created.id || created.data?.id || "");
      }
    } else {
      console.error("Resend contact lookup failed.", lookup.status);
      return reply(req, { ok: false, error: "Resend contact lookup failed." }, 502);
    }

    if (contactId) {
      const segment = await resend("/contacts/" + encodeURIComponent(contactId) + "/segments/" + encodeURIComponent(SEGMENT_ID), contactKey, { method: "POST" });
      if (!segment.ok && segment.status !== 409 && segment.status !== 422) {
        console.error("Resend segment assignment failed.", segment.status);
        return reply(req, { ok: false, error: "Contact synced, but audience assignment failed." }, 502);
      }
    }
    return reply(req, { ok: true, confirmed: Boolean(account.email_confirmed_at), updatesSubscribed: subscribed });
  } catch (error) {
    console.error("Resend contact sync failed.", error);
    return reply(req, { ok: false, error: "Contact sync failed. It will retry on a later sign-in." }, 500);
  }
});
