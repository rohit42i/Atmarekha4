import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://www.atmarekha.in", "https://atmarekha.in", "http://localhost:5173"]);
const BATCH_SIZE = 25;
const ACTIVE_STATUSES = new Set(["active", "authenticated", "created", "pending"]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}
function json(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}
function readServiceKey() {
  const configured = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { const parsed = JSON.parse(configured); if (parsed?.default) return String(parsed.default).trim(); } catch {}
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
}
function toIso(epochSeconds: unknown) {
  const value = Number(epochSeconds);
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}
function isFuture(value: unknown) {
  if (!value) return false;
  const millis = new Date(String(value)).getTime();
  return Number.isFinite(millis) && millis > Date.now();
}
async function updateNote(admin: ReturnType<typeof createClient>, requestId: string, note: string, scheduledAt?: string | null) {
  const update: Record<string, unknown> = { resolution_note: note };
  if (scheduledAt) update.scheduled_delete_at = scheduledAt;
  const { error } = await admin.from("dpdp_deletion_requests").update(update).eq("id", requestId);
  if (error) throw error;
}

async function cancelRazorpaySubscription(subscriptionId: string, keyId: string, secret: string) {
  const response = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${secret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancel_at_cycle_end: true }),
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    // Do not include provider body in logs or the client response.
    throw new Error(`Razorpay cancellation returned HTTP ${response.status}.`);
  }
  return result;
}

async function processOne(admin: ReturnType<typeof createClient>, request: Record<string, any>) {
  const requestId = String(request.id);
  if (!request.user_id) {
    if (request.status === "processing") {
      const now = new Date().toISOString();
      const { error } = await admin.from("dpdp_deletion_requests").update({
        status: "resolved",
        resolved_at: now,
        resolved_by: null,
        resolution_note: "Account erasure was completed; request closed after retry.",
      }).eq("id", requestId).eq("status", "processing");
      if (error) throw error;
      return { request_id: requestId, status: "resolved", retried: true };
    }
    return { request_id: requestId, status: "skipped", reason: "Account reference is unavailable." };
  }

  const userId = String(request.user_id);
  const { data: subscriptions, error: subscriptionError } = await admin
    .from("user_subscriptions")
    .select("id,provider,provider_subscription_id,status,current_period_end,cancel_at_period_end,plan_id")
    .eq("user_id", userId);
  if (subscriptionError) throw new Error("Could not inspect subscription retention requirements.");

  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim() || "";
  const razorpaySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim() || "";
  let periodEnd: string | null = null;
  for (const subscription of subscriptions || []) {
    const provider = String(subscription.provider || "").toLowerCase();
    const status = String(subscription.status || "").toLowerCase();
    const active = ACTIVE_STATUSES.has(status);
    if (!active && !isFuture(subscription.current_period_end)) continue;

    if (provider === "razorpay" && active && subscription.cancel_at_period_end !== true) {
      if (!razorpayKeyId || !razorpaySecret || !subscription.provider_subscription_id) {
        await updateNote(admin, requestId, "Erasure paused: a recurring Razorpay subscription needs cancellation credentials or a valid provider subscription ID.");
        return { request_id: requestId, status: "pending", reason: "Payment cancellation configuration is incomplete." };
      }
      try {
        const providerResult = await cancelRazorpaySubscription(
          String(subscription.provider_subscription_id), razorpayKeyId, razorpaySecret,
        );
        const providerEnd = toIso(providerResult?.current_end);
        const knownEnd = subscription.current_period_end || providerEnd;
        const { error: updateError } = await admin.from("user_subscriptions").update({
          cancel_at_period_end: true,
          ...(providerEnd && !subscription.current_period_end ? { current_period_end: providerEnd } : {}),
          updated_at: new Date().toISOString(),
        }).eq("id", subscription.id).eq("user_id", userId);
        if (updateError) throw new Error("Subscription cancellation was accepted but the local status could not be updated.");
        if (knownEnd && isFuture(knownEnd)) {
          const scheduledAt = new Date(Math.max(
            new Date(String(request.scheduled_delete_at)).getTime(),
            new Date(String(knownEnd)).getTime(),
          )).toISOString();
          await updateNote(admin, requestId, "Deletion deferred until the recurring subscription period ends. Renewal cancellation was requested.", scheduledAt);
          return { request_id: requestId, status: "pending", deferred_until: scheduledAt, reason: "Recurring subscription period has not ended." };
        }
        if (!knownEnd && status !== "cancelled" && status !== "expired") {
          await updateNote(admin, requestId, "Erasure paused: Razorpay accepted the cancellation request but no trustworthy current-period end was returned. Review the provider record before erasure.");
          return { request_id: requestId, status: "pending", reason: "Could not verify subscription period end." };
        }
      } catch (error) {
        await updateNote(admin, requestId, "Erasure paused because recurring Razorpay cancellation could not be confirmed. Retry after the provider subscription is safely cancelled.");
        throw error;
      }
    } else if (provider !== "razorpay" && active) {
      if (subscription.current_period_end && isFuture(subscription.current_period_end)) {
        const scheduledAt = new Date(Math.max(
          new Date(String(request.scheduled_delete_at)).getTime(),
          new Date(String(subscription.current_period_end)).getTime(),
        )).toISOString();
        await updateNote(admin, requestId, "Deletion deferred until the recorded subscription period ends.", scheduledAt);
        return { request_id: requestId, status: "pending", deferred_until: scheduledAt, reason: "A paid subscription period is still active." };
      }
      // Unknown/legacy provider state must be reviewed, never guessed to be safe.
      await updateNote(admin, requestId, "Erasure paused: an active or pending subscription has no verified end date. Review the billing record before proceeding.");
      return { request_id: requestId, status: "pending", reason: "An active subscription has no verified end date." };
    } else if (isFuture(subscription.current_period_end)) {
      const scheduledAt = new Date(Math.max(
        new Date(String(request.scheduled_delete_at)).getTime(),
        new Date(String(subscription.current_period_end)).getTime(),
      )).toISOString();
      await updateNote(admin, requestId, "Deletion deferred until the recorded subscription period ends.", scheduledAt);
      return { request_id: requestId, status: "pending", deferred_until: scheduledAt, reason: "Subscription period has not ended." };
    }
    periodEnd = [periodEnd, subscription.current_period_end].filter(Boolean).sort().at(-1) || periodEnd;
  }

  // Legacy subscriptions have no provider ID. Keep billing records through their
  // configured expiry, and defer rather than deleting during a paid period.
  const { data: legacySubscriptions, error: legacyError } = await admin
    .from("subscriptions")
    .select("status,expiry_date")
    .eq("user_id", userId);
  if (legacyError) throw new Error("Could not inspect legacy subscription retention requirements.");
  for (const subscription of legacySubscriptions || []) {
    if (["active", "pending"].includes(String(subscription.status || "").toLowerCase()) && isFuture(subscription.expiry_date)) {
      const scheduledAt = new Date(Math.max(
        new Date(String(request.scheduled_delete_at)).getTime(),
        new Date(String(subscription.expiry_date)).getTime(),
      )).toISOString();
      await updateNote(admin, requestId, "Deletion deferred until the legacy subscription expiry date.", scheduledAt);
      return { request_id: requestId, status: "pending", deferred_until: scheduledAt, reason: "Legacy subscription period has not ended." };
    }
  }

  const { data: erased, error: eraseError } = await admin.rpc("erase_due_account_personal_data", {
    p_request_id: requestId,
    p_admin_id: null,
  });
  if (eraseError) {
    // The RPC itself locks the request and checks the date/recovery windows.
    throw new Error("The account's personal data could not be erased safely. The request remains available for retry.");
  }
  if (erased?.deferred) {
    return { request_id: requestId, status: "pending", deferred_until: erased.scheduled_delete_at, reason: "The database retained a paid period." };
  }

  if (erased?.auth_user_exists === true) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      // The SQL transaction has anonymized/deleted application data already.
      // Keep the request processing so the next scheduled retry can finish auth removal.
      await updateNote(admin, requestId, "Personal data was erased, but the authentication identity still needs removal. The scheduled processor will retry.");
      throw new Error("Auth account removal did not complete; a retry is required.");
    }
  }

  const now = new Date().toISOString();
  const { error: completeError } = await admin.from("dpdp_deletion_requests").update({
    status: "resolved",
    user_id: null,
    resolved_at: now,
    resolved_by: null,
    resolution_note: "Account erasure completed. Necessary financial records were anonymized and retained for accounting or legal obligations.",
  }).eq("id", requestId).in("status", ["pending", "processing"]);
  if (completeError) throw new Error("Account erasure completed but the request status could not be finalized.");
  return { request_id: requestId, status: "resolved" };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (!/^Bearer\s+\S+/i.test(req.headers.get("Authorization") || "")) {
    return json({ error: "Authentication required." }, 401, origin);
  }
  try {
    const url = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const key = readServiceKey();
    if (!url || !key) return json({ error: "Processor service configuration is missing." }, 503, origin);
    const admin = createClient(url, key);

    const rawBody = await req.json().catch(() => ({}));
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return json({ error: "Invalid request body." }, 400, origin);
    }
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const { data: { user } } = await admin.auth.getUser(token).catch(() => ({ data: { user: null } } as any));
    if (user?.id) {
      const { data: role, error: roleError } = await admin.from("admins").select("role").eq("user_id", user.id).maybeSingle();
      if (roleError || !role || !["owner", "admin"].includes(String(role.role || "").toLowerCase())) {
        return json({ error: "Admin access required." }, 403, origin);
      }
    } else if (rawBody.source !== "cron") {
      // The scheduled job uses a server-side service invocation tagged as cron.
      // Only requests that process already-due records are accepted without a user account.
      return json({ error: "Admin access required." }, 403, origin);
    }

    const now = new Date().toISOString();
    const { data: requests, error: requestError } = await admin
      .from("dpdp_deletion_requests")
      .select("id,user_id,status,scheduled_delete_at,recovery_until,requested_at")
      .in("status", ["pending", "processing"])
      .lte("scheduled_delete_at", now)
      .lte("recovery_until", now)
      .order("scheduled_delete_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (requestError) return json({ error: "Could not load due deletion requests." }, 503, origin);

    const results = [];
    for (const request of requests || []) {
      try {
        results.push(await processOne(admin, request));
      } catch (error) {
        console.error("Scheduled deletion processing failed:", error instanceof Error ? error.message : "unknown error");
        results.push({ request_id: request.id, status: "retry", error: "Processing failed safely; the request will be retried." });
      }
    }
    return json({ success: true, processed: results.length, results }, 200, origin);
  } catch (error) {
    console.error("Scheduled deletion processor failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Scheduled account deletion processing failed." }, 500, origin);
  }
});
