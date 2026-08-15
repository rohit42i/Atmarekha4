import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);
const PLANS = {
  mini_member: { amount: 2900, name: 'Atma Rekha Mini Member' },
  supporter: { amount: 4900, name: 'Atma Rekha Member' },
  premium: { amount: 9900, name: 'Atma Rekha Premium Member' },
} as const;

type PlanId = keyof typeof PLANS;

function headers(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
function json(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(origin), 'Content-Type': 'application/json' } });
}

async function razorpay(path: string, method: string, keyId: string, keySecret: string, body?: unknown) {
  const auth = btoa(`${keyId}:${keySecret}`);
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.description || `Razorpay API error (${response.status}).`);
  return data;
}

async function findOrCreatePlan(plan: { amount: number; name: string }, keyId: string, keySecret: string) {
  const plans = await razorpay('/plans?count=100', 'GET', keyId, keySecret);
  const existing = plans?.items?.find((item: any) =>
    item?.period === 'monthly' && item?.interval === 1 && item?.item?.amount === plan.amount && item?.item?.currency === 'INR' && item?.item?.name === plan.name
  );
  if (existing) return existing.id;
  const created = await razorpay('/plans', 'POST', keyId, keySecret, {
    period: 'monthly', interval: 1,
    item: { name: plan.name, amount: plan.amount, currency: 'INR', description: `${plan.name} monthly membership` },
  });
  return created.id;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headers(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);

  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!keyId || !keySecret || !supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return json({ error: 'Payment server configuration is incomplete.' }, 500, origin);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required.' }, 401, origin);
    const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: 'Authentication required.' }, 401, origin);

    const body = await req.json();
    const planId = String(body?.plan_id || '') as PlanId;
    const plan = PLANS[planId];
    if (!plan) return json({ error: 'Invalid membership plan.' }, 400, origin);

    const razorpayPlanId = await findOrCreatePlan(plan, keyId, keySecret);
    const subscription = await razorpay('/subscriptions', 'POST', keyId, keySecret, {
      plan_id: razorpayPlanId,
      total_count: 120,
      quantity: 1,
      customer_notify: true,
      notes: { user_id: user.id, plan_id: planId, email: user.email || '' },
    });

    const admin = createClient(supabaseUrl, serviceRoleKey);
    await admin.from('user_subscriptions').upsert({
      user_id: user.id,
      plan_id: planId,
      status: 'pending',
      provider: 'razorpay',
      provider_subscription_id: subscription.id,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return json({ subscription_id: subscription.id, plan_id: planId, key_id: keyId }, 200, origin);
  } catch (error) {
    console.error('Razorpay subscription creation failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: error instanceof Error ? error.message : 'Unable to start membership checkout.' }, 500, origin);
  }
});
