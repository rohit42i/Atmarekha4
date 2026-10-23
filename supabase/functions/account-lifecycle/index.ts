import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://www.atmarekha.in", "https://atmarekha.in", "http://localhost:5173"]);
const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;

function headers(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}
function reply(origin: string | null, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}
function serviceKey() {
  const bundle = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { const parsed = JSON.parse(bundle); if (parsed?.default) return String(parsed.default).trim(); } catch {}
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
}
function clean(value: unknown, max = 160) { return String(value ?? "").trim().slice(0, max); }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function randomOtp() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0] % 1_000_000).padStart(6, "0");
}
async function hashOtp(requestId: string, otp: string, pepper: string) {
  const bytes = new TextEncoder().encode(requestId + ":" + otp + ":" + pepper);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "Atma Rekha <no-reply@atmarekha.in>";
  if (!apiKey) throw new Error("Email verification is temporarily unavailable. Please try again later.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    console.error("Account lifecycle email failed:", response.status, result?.name || "provider_error");
    throw new Error("We could not send the verification email. Check the address and try again.");
  }
}
function otpEmail(code: string, purpose: string) {
  const safePurpose = purpose.replace(/[&<>"]/g, "");
  return `<div style="font-family:Roboto,Arial,sans-serif;line-height:1.6;color:#111;background:#fff"><p>Hey, hi, hello, namaste!</p><p>Use this code to confirm your Atma Rekha ${safePurpose} request.</p><p style="font-size:30px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in ${OTP_TTL_MINUTES} minutes. Never share it with anyone.</p><p>If you did not request this, ignore this email and secure your account.</p><p>Atma Rekha</p></div>`;
}
async function verifyPassword(admin: any, url: string, user: any, password: string) {
  const anon = Deno.env.get("SUPABASE_ANON_KEY")?.trim() || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() || "";
  if (!anon) throw new Error("Password verification is temporarily unavailable.");
  const check = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await check.auth.signInWithPassword({ email: String(user.email || ""), password });
  if (error || data?.user?.id !== user.id) throw new Error("The password is incorrect.");
}
function publicRequest(row: any) {
  if (!row) return null;
  return {
    id: row.id, request_type: row.request_type, status: row.status,
    requested_at: row.created_at, otp_expires_at: row.status === "otp_pending" || row.status === "reactivation_pending" ? row.otp_expires_at : null,
    recovery_until: row.recovery_until, scheduled_delete_at: row.scheduled_delete_at,
    data_window_days: row.data_window_days, requested_email: row.requested_email || null,
    completed_at: row.completed_at, last_error: row.last_error ? "We need to review this request. Please contact support." : null,
  };
}
async function rateLimit(admin: any, userId: string, action: string, limit = 5) {
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_rate_key: "account-lifecycle:" + action + ":" + userId,
    p_limit: limit, p_window_seconds: 3600,
  });
  if (error) throw new Error("This account security action is temporarily unavailable.");
  if (data === false) throw new Error("Too many attempts. Please try again later.");
}
async function createOtpRequest(admin: any, user: any, type: string, fields: Record<string, unknown>, purpose: string) {
  const email = type === "email_change" ? String(fields.requested_email || "") : String(user.email || "");
  if (!email || !validEmail(email)) throw new Error("A valid email address is required.");
  const now = new Date();
  const otp = randomOtp();
  const id = crypto.randomUUID();
  const hash = await hashOtp(id, otp, serviceKey());
  const { data: row, error } = await admin.from("account_lifecycle_requests").insert({
    id, user_id: user.id, request_type: type, status: "otp_pending",
    requested_email: type === "email_change" ? email : null,
    current_email: user.email || null,
    data_window_days: fields.data_window_days ?? null,
    otp_hash: hash,
    otp_expires_at: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000).toISOString(),
    otp_sent_at: now.toISOString(),
    otp_attempts: 0,
    created_at: now.toISOString(), updated_at: now.toISOString(),
  }).select("*").single();
  if (error) {
    console.error("Account lifecycle request could not be created:", error.code || "database_error");
    throw new Error("A similar request is already in progress or could not be created. Refresh the page and try again.");
  }
  try {
    await sendEmail(email, "Your Atma Rekha verification code", otpEmail(otp, purpose));
  } catch (error) {
    await admin.from("account_lifecycle_requests").update({ status: "failed", otp_hash: null, updated_at: new Date().toISOString() }).eq("id", id);
    throw error;
  }
  return publicRequest(row);
}
async function cancelRazorpayRenewals(admin: any, userId: string) {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim() || "";
  const secret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim() || "";
  const { data: subscriptions, error } = await admin.from("user_subscriptions")
    .select("id,provider,provider_subscription_id,status,cancel_at_period_end")
    .eq("user_id", userId).eq("provider", "razorpay")
    .not("provider_subscription_id", "is", null);
  if (error) throw new Error("We could not check your recurring membership. Please contact support before retrying.");
  const active = (subscriptions || []).filter((s: any) => !["cancelled", "expired", "completed"].includes(String(s.status || "").toLowerCase()) && !s.cancel_at_period_end);
  if (!active.length) return;
  if (!keyId || !secret) throw new Error("Recurring membership could not be safely cancelled. Please contact support before deleting your account.");
  for (const row of active) {
    const response = await fetch("https://api.razorpay.com/v1/subscriptions/" + encodeURIComponent(row.provider_subscription_id) + "/cancel", {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(keyId + ":" + secret), "Content-Type": "application/json" },
      body: JSON.stringify({ cancel_at_cycle_end: ["active", "authenticated"].includes(String(row.status || "").toLowerCase()) }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("Recurring membership cancellation failed:", response.status, result?.error?.code || "provider_error");
      throw new Error("Your recurring membership could not be cancelled automatically. Please contact support before continuing.");
    }
    const { error: updateError } = await admin.from("user_subscriptions").update({ cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (updateError) throw new Error("Membership cancellation was accepted, but its status could not be saved. Please contact support.");
  }
}
async function eraseScope(admin: any, userId: string, days: number | null) {
  const { data, error } = await admin.rpc("erase_user_activity_window", { p_user_id: userId, p_days: days });
  if (error) {
    console.error("Activity erasure failed:", error.code || "database_error");
    throw new Error("We could not erase all selected activity. No success was reported; contact support for review.");
  }
  return data;
}
async function processOtpVerification(admin: any, user: any, body: any, url: string, origin: string | null) {
  const requestId = clean(body.request_id, 80);
  const otp = clean(body.otp, 6);
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !/^\d{6}$/.test(otp)) return reply(origin, { error: "Enter the six-digit code from your email." }, 422);
  const { data: row, error } = await admin.from("account_lifecycle_requests").select("*").eq("id", requestId).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Unable to load the verification request.");
  if (!row || !["otp_pending", "reactivation_pending"].includes(row.status)) return reply(origin, { error: "This code is no longer active. Start the request again." }, 409);
  if (!row.otp_expires_at || new Date(row.otp_expires_at).getTime() <= Date.now()) {
    const nextStatus = row.status === "reactivation_pending" ? "recovery_period" : "expired";
    await admin.from("account_lifecycle_requests").update({ status: nextStatus, otp_hash: null, otp_expires_at: null, otp_attempts: 0, updated_at: new Date().toISOString() }).eq("id", row.id);
    return reply(origin, { error: "This code has expired. Request a new one." }, 410);
  }
  if (Number(row.otp_attempts || 0) >= MAX_OTP_ATTEMPTS) {
    const nextStatus = row.status === "reactivation_pending" ? "recovery_period" : "expired";
    await admin.from("account_lifecycle_requests").update({ status: nextStatus, otp_hash: null, otp_expires_at: null, otp_attempts: 0, updated_at: new Date().toISOString() }).eq("id", row.id);
    return reply(origin, { error: "Too many incorrect codes. Start verification again." }, 429);
  }
  const expected = await hashOtp(row.id, otp, serviceKey());
  if (!await constantTimeEqual(String(row.otp_hash || ""), expected)) {
    const attempts = Number(row.otp_attempts || 0) + 1;
    const nextStatus = attempts >= MAX_OTP_ATTEMPTS
      ? (row.status === "reactivation_pending" ? "recovery_period" : "expired")
      : row.status;
    await admin.from("account_lifecycle_requests").update({
      otp_attempts: attempts >= MAX_OTP_ATTEMPTS ? 0 : attempts,
      status: nextStatus,
      otp_hash: attempts >= MAX_OTP_ATTEMPTS ? null : row.otp_hash,
      otp_expires_at: attempts >= MAX_OTP_ATTEMPTS ? null : row.otp_expires_at,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    return reply(origin, { error: attempts >= MAX_OTP_ATTEMPTS ? "Too many incorrect codes. Request a fresh code and try again." : "That code is incorrect. Check it and try again." }, attempts >= MAX_OTP_ATTEMPTS ? 429 : 422);
  }
  const now = new Date().toISOString();
  if (row.request_type === "account_deletion" && row.status === "reactivation_pending") {
    const { data: updated, error: updateError } = await admin.from("account_lifecycle_requests")
      .update({ status: "cancelled", otp_hash: null, otp_expires_at: null, cancelled_at: now, updated_at: now })
      .eq("id", row.id).eq("status", "reactivation_pending").select("*").single();
    if (updateError) throw new Error("We could not reactivate this account. Please refresh and try again.");
    await sendEmail(String(user.email), "Your Atma Rekha account is active again", "<p>Your account deletion request was cancelled after email verification. Your account remains active.</p>").catch(() => {});
    return reply(origin, { success: true, request: publicRequest(updated), message: "Your account is active again." });
  }
  if (row.request_type === "account_deletion") {
    await cancelRazorpayRenewals(admin, user.id);
    const recoveryUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: updated, error: updateError } = await admin.from("account_lifecycle_requests")
      .update({ status: "recovery_period", otp_hash: null, otp_expires_at: null, otp_verified_at: now, recovery_until: recoveryUntil, scheduled_delete_at: recoveryUntil, last_error: null, updated_at: now })
      .eq("id", row.id).eq("status", "otp_pending").select("*").single();
    if (updateError) throw new Error("Your request could not be confirmed. Please retry.");
    await sendEmail(String(user.email), "Your Atma Rekha account is scheduled for deletion", `<p>Your account is scheduled for permanent deletion after the 14-day recovery period, on ${new Date(recoveryUntil).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST.</p><p>To keep your account, sign in before this deadline and use the Reactivate account option. You must verify a fresh email code. Signing in alone does not cancel deletion.</p>`).catch(() => {});
    return reply(origin, { success: true, request: publicRequest(updated), message: "Deletion is scheduled. You have 14 days to reactivate with a new email code." });
  }
  if (row.request_type === "data_erasure") {
    const result = await eraseScope(admin, user.id, row.data_window_days ?? null);
    const { data: updated, error: updateError } = await admin.from("account_lifecycle_requests")
      .update({ status: "completed", otp_hash: null, otp_expires_at: null, otp_verified_at: now, completed_at: now, last_error: null, updated_at: now })
      .eq("id", row.id).select("*").single();
    if (updateError) throw new Error("Data was erased, but the completion status could not be recorded. Please contact support.");
    await sendEmail(String(user.email), "Atma Rekha data erasure completed", "<p>Your selected activity data has been erased or redacted. Your sign-in account, profile and billing records were kept. Billing and security records may be retained where required.</p>").catch(() => {});
    return reply(origin, { success: true, request: publicRequest(updated), result, message: "Selected activity data was erased. Your account remains active." });
  }
  if (row.request_type === "email_change") {
    const nextEmail = String(row.requested_email || "").trim();
    if (!validEmail(nextEmail)) throw new Error("The requested email address is invalid.");
    const { data: updatedUser, error: changeError } = await admin.auth.admin.updateUserById(user.id, { email: nextEmail, email_confirm: true });
    if (changeError || !updatedUser?.user) {
      console.error("Verified email change failed:", changeError?.code || "auth_error");
      throw new Error("The email address could not be changed. It may already be in use; your current email remains unchanged.");
    }
    await admin.from("email_change_requests").insert({ user_id: user.id, current_email: String(user.email || ""), requested_email: nextEmail, status: "verified", verified_at: now, closed_at: now });
    const { data: updated, error: updateError } = await admin.from("account_lifecycle_requests")
      .update({ status: "completed", otp_hash: null, otp_expires_at: null, otp_verified_at: now, completed_at: now, last_error: null, updated_at: now })
      .eq("id", row.id).select("*").single();
    if (updateError) throw new Error("The email was verified and changed, but the request status could not be recorded. Contact support.");
    await sendEmail(String(user.email), "Your Atma Rekha email was changed", `<p>The sign-in email for your Atma Rekha account was changed to ${nextEmail.replace(/&/g,"&amp;").replace(/</g,"&lt;")}.</p><p>If you did not make this change, contact support immediately.</p>`).catch(() => {});
    return reply(origin, { success: true, request: publicRequest(updated), message: "Your email address has been verified and changed." });
  }
  return reply(origin, { error: "This request type cannot be verified." }, 422);
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return reply(origin, { error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL")?.trim() || "";
  const key = serviceKey();
  if (!url || !key) return reply(origin, { error: "Account security service is not configured." }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const body = await req.json();
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return reply(origin, { error: "Authentication required." }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return reply(origin, { error: "Authentication failed." }, 401);
    const action = clean(body?.action, 50);
    if (action !== "status") await rateLimit(admin, user.id, action, action === "verify-otp" ? 15 : 5);

    if (action === "status") {
      const { data, error } = await admin.from("account_lifecycle_requests").select("*").eq("user_id", user.id)
        .in("status", ["otp_pending","recovery_period","reactivation_pending","processing","completed","failed"])
        .order("created_at", { ascending: false }).limit(10);
      if (error) throw new Error("Unable to load account security status.");
      return reply(origin, { requests: (data || []).map(publicRequest) });
    }
    if (action === "start-account-deletion") {
      const password = String(body?.password || "");
      if (!password || password.length > 1024) return reply(origin, { error: "Enter your current password." }, 422);
      await verifyPassword(admin, url, user, password);
      const days = body?.data_window_days === null || body?.data_window_days === undefined || body?.data_window_days === "permanent"
        ? null : Number(body.data_window_days);
      if (days !== null && ![7,30,90].includes(days)) return reply(origin, { error: "Choose 7, 30, 90 days, or permanent deletion." }, 422);
      const { data: existing, error } = await admin.from("account_lifecycle_requests").select("*").eq("user_id", user.id)
        .eq("request_type", "account_deletion").in("status", ["otp_pending","recovery_period","reactivation_pending"]).maybeSingle();
      if (error) throw new Error("Unable to check existing deletion requests.");
      if (existing?.status === "recovery_period") return reply(origin, { error: "A deletion request is already in its 14-day recovery period.", request: publicRequest(existing) }, 409);
      if (existing?.status === "otp_pending") {
        if (existing.otp_sent_at && Date.now() - new Date(existing.otp_sent_at).getTime() < RESEND_COOLDOWN_MS) return reply(origin, { error: "A code was just sent. Check your email before requesting another." }, 429);
        await admin.from("account_lifecycle_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", existing.id);
      }
      const request = await createOtpRequest(admin, user, "account_deletion", { data_window_days: days }, "account deletion");
      return reply(origin, { success: true, request, message: "A verification code was sent to your current email." }, 201);
    }
    if (action === "start-data-erasure") {
      const password = String(body?.password || "");
      if (!password || password.length > 1024) return reply(origin, { error: "Enter your current password." }, 422);
      await verifyPassword(admin, url, user, password);
      const days = body?.data_window_days === null || body?.data_window_days === undefined || body?.data_window_days === "permanent"
        ? null : Number(body.data_window_days);
      if (days !== null && ![7,30,90].includes(days)) return reply(origin, { error: "Choose 7, 30, 90 days, or permanent erasure." }, 422);
      const { data: active, error } = await admin.from("account_lifecycle_requests").select("id,otp_sent_at").eq("user_id", user.id)
        .eq("request_type", "data_erasure").eq("status", "otp_pending").maybeSingle();
      if (error) throw new Error("Unable to check existing data-erasure requests.");
      if (active?.otp_sent_at && Date.now() - new Date(active.otp_sent_at).getTime() < RESEND_COOLDOWN_MS) {
        return reply(origin, { error: "A code was just sent. Check your email before requesting another." }, 429);
      }
      if (active) await admin.from("account_lifecycle_requests").update({ status: "cancelled", otp_hash: null, otp_expires_at: null, updated_at: new Date().toISOString() }).eq("id", active.id);
      const request = await createOtpRequest(admin, user, "data_erasure", { data_window_days: days }, "data erasure");
      return reply(origin, { success: true, request, message: "A verification code was sent to your current email." }, 201);
    }
    if (action === "start-email-change") {
      const password = String(body?.password || "");
      const nextEmail = clean(body?.requested_email, 254).toLowerCase();
      if (!password || password.length > 1024) return reply(origin, { error: "Enter your current password." }, 422);
      if (!validEmail(nextEmail)) return reply(origin, { error: "Enter a valid new email address." }, 422);
      if (nextEmail.toLowerCase() === String(user.email || "").toLowerCase()) return reply(origin, { error: "That is already your current email address." }, 422);
      await verifyPassword(admin, url, user, password);
      let emailInUse = false;
      for (let page = 1; page <= 100; page++) {
        const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (usersError) throw new Error("Unable to verify the new email address.");
        const records = users?.users || [];
        if (records.some((entry: any) => entry.id !== user.id && String(entry.email || "").toLowerCase() === nextEmail)) {
          emailInUse = true;
          break;
        }
        if (records.length < 1000) break;
      }
      if (emailInUse) return reply(origin, { error: "That email address is already connected to an account." }, 409);
      const { data: active, error } = await admin.from("account_lifecycle_requests").select("id,otp_sent_at").eq("user_id", user.id)
        .eq("request_type", "email_change").eq("status", "otp_pending").maybeSingle();
      if (error) throw new Error("Unable to check email-change requests.");
      if (active && active.otp_sent_at && Date.now() - new Date(active.otp_sent_at).getTime() < RESEND_COOLDOWN_MS) return reply(origin, { error: "A code was just sent. Check your new email before requesting another." }, 429);
      if (active) await admin.from("account_lifecycle_requests").update({ status: "cancelled", otp_hash: null, updated_at: new Date().toISOString() }).eq("id", active.id);
      const request = await createOtpRequest(admin, user, "email_change", { requested_email: nextEmail }, "email change");
      return reply(origin, { success: true, request, message: "A verification code was sent to your new email address." }, 201);
    }
    if (action === "start-reactivation") {
      const requestId = clean(body?.request_id, 80);
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) return reply(origin, { error: "Refresh your deletion status and try again." }, 422);
      const { data: row, error } = await admin.from("account_lifecycle_requests").select("*")
        .eq("id", requestId).eq("user_id", user.id).eq("request_type", "account_deletion").eq("status", "recovery_period").maybeSingle();
      if (error) throw new Error("Unable to load your deletion request.");
      if (!row || !row.recovery_until || new Date(row.recovery_until).getTime() <= Date.now()) return reply(origin, { error: "The recovery period has ended. Contact support if you believe this is an error." }, 410);
      if (row.otp_sent_at && row.otp_hash && Date.now() - new Date(row.otp_sent_at).getTime() < RESEND_COOLDOWN_MS) return reply(origin, { error: "A reactivation code was just sent. Check your email." }, 429);
      const otp = randomOtp();
      const hash = await hashOtp(row.id, otp, key);
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await admin.from("account_lifecycle_requests").update({
        status: "reactivation_pending", otp_hash: hash, otp_expires_at: new Date(Date.now()+OTP_TTL_MINUTES*60_000).toISOString(),
        otp_sent_at: now, otp_attempts: 0, updated_at: now,
      }).eq("id", row.id).select("*").single();
      if (updateError) throw new Error("Unable to start account reactivation.");
      try { await sendEmail(String(user.email || ""), "Reactivate your Atma Rekha account", otpEmail(otp, "account reactivation")); }
      catch (error) { await admin.from("account_lifecycle_requests").update({ status:"recovery_period",otp_hash:null,otp_expires_at:null,updated_at:new Date().toISOString() }).eq("id",row.id); throw error; }
      return reply(origin, { success: true, request: publicRequest(updated), message: "A fresh reactivation code was sent to your email." }, 201);
    }
    if (action === "verify-otp") return await processOtpVerification(admin, user, body, url, origin);
    return reply(origin, { error: "Unknown account security action." }, 422);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The account security request failed.";
    console.error("Account lifecycle action failed:", message);
    return reply(origin, { error: message }, 400);
  }
});
