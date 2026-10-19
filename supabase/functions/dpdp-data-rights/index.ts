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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://www.atmarekha.in","https://atmarekha.in","http://localhost:5173"]);
const USER_TABLES = [
  "profiles","bookmarks","chapter_ratings","comment_likes","comments","community_members","community_post_reactions",
  "feature_login_users","group_chat_likes","group_chat_messages","group_chat_reactions","group_chat_reads","member_messages",
  "moderation_reports","notification_subscriptions","payments","pdlpl_bookmarks","pdlpl_chapter_ratings","pdlpl_comment_likes",
  "pdlpl_comments","pdlpl_reading_history","push_subscriptions","reading_history","subscriptions","user_moderation","user_subscriptions"
];

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
function response(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function clean(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }
function validEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value); }

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return response({ error: "Method not allowed." }, 405, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !key) return response({ error: "Server configuration is missing." }, 500, origin);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return response({ error: "Authentication required." }, 401, origin);

    const admin = createClient(url, key);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return response({ error: "Authentication failed." }, 401, origin);

    const { data: rateAllowed, error: rateError } = await admin.rpc("consume_rate_limit", { p_rate_key: `dpdp-data-rights:${user.id}`, p_limit: 10, p_window_seconds: 3600 });
    if (rateError) { console.error("Data-rights rate limit check failed."); return response({ error: "Data request service is temporarily unavailable." }, 503, origin); }
    if (rateAllowed === false) return response({ error: "Too many data-rights requests. Please try again later." }, 429, origin);

    const rawBody = await readLimitedBody(req, 12 * 1024);
    if (rawBody === null) return response({ error: "Request body is too large." }, 413, origin);
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return response({ error: "Invalid JSON body." }, 400, origin); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return response({ error: "Invalid request body." }, 400, origin);
    const action = body?.action || "export";
    const adminActions = ["admin-list-deletion-requests", "admin-update-deletion-request"];
    if (!["export","delete-request","nomination","withdraw-consent", ...adminActions].includes(action)) return response({ error: "Unknown data-rights action." }, 400, origin);

    if (adminActions.includes(action)) {
      const { data: adminRow, error: adminError } = await admin
        .from("admins").select("role").eq("user_id", user.id).maybeSingle();
      if (adminError || !adminRow || !["owner", "admin"].includes(String(adminRow.role))) {
        return response({ error: "Admin access required." }, 403, origin);
      }

      if (action === "admin-list-deletion-requests") {
        const { data: requests, error } = await admin
          .from("dpdp_deletion_requests")
          .select("id,user_id,reason,status,requested_at,resolved_at,resolved_by,resolution_note")
          .order("requested_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        const enriched = await Promise.all((requests || []).map(async request => {
          if (!request.user_id) return { ...request, requester_email: null };
          const { data: authData } = await admin.auth.admin.getUserById(request.user_id);
          return { ...request, requester_email: authData?.user?.email || null };
        }));
        return response({ requests: enriched }, 200, origin);
      }

      const requestId = clean(body?.request_id, 80);
      const nextStatus = clean(body?.status, 20);
      const note = clean(body?.resolution_note, 1000);
      if (!requestId || !["processing", "resolved", "rejected"].includes(nextStatus)) {
        return response({ error: "A valid request ID and status are required." }, 400, origin);
      }
      if ((nextStatus === "resolved" || nextStatus === "rejected") && note.length < 10) {
        return response({ error: "Add a resolution note of at least 10 characters." }, 400, origin);
      }
      if (nextStatus === "resolved" && body?.confirmed_erasure !== true) {
        return response({ error: "Confirm that erasure was completed and legally required records were reviewed." }, 400, origin);
      }
      const { data: current, error: currentError } = await admin
        .from("dpdp_deletion_requests").select("id,status")
        .eq("id", requestId).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return response({ error: "Deletion request not found." }, 404, origin);
      const validTransition = nextStatus === "processing"
        ? current.status === "pending"
        : current.status === "processing";
      if (!validTransition) return response({ error: "This request status has already changed. Refresh the queue and try again." }, 409, origin);
      const { data: updated, error: updateError } = await admin
        .from("dpdp_deletion_requests")
        .update({
          status: nextStatus,
          resolution_note: note || null,
          resolved_at: nextStatus === "processing" ? null : new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("id", requestId)
        .select("id,user_id,reason,status,requested_at,resolved_at,resolved_by,resolution_note")
        .single();
      if (updateError) throw updateError;
      return response({ request: updated }, 200, origin);
    }

    if (action === "withdraw-consent") {
      const policyVersion = clean(body?.policy_version, 80);
      if (!policyVersion) return response({ error: "Policy version is required." }, 400, origin);
      const withdrawnAt = new Date().toISOString();
      const { data, error } = await admin.from("dpdp_consent_records")
        .update({ withdrawn_at: withdrawnAt })
        .eq("user_id", user.id)
        .eq("policy_version", policyVersion)
        .is("withdrawn_at", null)
        .select("policy_version,purposes,consented_at,withdrawn_at,source")
        .maybeSingle();
      if (error) throw error;
      if (!data) return response({ error: "No active consent record was found for that policy version." }, 404, origin);
      return response({ consent: data }, 200, origin);
    }

    if (action === "delete-request") {
      const reason = clean(body?.reason, 500);
      const { data: existing } = await admin.from("dpdp_deletion_requests")
        .select("id,status,requested_at").eq("user_id", user.id)
        .in("status", ["pending","processing"]).order("requested_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) return response({ request: existing }, 200, origin);
      const { data, error } = await admin.from("dpdp_deletion_requests")
        .insert({ user_id: user.id, reason: reason || null })
        .select("id,status,requested_at").single();
      if (error) throw error;
      return response({ request: data }, 201, origin);
    }

    if (action === "nomination") {
      const nomineeName = clean(body?.nominee_name, 120);
      const nomineeEmail = clean(body?.nominee_email, 254).toLowerCase();
      const nomineePhone = clean(body?.nominee_phone, 30);
      if (!nomineeName) return response({ error: "Nominee name is required." }, 400, origin);
      if (nomineeEmail && !validEmail(nomineeEmail)) return response({ error: "Enter a valid nominee email address." }, 400, origin);
      const { data, error } = await admin.from("dpdp_nominations").upsert({
        user_id: user.id,
        nominee_name: nomineeName,
        nominee_email: nomineeEmail || null,
        nominee_phone: nomineePhone || null,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" }).select("nominee_name,nominee_email,nominee_phone,created_at,updated_at").single();
      if (error) throw error;
      return response({ nomination: data }, 200, origin);
    }

    const output: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      service_operator: "Atma Rekha",
      processors: ["Supabase","Cloudflare","Razorpay"],
      account: {
        id: user.id,
        email: user.email || null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        metadata: user.user_metadata || {},
      },
      tables: {},
    };

    for (const table of USER_TABLES) {
      try {
        if (table === "profiles") {
          const { data, error } = await admin.from(table).select("*").eq("id", user.id);
          if (!error) (output.tables as Record<string, unknown>)[table] = data || [];
        } else {
          const { data, error } = await admin.from(table).select("*").eq("user_id", user.id).limit(5000);
          if (!error) (output.tables as Record<string, unknown>)[table] = data || [];
        }
      } catch {}
    }

    const [{ data: consents }, { data: requests }, { data: nomination }] = await Promise.all([
      admin.from("dpdp_consent_records").select("policy_version,purposes,consented_at,withdrawn_at,source").eq("user_id", user.id).order("consented_at", { ascending: false }),
      admin.from("dpdp_deletion_requests").select("id,status,reason,requested_at,resolved_at").eq("user_id", user.id).order("requested_at", { ascending: false }),
      admin.from("dpdp_nominations").select("nominee_name,nominee_email,nominee_phone,created_at,updated_at").eq("user_id", user.id).maybeSingle(),
    ]);

    output.consents = consents || [];
    output.deletion_requests = requests || [];
    output.nomination = nomination || null;
    output.rights = ["access","correction","erasure","withdrawal of consent where applicable","objection or restriction where applicable","portability where applicable","grievance or complaint","nomination where applicable"];
    return response(output, 200, origin);
  } catch (error) {
    console.error("Privacy data rights failed:", error);
    return response({ error: "Unable to process your data request." }, 500, origin);
  }
});
