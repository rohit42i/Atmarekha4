import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);

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

function hexBytes(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmac(data: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function razorpayGet(path: string, keyId: string, keySecret: string) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.description || `Razorpay API error (${response.status}).`);
  return data;
}

function iso(unix: unknown) {
  const value = Number(unix);
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);

  try {
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim() || '';
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim() || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
    if (!secret || !keyId || !supabaseUrl || !service) return json({ error: 'Payment server configuration is incomplete.' }, 500, origin);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Authentication required. Please sign in again.' }, 401, origin);

    const admin = createClient(supabaseUrl, service);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: `Authentication failed: ${authError?.message || 'Invalid session.'}` }, 401, origin);

    const body = await req.json().catch(() => ({}));
    const paymentId = String(body?.razorpay_payment_id || '');
    const subscriptionId = String(body?.razorpay_subscription_id || '');
    const received = String(body?.razorpay_signature || '');
    if (!paymentId || !subscriptionId || !received) return json({ error: 'Missing Razorpay subscription verification fields.' }, 400, origin);

    const expected = await hmac(`${paymentId}|${subscriptionId}`, secret);
    const expectedBytes = hexBytes(expected);
    const receivedBytes = hexBytes(received);
    if (!expectedBytes || !receivedBytes || !safeEqual(expectedBytes, receivedBytes)) return json({ error: 'Subscription signature mismatch.' }, 400, origin);

    const { data: record, error: recordError } = await admin
      .from('user_subscriptions')
      .select('id,plan_id,provider_subscription_id,status')
      .eq('user_id', user.id)
      .eq('provider', 'razorpay')
      .eq('provider_subscription_id', subscriptionId)
      .maybeSingle();
    if (recordError) throw new Error(`Subscription lookup failed: ${recordError.message}`);
    if (!record) return json({ error: 'Subscription was not found for this account.' }, 400, origin);

    const remote = await razorpayGet(`/subscriptions/${encodeURIComponent(subscriptionId)}`, keyId, secret);
    if (!remote?.id || remote.id !== subscriptionId) return json({ error: 'Razorpay subscription could not be confirmed.' }, 502, origin);

    const remoteStatus = String(remote.status || '').toLowerCase();
    const activeStatuses = new Set(['authenticated', 'active']);
    if (!activeStatuses.has(remoteStatus)) return json({ error: `Razorpay subscription is not active yet (status: ${remoteStatus || 'unknown'}).` }, 400, origin);

    const { error: updateError } = await admin.from('user_subscriptions').update({
      status: 'active',
      provider: 'razorpay',
      current_period_start: iso(remote.current_start),
      current_period_end: iso(remote.current_end),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    }).eq('id', record.id);
    if (updateError) throw new Error(`Subscription activation failed: ${updateError.message}`);

    return json({ success: true, subscription_id: subscriptionId, plan_id: record.plan_id, current_period_end: iso(remote.current_end) }, 200, origin);
  } catch (error) {
    console.error('Razorpay subscription verification failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: error instanceof Error ? error.message : 'Unable to verify subscription.' }, 500, origin);
  }
});
