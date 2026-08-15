import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);
const PLANS = {
  mini_member: { amount: 2900, name: 'Atma Rekha Mini Member' },
  supporter: { amount: 4900, name: 'Atma Rekha Member' },
  premium: { amount: 9900, name: 'Atma Rekha Premium Member' },
} as const;
type PlanId = keyof typeof PLANS;
function cors(origin: string | null) { return { 'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
function json(body: Record<string, unknown>, status: number, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } }); }
class RazorpayApiError extends Error { status: number; code: string; reason: string; constructor(status: number, description: string, code = '', reason = '') { super(description); this.name = 'RazorpayApiError'; this.status = status; this.code = code; this.reason = reason; } }
async function razorpay(path: string, method: string, keyId: string, keySecret: string, body?: unknown) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, { method, headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
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
Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim() || '';
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim() || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
    if (!keyId || !keySecret) return json({ error: 'Razorpay server keys are missing.' }, 500, origin);
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase server configuration is missing.' }, 500, origin);
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Authentication required.' }, 401, origin);
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: `Authentication failed: ${authError?.message || 'No user found.'}` }, 401, origin);
    const body = await req.json();
    const planId = String(body?.plan_id || '');
    const plan = PLANS[planId as PlanId];
    if (!plan) return json({ error: 'Invalid membership plan.' }, 400, origin);
    const razorpayPlanId = await findOrCreatePlan(plan, keyId, keySecret);
    const subscription = await razorpay('/subscriptions', 'POST', keyId, keySecret, { plan_id: razorpayPlanId, total_count: 120, quantity: 1, customer_notify: true, notes: { user_id: user.id, plan_id: planId, email: user.email || '' } });
    if (!subscription?.id) throw new Error('Razorpay created a subscription without returning an ID.');
    return json({ subscription_id: subscription.id, plan_id: planId, key_id: keyId }, 200, origin);
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      console.error('Razorpay API failure:', JSON.stringify({ status: error.status, code: error.code, reason: error.reason, description: error.message }));
      const status = error.status === 401 ? 401 : error.status >= 400 && error.status < 500 ? 400 : 502;
      return json({ error: error.message, code: error.code, reason: error.reason }, status, origin);
    }
    const message = error instanceof Error ? error.message : 'Unable to start membership checkout.';
    console.error('Razorpay subscription creation failed:', message);
    return json({ error: message }, 500, origin);
  }
});
