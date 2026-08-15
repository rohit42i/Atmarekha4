import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);
function ch(o: string | null) { return { 'Access-Control-Allow-Origin': o && ORIGINS.has(o) ? o : 'https://www.atmarekha.in', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
function json(b: Record<string, unknown>, s: number, o: string | null) { return new Response(JSON.stringify(b), { status: s, headers: { ...ch(o), 'Content-Type': 'application/json' } }); }

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: ch(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID'); const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!keyId || !secret || !url || !anon || !service) return json({ error: 'Payment server configuration is incomplete.' }, 500, origin);
    const authHeader = req.headers.get('Authorization'); if (!authHeader) return json({ error: 'Authentication required.' }, 401, origin);
    const auth = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await auth.auth.getUser(); if (!user) return json({ error: 'Authentication required.' }, 401, origin);
    const body = await req.json(); const subscriptionId = String(body?.subscription_id || '');
    if (!subscriptionId) return json({ error: 'Subscription ID is required.' }, 400, origin);
    const admin = createClient(url, service);
    const { data: record } = await admin.from('user_subscriptions').select('id,provider_subscription_id').eq('user_id', user.id).eq('provider_subscription_id', subscriptionId).maybeSingle();
    if (!record) return json({ error: 'Subscription not found.' }, 404, origin);
    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${keyId}:${secret}`)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ cancel_at_cycle_end: 1 }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) return json({ error: data?.error?.description || 'Unable to cancel Razorpay subscription.' }, response.status === 401 ? 401 : 500, origin);
    await admin.from('user_subscriptions').update({ cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq('id', record.id);
    return json({ ok: true }, 200, origin);
  } catch (error) { console.error('Razorpay cancellation failed:', error instanceof Error ? error.message : 'unknown error'); return json({ error: 'Unable to cancel membership.' }, 500, origin); }
});
