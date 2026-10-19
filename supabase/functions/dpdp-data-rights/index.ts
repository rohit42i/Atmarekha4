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
  "moderation_reports","site_feedback","notification_subscriptions","payments","pdlpl_bookmarks","pdlpl_chapter_ratings","pdlpl_comment_likes",
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
    const adminActions = ["admin-list-deletion-requests", "admin-update-deletion-request", "admin-delete-account"];
    if (!["export","delete-request","withdraw-consent", ...adminActions].includes(action)) return response({ error: "Unknown data-rights action." }, 400, origin);

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
          if (!request.user_id) return { ...request, requester_email: null, requester_email_confirmed_at: null, requester_created_at: null, requester_last_sign_in_at: null };
          const { data: authData } = await admin.auth.admin.getUserById(request.user_id);
          return { ...request, requester_email: authData?.user?.email || null, requester_email_confirmed_at: authData?.user?.email_confirmed_at || null, requester_created_at: authData?.user?.created_at || null, requester_last_sign_in_at: authData?.user?.last_sign_in_at || null };
        }));
        return response({ requests: enriched }, 200, origin);
      }


      if (action === "admin-delete-account") {
        const requestId = clean(body?.request_id, 80);
        const confirmationEmail = clean(body?.confirmation_email, 254).toLowerCase();
        const resolutionNote = clean(body?.resolution_note, 1000);
        if (!requestId || !confirmationEmail) return response({ error: "Request ID and the reader's current email confirmation are required." }, 400, origin);
        if (resolutionNote.length < 10) return response({ error: "Add a clear erasure note of at least 10 characters." }, 422, origin);
        const { data: request, error: requestError } = await admin.from("dpdp_deletion_requests")
          .select("id,user_id,status,reason").eq("id", requestId).maybeSingle();
        if (requestError) throw requestError;
        if (!request) return response({ error: "Deletion request not found." }, 404, origin);
        if (request.status !== "processing") return response({ error: "Move this request to Processing before deleting the account." }, 409, origin);
        if (!request.user_id) return response({ error: "This request no longer points to an active account. Refresh the queue and review it manually." }, 409, origin);
        const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(request.user_id);
        if (targetError || !targetResult?.user) return response({ error: "Reader account not found. No data was deleted." }, 404, origin);
        const target = targetResult.user;
        const targetEmail = String(target.email || "").trim();
        if (!targetEmail || targetEmail.toLowerCase() !== confirmationEmail) return response({ error: "The confirmation email does not match the reader's current email. No data was deleted." }, 422, origin);
        if (!target.email_confirmed_at) return response({ error: "This email is not verified yet. Send a verification email and ask the reader to confirm before erasure." }, 409, origin);
        if (target.id === user.id) return response({ error: "An administrator cannot delete their own account from this queue." }, 403, origin);
        const { data: targetAdmin, error: targetAdminError } = await admin.from("admins").select("role").eq("user_id", target.id).maybeSingle();
        if (targetAdminError) throw targetAdminError;
        if (targetAdmin) return response({ error: "This account has an admin role. Remove the role and audit ownership first; no data was deleted." }, 409, origin);
        const { data: activeSubscriptions, error: subscriptionError } = await admin.from("user_subscriptions")
          .select("id,status,provider_subscription_id,current_period_end").eq("user_id", target.id);
        if (subscriptionError) throw subscriptionError;
        const hasLiveProviderSubscription = (activeSubscriptions || []).some((item: any) =>
          Boolean(item.provider_subscription_id) && ["active", "pending", "created", "authenticated"].includes(String(item.status || "").toLowerCase())
        );
        if (hasLiveProviderSubscription) return response({ error: "This account has a live payment-provider subscription. Cancel it through the billing provider first; no data was deleted." }, 409, origin);
        const { count: paymentCount, error: paymentError } = await admin.from("payments")
          .select("id", { count: "exact", head: true }).eq("user_id", target.id);
        if (paymentError) throw paymentError;
        if (Number(paymentCount || 0) > 0) return response({ error: "This account has payment records. Review lawful financial-record retention before deletion; this action will not erase those records." }, 409, origin);
        try {
          const { error: deleteError } = await admin.auth.admin.deleteUser(target.id);
          if (deleteError) throw deleteError;
        } catch (deleteError) {
          console.error("Requested account erasure failed:", deleteError instanceof Error ? deleteError.message : "unknown error");
          return response({ error: "The account could not be deleted because a linked record may require review. No completion was recorded." }, 409, origin);
        }
        const { data: updatedRequest, error: resolveError } = await admin.from("dpdp_deletion_requests")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
            resolution_note: resolutionNote,
          })
          .eq("id", request.id)
          .select("id,user_id,status,requested_at,resolved_at,resolved_by,resolution_note")
          .single();
        if (resolveError) {
          console.error("Account erased but request closure failed:", resolveError.message);
          return response({ error: "The account was deleted, but the request could not be closed automatically. Refresh the queue and record the completed erasure with this request ID." }, 500, origin);
        }
        let noticeEmailSent = false;
        const resendKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
        const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "Atma Rekha <atmarekhaoffical@gmail.com>";
        if (resendKey && targetEmail) {
          const html = "<!doctype html><html><body style=\"margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#171717\"><div style=\"max-width:560px;margin:32px auto;padding:28px;background:#fff;border:1px solid #e5e5e5;border-radius:10px\"><h1 style=\"font-size:22px\">Account deletion completed</h1><p style=\"font-size:15px;line-height:1.6\">Your Atma Rekha account and associated account data have been deleted following your request. Some records may be retained where required by law.</p><p style=\"font-size:12px;color:#777\">Atma Rekha</p></div></body></html>";
          try {
            const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" }, body: JSON.stringify({ from: fromEmail, to: [targetEmail], subject: "Your Atma Rekha account was deleted", html }) });
            noticeEmailSent = mail.ok;
            if (!mail.ok) console.error("Deletion confirmation email failed:", mail.status);
          } catch { noticeEmailSent = false; }
        }
        try {
          await admin.from("admin_activity_log").insert({
            admin_user_id: user.id, action: "delete_reader_account", entity_type: "user", entity_id: target.id,
            details: { request_id: request.id, email_confirmed: true, payment_records_retained: false, notice_email_sent: noticeEmailSent },
          });
        } catch { console.warn("Deletion audit log skipped."); }
        return response({ request: updatedRequest, deleted: true, notice_email_sent: noticeEmailSent, email_delivery_configured: Boolean(resendKey) }, 200, origin);
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
        .from("dpdp_deletion_requests").select("id,status,user_id")
        .eq("id", requestId).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return response({ error: "Deletion request not found." }, 404, origin);
      if (nextStatus === "processing") {
        if (!current.user_id) return response({ error: "This request has no linked account to verify. Review it manually before processing." }, 409, origin);
        const { data: requester } = await admin.auth.admin.getUserById(current.user_id);
        if (!requester?.user?.email_confirmed_at) return response({ error: "The reader email is not verified. Resend verification and ask the reader to confirm before processing." }, 409, origin);
      }
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

      let noticeEmailSent = false;
      let noticeEmailError = "";
      const resendKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "Atma Rekha <atmarekhaoffical@gmail.com>";
      if (updated.user_id) {
        const { data: requesterResult } = await admin.auth.admin.getUserById(updated.user_id);
        const recipient = requesterResult?.user?.email || "";
        if (recipient && resendKey) {
          const mailCopy: Record<string, { subject: string; title: string; message: string }> = {
            processing: { subject: "Your Atma Rekha deletion request is being reviewed", title: "Request received", message: "Your account deletion request has been received and is being reviewed." },
            rejected: { subject: "Update on your Atma Rekha deletion request", title: "Request update", message: note || "We could not complete your account deletion request. Please contact support if you need clarification." },
            resolved: { subject: "Your Atma Rekha deletion request is complete", title: "Request completed", message: "Your deletion request has been marked complete. Some records may be retained where required by law." }
          };
          const copy = mailCopy[nextStatus];
          if (copy) {
            const html = "<!doctype html><html><body style=\"margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#171717\"><div style=\"max-width:560px;margin:32px auto;padding:28px;background:#fff;border:1px solid #e5e5e5;border-radius:10px\"><h1 style=\"font-size:22px\">" + copy.title + "</h1><p style=\"font-size:15px;line-height:1.6\">" + copy.message.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>") + "</p><p style=\"font-size:12px;color:#777\">Atma Rekha</p></div></body></html>";
            try {
              const mail = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" }, body: JSON.stringify({ from: fromEmail, to: [recipient], subject: copy.subject, html }) });
              noticeEmailSent = mail.ok;
              if (!mail.ok) noticeEmailError = "Status updated, but Resend did not accept the notice.";
            } catch { noticeEmailError = "Status updated, but the notice could not be delivered."; }
          }
        } else if (!resendKey) noticeEmailError = "Status updated. Email provider is not configured.";
      } else noticeEmailError = "Status updated, but the account no longer has a linked email address.";
      try {
        await admin.from("admin_activity_log").insert({
          admin_user_id: user.id, action: "update_deletion_request_" + nextStatus, entity_type: "privacy_request", entity_id: updated.id,
          details: { notice_email_sent: noticeEmailSent, requester_account_linked: Boolean(updated.user_id) },
        });
      } catch { console.warn("Deletion request audit log skipped."); }
      return response({ request: updated, notice_email_sent: noticeEmailSent, notice_email_error: noticeEmailError || null }, 200, origin);
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
      const { data: existing, error: existingError } = await admin.from("dpdp_deletion_requests")
        .select("id,status,requested_at").eq("user_id", user.id)
        .in("status", ["pending","processing"]).order("requested_at", { ascending: false }).limit(1).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return response({ request: existing }, 200, origin);
      const { data, error } = await admin.from("dpdp_deletion_requests")
        .insert({ user_id: user.id, reason: reason || null })
        .select("id,status,requested_at").single();
      if (error) throw error;
      return response({ request: data }, 201, origin);
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
      export_warnings: [],
    };
    const exportWarnings: string[] = [];

    for (const table of USER_TABLES) {
      try {
        if (table === "profiles") {
          const { data, error } = await admin.from(table).select("*").eq("id", user.id);
          if (error) exportWarnings.push(`profiles: ${error.message}`);
          else (output.tables as Record<string, unknown>)[table] = data || [];
        } else {
          const { data, error } = await admin.from(table).select("*").eq("user_id", user.id).limit(5000);
          if (error) exportWarnings.push(`${table}: ${error.message}`);
          else {
            (output.tables as Record<string, unknown>)[table] = data || [];
            if ((data || []).length >= 5000) {
              exportWarnings.push(`${table}: export reached the 5,000-row safety limit; this category may be incomplete.`);
            }
          }
        }
      } catch (error) {
        exportWarnings.push(`${table}: ${error instanceof Error ? error.message : "unknown retrieval error"}`);
      }
    }

    const [
      { data: consents, error: consentsError },
      { data: requests, error: requestsError },
    ] = await Promise.all([
      admin.from("dpdp_consent_records").select("policy_version,purposes,consented_at,withdrawn_at,source").eq("user_id", user.id).order("consented_at", { ascending: false }),
      admin.from("dpdp_deletion_requests").select("id,status,reason,requested_at,resolved_at").eq("user_id", user.id).order("requested_at", { ascending: false }),
    ]);

    if (consentsError) exportWarnings.push(`dpdp_consent_records: ${consentsError.message}`);
    if (requestsError) exportWarnings.push(`dpdp_deletion_requests: ${requestsError.message}`);
    output.consents = consents || [];
    output.deletion_requests = requests || [];
    (output as Record<string, unknown>).export_warnings = exportWarnings;
    output.rights = ["access","correction","erasure","withdrawal of consent where applicable","objection or restriction where applicable","portability where applicable","grievance or complaint"];
    return response(output, 200, origin);
  } catch (error) {
    console.error("Privacy data rights failed:", error);
    return response({ error: "Unable to process your data request." }, 500, origin);
  }
});
