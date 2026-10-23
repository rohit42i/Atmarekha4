import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://www.atmarekha.in", "https://atmarekha.in", "http://localhost:5173"]);
const PERIOD_DAYS: Record<string, number> = { "7_days": 7, "30_days": 30, "90_days": 90, permanent: 14 };

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
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" } });
}
function readServiceKey() {
  const configured = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { const parsed = JSON.parse(configured); if (parsed?.default) return String(parsed.default).trim(); } catch {}
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
}
async function otpDigest(userId: string, purpose: string, otp: string, secret: string) {
  // A keyed digest prevents offline brute forcing if verification rows are exposed.
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${userId}:${purpose}:${otp}`));
  return [...new Uint8Array(signed)].map(v => v.toString(16).padStart(2, "0")).join("");
}
function randomOtp() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}
async function sendOtp(email: string, otp: string, purpose: string, period: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!apiKey) throw new Error("Email verification is temporarily unavailable. Please contact support.");
  const subject = purpose === "reactivate" ? "Confirm account deletion cancellation" : "Confirm your Atma Rekha account deletion";
  const description = purpose === "reactivate"
    ? "Use this code to cancel your pending account deletion request."
    : `You requested account deletion with the ${period.replaceAll("_", " ")} option. Your account has not been deleted. After confirmation, a 14-day recovery window begins.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "Atma Rekha <no-reply@atmarekha.in>",
      to: [email],
      subject,
      text: `Hey, hi, hello, namaste!\n\n${description}\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes and can be used once. If you did not request this, you can ignore this email.\n\nAtma Rekha\nhttps://www.atmarekha.in/`,
      headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Deletion verification email failed:", response.status, detail.slice(0, 300));
    throw new Error("We could not send the verification email. Please try again later.");
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  try {
    const url = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const key = readServiceKey();
    if (!url || !key) return json({ error: "Account deletion is temporarily unavailable." }, 503, origin);
    const auth = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+/i.test(auth)) return json({ error: "Please sign in again." }, 401, origin);
    const admin = createClient(url, key);
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user?.id || !user.email) return json({ error: "Your session could not be verified. Please sign in again." }, 401, origin);

    // Administrative identities must never be erased through the reader workflow.
    const { data: adminIdentity, error: adminIdentityError } = await admin
      .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminIdentityError) return json({ error: "Account deletion is temporarily unavailable." }, 503, origin);
    if (adminIdentity) return json({ error: "Admin accounts cannot be deleted through the reader Privacy Center. Transfer admin access first." }, 403, origin);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request." }, 400, origin);
    const action = String(body.action || "");
    if (!["send-delete-otp", "confirm-delete-otp", "send-reactivate-otp", "confirm-reactivate-otp"].includes(action)) {
      return json({ error: "Unknown account deletion action." }, 400, origin);
    }
    const { data: allowed, error: rateError } = await admin.rpc("consume_rate_limit", {
      p_rate_key: `account-deletion-workflow:${user.id}`, p_limit: 8, p_window_seconds: 3600,
    });
    if (rateError) return json({ error: "Account deletion is temporarily unavailable." }, 503, origin);
    if (allowed === false) return json({ error: "Too many attempts. Please try again later." }, 429, origin);

    if (action === "send-delete-otp" || action === "send-reactivate-otp") {
      const purpose = action === "send-reactivate-otp" ? "reactivate" : "delete";
      const period = String(body.period || "");
      if (purpose === "delete" && !Object.hasOwn(PERIOD_DAYS, period)) return json({ error: "Choose a valid deletion period." }, 400, origin);
      let requestId: string | null = null;
      if (purpose === "reactivate") {
        const { data: pending, error } = await admin.from("dpdp_deletion_requests").select("id,recovery_until,status")
          .eq("user_id", user.id).eq("status", "pending").order("requested_at", { ascending: false }).limit(1).maybeSingle();
        if (error) return json({ error: "Could not load your deletion request." }, 503, origin);
        if (!pending || !pending.recovery_until || new Date(pending.recovery_until).getTime() < Date.now()) {
          return json({ error: "There is no deletion request available to cancel during its recovery window." }, 409, origin);
        }
        requestId = pending.id;
      } else {
        const { data: pending, error } = await admin.from("dpdp_deletion_requests").select("id")
          .eq("user_id", user.id).in("status", ["pending", "processing"]).limit(1).maybeSingle();
        if (error) return json({ error: "Could not check your existing deletion request." }, 503, origin);
        if (pending) return json({ error: "A deletion request is already active. Use the recovery option to cancel it." }, 409, origin);
      }

      // A newly issued code invalidates every earlier unused code for this user and purpose.
      const { error: invalidateError } = await admin.from("account_deletion_verifications")
        .update({ consumed_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("purpose", purpose).is("consumed_at", null);
      if (invalidateError) return json({ error: "Could not refresh email verification. Please try again." }, 503, origin);
      const otp = randomOtp();
      const otpHash = await otpDigest(user.id, purpose, otp, key);
      const { error: insertError } = await admin.from("account_deletion_verifications").insert({
        user_id: user.id, requested_period: purpose === "delete" ? period : "permanent", purpose,
        otp_hash: otpHash, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (insertError) return json({ error: "Could not start email verification. Please try again." }, 503, origin);
      try {
        await sendOtp(user.email, otp, purpose, period || "permanent");
      } catch (error) {
        console.error("Account deletion OTP send failed:", error instanceof Error ? error.message : "unknown error");
        return json({ error: error instanceof Error ? error.message : "Could not send verification email." }, 503, origin);
      }
      return json({ success: true, message: `A verification code was sent to ${user.email}.`, request_id: requestId }, 200, origin);
    }

    const purpose = action === "confirm-reactivate-otp" ? "reactivate" : "delete";
    const otp = String(body.otp || "").trim();
    if (!/^\d{6}$/.test(otp)) return json({ error: "Enter the 6-digit code from your email." }, 400, origin);
    const { data: verification, error: verificationError } = await admin.from("account_deletion_verifications")
      .select("id,requested_period,otp_hash,expires_at,attempts,purpose,consumed_at")
      .eq("user_id", user.id).eq("purpose", purpose).is("consumed_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (verificationError) return json({ error: "Could not verify the code. Please try again." }, 503, origin);
    if (!verification || new Date(verification.expires_at).getTime() < Date.now() || verification.attempts >= 5) {
      return json({ error: "That code has expired or is no longer valid. Request a new code." }, 400, origin);
    }
    const candidate = await otpDigest(user.id, purpose, otp, key);
    if (candidate !== verification.otp_hash) {
      const { error: attemptUpdateError } = await admin.from("account_deletion_verifications")
        .update({ attempts: verification.attempts + 1 }).eq("id", verification.id).is("consumed_at", null);
      if (attemptUpdateError) return json({ error: "Could not record the verification attempt. Request a new code." }, 503, origin);
      return json({ error: "That code is incorrect. Check the email and try again." }, 400, origin);
    }
    const { data: consumedVerification, error: consumeError } = await admin
      .from("account_deletion_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", verification.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();
    if (consumeError) return json({ error: "Could not complete verification. Please try again." }, 503, origin);
    if (!consumedVerification) return json({ error: "That code has already been used. Request a new code if needed." }, 409, origin);

    if (purpose === "delete") {
      const now = new Date();
      const days = PERIOD_DAYS[verification.requested_period] || 14;
      const scheduledDays = Math.max(14, days);
      const scheduled = new Date(now.getTime() + scheduledDays * 24 * 60 * 60 * 1000);
      const recoveryUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const { data: request, error: createError } = await admin.from("dpdp_deletion_requests").insert({
        user_id: user.id,
        reason: "Account deletion confirmed by email OTP",
        status: "pending",
        requested_period: verification.requested_period,
        confirmed_at: now.toISOString(),
        requested_at: now.toISOString(),
        scheduled_delete_at: scheduled.toISOString(),
        recovery_until: recoveryUntil.toISOString(),
      }).select("id,status,requested_at,requested_period,scheduled_delete_at,recovery_until").single();
      if (createError) return json({ error: "Your code was verified, but the request could not be saved. Please contact support before retrying." }, 503, origin);
      return json({ success: true, request, message: "Your request is confirmed. You can cancel it with another email code during the 14-day recovery window." }, 200, origin);
    }

    const { data: pending, error: pendingError } = await admin.from("dpdp_deletion_requests").select("id,recovery_until,status")
      .eq("user_id", user.id).eq("status", "pending").order("requested_at", { ascending: false }).limit(1).maybeSingle();
    if (pendingError) return json({ error: "Could not load your deletion request." }, 503, origin);
    if (!pending || !pending.recovery_until || new Date(pending.recovery_until).getTime() < Date.now()) {
      return json({ error: "The recovery window has ended or the request is no longer active." }, 409, origin);
    }
    const now = new Date().toISOString();
    const { data: request, error: cancelError } = await admin.from("dpdp_deletion_requests").update({
      status: "cancelled", cancelled_at: now, resolved_at: now, resolution_note: "Cancelled by account owner after email OTP verification.",
    }).eq("id", pending.id).eq("status", "pending")
      .select("id,status,cancelled_at,resolution_note").maybeSingle();
    if (cancelError || !request) return json({ error: "Could not cancel the deletion request. Please refresh and try again." }, 503, origin);
    return json({ success: true, request, message: "Your deletion request has been cancelled." }, 200, origin);
  } catch (error) {
    console.error("Account deletion workflow failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Account deletion could not be completed. Please try again later." }, 500, origin);
  }
});
