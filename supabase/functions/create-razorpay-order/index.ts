import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);
function corsHeaders(origin: string | null) { const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in'; return { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
function json(body: Record<string, unknown>, status: number, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }); }

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim() || '';
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim() || '';
    const url = Deno.env.get('SUPABASE_URL')?.trim() || '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
    if (!keyId || !keySecret || !url || !service) return json({ error: 'Razorpay server configuration is missing.' }, 500, origin);

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Authentication required. Please sign in again.' }, 401, origin);
    const admin = createClient(url, service);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Authentication failed. Please sign in again.' }, 401, origin);

    const rate = await admin.rpc('consume_rate_limit', { p_rate_key: `razorpay-order:${user.id}`, p_limit: 10, p_window_seconds: 60 });
    if (rate.error) throw new Error(`Rate-limit check failed: ${rate.error.message}`);
    if (!rate.data) return json({ error: 'Too many payment attempts. Please wait a minute and try again.' }, 429, origin);

    const rawBody = await req.text();
    if (rawBody.length > 8192) return json({ error: 'Request is too large.' }, 413, origin);
    const body = JSON.parse(rawBody || '{}');
    const amount = Number(body?.amount);
    const currency = String(body?.currency || 'INR').toUpperCase();
    const receipt = body?.receipt ? String(body.receipt) : `atma_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    if (!Number.isInteger(amount) || amount < 100) return json({ error: 'Amount must be an integer of at least 100 paise.' }, 400, origin);
    if (amount > 50_000_000) return json({ error: 'Amount exceeds Razorpay standard transaction limits.' }, 400, origin);
    if (currency !== 'INR') return json({ error: 'Only INR orders are supported.' }, 400, origin);
    if (receipt.length > 40) return json({ error: 'Receipt must be 40 characters or fewer.' }, 400, origin);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency, receipt, capture: 'automatic', notes: { user_id: user.id } }),
    });
    const result = await response.json().catch(() => null);
    if (response.status === 401) return json({ error: 'Razorpay authentication failed. Check the server API keys.' }, 401, origin);
    if (!response.ok) return json({ error: result?.error?.description || 'Razorpay could not create the order.' }, 502, origin);
    return json({ order_id: result.id, amount: result.amount, currency: result.currency }, 200, origin);
  } catch (error) {
    console.error('Razorpay order creation failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Unable to create Razorpay order.' }, 500, origin);
  }
});
