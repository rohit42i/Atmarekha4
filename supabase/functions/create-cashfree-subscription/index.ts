import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://www.atmarekha.in", "https://atmarekha.in", "http://localhost:5173"]);
const CASHFREE_VERSION = Deno.env.get("CASHFREE_API_VERSION") || "2025-01-01";
const CASHFREE_ENV = (Deno.env.get("CASHFREE_ENVIRONMENT") || "sandbox").toLowerCase();
const CASHFREE_BASE = CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
const PLAN_IDS: Record<string, string> = { mini_member: "atma_mini_29_v1", supporter: "atma_supporter_49_v1", premium: "atma_premium_99_v1" };
function cors(origin: string | null) { return { "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" }; }
function json(body: Record<string, unknown>, status: number, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } }); }
function getPublicKey() { const direct = Deno.env.get("SUPABASE_ANON_KEY"); if (direct) return direct; return ""; }
function cashfreeHeaders(requestId?: string, idempotencyKey?: string) { const h: Record<string, string> = { accept: "application/json", "content-type": "application/json", "x-api-version": CASHFREE_VERSION, "x-client-id": Deno.env.get("CASHFREE_CLIENT_ID") || "", "x-client-secret": Deno.env.get("CASHFREE_CLIENT_SECRET") || "" }; if (requestId) h["x-request-id"] = requestId; if (idempotencyKey) h["x-idempotency-key"] = idempotencyKey; return h; }
async function cashfree(path: string, method: string, body?: unknown, requestId?: string, idempotencyKey?: string) { const r = await fetch(`${CASHFREE_BASE}${path}`, { method, headers: cashfreeHeaders(requestId, idempotencyKey), ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const d = await r.json().catch(() => null); if (!r.ok) throw new Error(`Cashfree ${method} ${path} failed (${r.status}): ${d?.message || d?.type || "Unknown Cashfree error"}`); return d; }
Deno.serve(async req => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  try {
    const clientId = Deno.env.get("CASHFREE_CLIENT_ID") || "", clientSecret = Deno.env.get("CASHFREE_CLIENT_SECRET") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "", publicKey = getPublicKey(), serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!clientId || !clientSecret) return json({ error: "Cashfree server credentials are missing." }, 500, origin);
    if (!supabaseUrl || !publicKey || !serviceRole) return json({ error: "Supabase server configuration is incomplete." }, 500, origin);
    const authHeader = req.headers.get("Authorization"); if (!authHeader) return json({ error: "Authentication required." }, 401, origin);
    const authClient = createClient(supabaseUrl, publicKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(); if (authError || !user) return json({ error: "Authentication failed." }, 401, origin);
    const admin = createClient(supabaseUrl, serviceRole);
    const body = await req.json().catch(() => ({})); const planId = String(body?.plan_id || ""); const phone = String(body?.phone || "").replace(/\D/g, "");
    if (!PLAN_IDS[planId]) return json({ error: "Invalid membership plan." }, 400, origin);
    if (!/^\d{10,15}$/.test(phone)) return json({ error: "Enter a valid mobile number for UPI AutoPay." }, 400, origin);
    const { data: plan, error: planError } = await admin.from("subscription_plans").select("id,name,amount_inr,interval,active").eq("id", planId).eq("active", true).maybeSingle();
    if (planError || !plan) return json({ error: "This membership plan is unavailable." }, 400, origin);
    if (plan.interval !== "month" || !Number(plan.amount_inr)) return json({ error: "This plan is not configured as a monthly membership." }, 400, origin);
    const { data: existing } = await admin.from("user_subscriptions").select("id,plan_id,status,provider_subscription_id,provider_session_id,current_period_end,updated_at,cancel_at_period_end").eq("user_id", user.id).maybeSingle();
    if (existing?.status === "active" && existing.current_period_end && new Date(existing.current_period_end).getTime() > Date.now()) return json({ error: "You already have an active membership." }, 409, origin);
    if (existing?.status === "pending" && existing.provider_session_id && Date.now() - new Date(existing.updated_at || 0).getTime() < 15 * 60 * 1000) return json({ subscription_id: existing.provider_subscription_id, subscription_session_id: existing.provider_session_id, plan_id: existing.plan_id, environment: CASHFREE_ENV }, 200, origin);
    const cashfreePlanId = PLAN_IDS[planId];
    const planCheck = await fetch(`${CASHFREE_BASE}/plans/${encodeURIComponent(cashfreePlanId)}`, { headers: cashfreeHeaders() });
    if (!planCheck.ok) {
      const created = await cashfree("/plans", "POST", { plan_id: cashfreePlanId, plan_name: `Atma Rekha ${plan.name}`, plan_type: "PERIODIC", plan_currency: "INR", plan_recurring_amount: Number(plan.amount_inr), plan_max_amount: Number(plan.amount_inr), plan_max_cycles: 120, plan_intervals: 1, plan_interval_type: "MONTH", plan_note: `${plan.name} monthly membership` }, crypto.randomUUID(), crypto.randomUUID());
      if (created?.plan_status && created.plan_status !== "ACTIVE") throw new Error("Cashfree membership plan is not active.");
    } else {
      const remote = await planCheck.json().catch(() => null);
      if (remote?.plan_status && remote.plan_status !== "ACTIVE") throw new Error("Cashfree membership plan is not active.");
      if (Number(remote?.plan_recurring_amount) !== Number(plan.amount_inr)) throw new Error("Cashfree plan amount does not match the Atma Rekha membership price.");
    }
    const subscriptionId = `atma_${planId}_${user.id.replaceAll("-", "").slice(0, 12)}_${Date.now()}`;
    const subscription = await cashfree("/subscriptions", "POST", { subscription_id: subscriptionId, customer_details: { customer_name: String(user.user_metadata?.full_name || user.email?.split("@")[0] || "Atma Rekha Reader").slice(0, 100), customer_email: user.email || "", customer_phone: phone }, plan_details: { plan_id: cashfreePlanId, plan_name: `Atma Rekha ${plan.name}`, plan_type: "PERIODIC" }, authorization_details: { authorization_amount: 1, authorization_amount_refund: true, payment_methods: ["upi"] }, subscription_meta: { return_url: `${supabaseUrl}/functions/v1/cashfree-subscription-return`, notification_channel: ["EMAIL"] }, subscription_expiry_time: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(), subscription_tags: { user_id: user.id, plan_id: planId, psp_note: "Atma Rekha membership" } }, crypto.randomUUID(), crypto.randomUUID());
    if (!subscription?.subscription_session_id || !subscription?.subscription_id) throw new Error("Cashfree did not return a subscription session.");
    const { error: saveError } = await admin.from("user_subscriptions").upsert({ user_id: user.id, plan_id: planId, provider: "cashfree", provider_subscription_id: subscription.subscription_id, provider_session_id: subscription.subscription_session_id, status: "pending", current_period_start: null, current_period_end: null, cancel_at_period_end: false, preferred_upi_flow: "upi", updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) throw new Error(`Could not save membership state: ${saveError.message}`);
    return json({ subscription_id: subscription.subscription_id, subscription_session_id: subscription.subscription_session_id, plan_id: planId, environment: CASHFREE_ENV }, 200, origin);
  } catch (error) { const message = error instanceof Error ? error.message : "Unable to start membership checkout."; console.error("Cashfree subscription creation failed:", message); return json({ error: message }, 500, origin); }
});
