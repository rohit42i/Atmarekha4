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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);
// Must match Membership.jsx and subscription_plans table
const PLANS = {
  mini_member: { amount: 1900, name: 'Atma Rekha Supporter' },
  supporter: { amount: 2900, name: 'Atma Rekha Premium Supporter' },
  premium: { amount: 4900, name: 'Atma Rekha Super Supporter' },
} as const;
type PlanId = keyof typeof PLANS;

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
function json(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });
}
class RazorpayApiError extends Error {
  status: number; code: string; reason: string;
  constructor(status: number, description: string, code = '', reason = '') {
    super(description); this.status = status; this.code = code; this.reason = reason;
  }
}
async function razorpay(path: string, method: string, keyId: string, keySecret: string, body?: unknown) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new RazorpayApiError(response.status, data?.error?.description || `Razorpay API error (${response.status}).`, data?.error?.code || '', data?.error?.reason || '');
  return data;
}
async function findOrCreatePlan(plan: { amount: number; name: string }, keyId: string, keySecret: string) {
  const plans = await razorpay('/plans?count=100', 'GET', keyId, keySecret);
  const existing = plans?.items?.find((item: any) => item?.period === 'monthly' && item?.interval === 1 && Number(item?.item?.amount) === plan.amount && item?.item?.currency === 'INR' && item?.item?.name === plan.name);
  if (existing?.id) return existing.id;
  const created = await razorpay('/plans', 'POST', keyId, keySecret, { period: 'monthly', interval: 1, item: { name: plan.name, amount: plan.amount, currency: 'INR', description: `${plan.name} monthly membership` } });
  if (!created?.id) throw new Error('Razorpay did not return a plan ID.');
  return created.id;
}

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

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);

  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim() || '';
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim() || '';
    const url = Deno.env.get('SUPABASE_URL')?.trim() || '';
    const service = readSupabaseServiceRoleKey();
    if (!keyId || !keySecret) return json({ error: 'Razorpay server keys are missing.' }, 500, origin);
    if (!url || !service) return json({ error: 'Supabase server configuration is missing.' }, 500, origin);

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Authentication required. Please sign in again.' }, 401, origin);

    const admin = createClient(url, service);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Authentication failed. Please sign in again.' }, 401, origin);

    const rate = await admin.rpc('consume_rate_limit', { p_rate_key: `razorpay-subscription:${user.id}`, p_limit: 5, p_window_seconds: 60 });
    if (rate.error) throw new Error(`Rate-limit check failed: ${rate.error.message}`);
    if (!rate.data) return json({ error: 'Too many membership attempts. Please wait a minute and try again.' }, 429, origin);

    const rawBody = await readLimitedBody(req, 8192);
    if (rawBody === null) return json({ error: 'Request body is too large.' }, 413, origin);
    let body: any = {};
    try { body = JSON.parse(rawBody || '{}'); } catch { return json({ error: 'Invalid request body.' }, 400, origin); }
    const planId = String(body?.plan_id || '') as PlanId;
    const plan = PLANS[planId];
    if (!plan) return json({ error: 'Invalid membership plan.' }, 400, origin);

    const lock = await admin.rpc('lock_user_subscription_creation', { p_user_id: user.id });
    if (lock.error) throw new Error(`Subscription lock failed: ${lock.error.message}`);

    const { data: existingRows, error: lookupError } = await admin
      .from('user_subscriptions')
      .select('id,plan_id,status,provider,provider_subscription_id,current_period_end')
      .eq('user_id', user.id)
      .in('status', ['pending', 'active', 'paused', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (lookupError) throw new Error(`Subscription lookup failed: ${lookupError.message}`);

    const rows = existingRows || [];
    const now = Date.now();
    const activeExisting = rows.find(row => row.status === 'active' || (row.status === 'cancelled' && row.current_period_end && new Date(row.current_period_end).getTime() > now));
    if (activeExisting) return json({ error: 'You already have an active membership.', subscription_id: activeExisting.provider_subscription_id || null, plan_id: activeExisting.plan_id }, 409, origin);

    // Never reuse an old Razorpay subscription. Always create a fresh subscription for the selected plan.
    const razorpayPlanId = await findOrCreatePlan(plan, keyId, keySecret);
    const subscription = await razorpay('/subscriptions', 'POST', keyId, keySecret, {
      plan_id: razorpayPlanId,
      total_count: 120,
      quantity: 1,
      customer_notify: true,
      notes: { user_id: user.id, plan_id: planId, email: user.email || '' },
    });
    if (!subscription?.id) throw new Error('Razorpay created a subscription without returning an ID.');

    const periodStart = subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : null;
    let periodEnd = subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null;
    if (!periodEnd) {
      const base = periodStart ? new Date(periodStart).getTime() : Date.now();
      periodEnd = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const row = {
      user_id: user.id,
      plan_id: planId,
      provider: 'razorpay',
      provider_subscription_id: subscription.id,
      status: 'pending',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };

    // user_subscriptions has one row per user. Update the existing row when present;
    // only insert when the user has no subscription row yet.
    const existingRow = rows[0];
    const save = existingRow?.id
      ? await admin.from('user_subscriptions').update(row).eq('id', existingRow.id).eq('user_id', user.id)
      : await admin.from('user_subscriptions').insert(row);
    if (save.error) {
      // Avoid leaving an untracked subscription in Razorpay when persistence fails.
      // If compensation also fails, emit the provider ID in server logs for manual recovery.
      try {
        await razorpay(`/subscriptions/${encodeURIComponent(subscription.id)}/cancel`, 'POST', keyId, keySecret, { cancel_at_cycle_end: false });
      } catch (cancelError) {
        console.error('Could not cancel Razorpay subscription after database persistence failed.', {
          subscriptionId: subscription.id,
          error: cancelError instanceof Error ? cancelError.message : 'unknown cancellation error',
        });
      }
      throw new Error(`Subscription record creation failed: ${save.error.message}`);
    }

    return json({ subscription_id: subscription.id, plan_id: planId, key_id: keyId, amount: plan.amount, name: plan.name }, 200, origin);
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      console.error('Razorpay API failure:', JSON.stringify({ status: error.status, code: error.code, reason: error.reason, description: error.message }));
      const status = error.status === 401 ? 401 : error.status >= 400 && error.status < 500 ? 400 : 502;
      return json({ error: error.status === 401 ? 'Membership checkout is temporarily unavailable. Please try again later.' : 'Razorpay could not start membership checkout. Please try again.' }, status, origin);
    }
    console.error('Razorpay subscription creation failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Unable to start membership checkout. Please try again.' }, 500, origin);
  }
});
