import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);
function cors(origin: string | null) { return { 'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
function json(body: Record<string, unknown>, status: number, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } }); }
function hexBytes(hex: string) { if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null; const b = new Uint8Array(hex.length / 2); for (let i = 0; i < b.length; i++) b[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16); return b; }
function safeEqual(a: Uint8Array, b: Uint8Array) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
async function hmac(data: string, secret: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)); return Array.from(new Uint8Array(sig), x => x.toString(16).padStart(2, '0')).join(''); }

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
  try {
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secret || !supabaseUrl || !anon || !service) return json({ error: 'Payment server configuration is incomplete.' }, 500, origin);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required.' }, 401, origin);
    const authClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: 'Authentication required.' }, 401, origin);

    const body = await req.json();
    const paymentId = String(body?.razorpay_payment_id || '');
    const subscriptionId = String(body?.razorpay_subscription_id || '');
    const received = String(body?.razorpay_signature || '');
    if (!paymentId || !subscriptionId || !received) return json({ error: 'Missing Razorpay subscription verification fields.' }, 400, origin);

    const expected = await hmac(`${paymentId}|${subscriptionId}`, secret);
    const expectedBytes = hexBytes(expected); const receivedBytes = hexBytes(received);
    if (!expectedBytes || !receivedBytes || !safeEqual(expectedBytes, receivedBytes)) return json({ error: 'Subscription signature mismatch.' }, 400, origin);

    const admin = createClient(supabaseUrl, service);
    const { data: record } = await admin.from('user_subscriptions').select('id,plan_id,provider_subscription_id').eq('user_id', user.id).eq('provider_subscription_id', subscriptionId).maybeSingle();
    if (!record) return json({ error: 'Subscription was not found for this account.' }, 400, origin);

    await admin.from('user_subscriptions').update({ status: 'active', provider: 'razorpay', updated_at: new Date().toISOString() }).eq('id', record.id);
    return json({ success: true, subscription_id: subscriptionId, plan_id: record.plan_id }, 200, origin);
  } catch (error) {
    console.error('Razorpay subscription verification failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Unable to verify subscription.' }, 500, origin);
  }
});
