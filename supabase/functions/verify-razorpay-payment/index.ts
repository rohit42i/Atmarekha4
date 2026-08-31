import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);
function corsHeaders(origin: string | null) { const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in'; return { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
function json(body: Record<string, unknown>, status: number, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }); }
function hexToBytes(hex: string) { if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null; const bytes = new Uint8Array(hex.length / 2); for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16); return bytes; }
function timingSafeEqual(a: Uint8Array, b: Uint8Array) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]; return diff === 0; }
async function createSignature(orderId: string, paymentId: string, secret: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${orderId}|${paymentId}`)); return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join(''); }
async function razorpay(path: string, keyId: string, keySecret: string) { const response = await fetch(`https://api.razorpay.com/v1${path}`, { headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` } }); const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error?.description || `Razorpay API error (${response.status}).`); return data; }

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim() || '';
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim() || '';
    const url = Deno.env.get('SUPABASE_URL')?.trim() || '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
    if (!keyId || !secret || !url || !service) return json({ error: 'Payment verification server configuration is missing.' }, 500, origin);

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Authentication required. Please sign in again.' }, 401, origin);
    const admin = createClient(url, service);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Authentication failed. Please sign in again.' }, 401, origin);

    const rate = await admin.rpc('consume_rate_limit', { p_rate_key: `razorpay-payment-verify:${user.id}`, p_limit: 10, p_window_seconds: 60 });
    if (rate.error) throw new Error(`Rate-limit check failed: ${rate.error.message}`);
    if (!rate.data) return json({ error: 'Too many verification attempts. Please wait a minute and try again.' }, 429, origin);

    const rawBody = await req.text();
    if (rawBody.length > 8192) return json({ error: 'Request is too large.' }, 413, origin);
    const body = JSON.parse(rawBody || '{}');
    const paymentId = String(body?.razorpay_payment_id || '');
    const orderId = String(body?.razorpay_order_id || '');
    const receivedSignature = String(body?.razorpay_signature || '');
    if (!paymentId || !orderId || !receivedSignature) return json({ error: 'Missing Razorpay payment verification fields.' }, 400, origin);

    const expectedSignature = await createSignature(orderId, paymentId, secret);
    const expectedBytes = hexToBytes(expectedSignature);
    const receivedBytes = hexToBytes(receivedSignature);
    if (!expectedBytes || !receivedBytes || !timingSafeEqual(expectedBytes, receivedBytes)) return json({ error: 'Payment signature mismatch.' }, 400, origin);

    const [order, payment] = await Promise.all([
      razorpay(`/orders/${encodeURIComponent(orderId)}`, keyId, secret),
      razorpay(`/payments/${encodeURIComponent(paymentId)}`, keyId, secret),
    ]);
    if (!order?.id || order.id !== orderId) return json({ error: 'Razorpay order could not be verified.' }, 400, origin);
    if (!payment?.id || payment.id !== paymentId || payment.order_id !== orderId) return json({ error: 'Razorpay payment does not belong to this order.' }, 400, origin);
    if (payment.status !== 'captured') return json({ error: 'Payment has not been captured.' }, 400, origin);
    if (Number(payment.amount) !== Number(order.amount) || payment.currency !== order.currency) return json({ error: 'Payment amount or currency does not match the order.' }, 400, origin);
    const orderUserId = String(order?.notes?.user_id || '');
    if (orderUserId && orderUserId !== user.id) return json({ error: 'This payment belongs to another account.' }, 403, origin);

    return json({ success: true, razorpay_payment_id: paymentId, razorpay_order_id: orderId, amount: Number(payment.amount), currency: payment.currency, status: payment.status }, 200, origin);
  } catch (error) {
    console.error('Razorpay payment verification failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Unable to verify Razorpay payment.' }, 500, origin);
  }
});
