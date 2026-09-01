import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function hexBytes(hex: string) { if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null; const bytes = new Uint8Array(hex.length / 2); for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16); return bytes; }
function safeEqual(a: Uint8Array, b: Uint8Array) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]; return diff === 0; }
async function hmac(body: string, secret: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)); return new Uint8Array(signature); }
async function sha256Hex(body: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)); return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''); }
function iso(unix: unknown) { const value = Number(unix); return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null; }
function fallbackPeriodEnd(startIso: string | null) { const base = startIso ? new Date(startIso).getTime() : Date.now(); return new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString(); }

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')?.trim() || ''; const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || ''; const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
    if (!secret || !supabaseUrl || !service) return new Response('Webhook configuration missing', { status: 500 });
    const raw = await req.text(); const received = req.headers.get('x-razorpay-signature') || ''; const expected = await hmac(raw, secret); const receivedBytes = hexBytes(received);
    if (!receivedBytes || !safeEqual(expected, receivedBytes)) return new Response('Invalid signature', { status: 400 });
    let event: any;
    try { event = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
    const eventName = String(event?.event || '');
    const headerEventId = req.headers.get('x-razorpay-event-id')?.trim() || '';
    const eventId = headerEventId || `body:${await sha256Hex(raw)}`;
    const admin = createClient(supabaseUrl, service); const { data: existing } = await admin.from('payment_events').select('id').eq('provider', 'razorpay').eq('event_id', eventId).maybeSingle(); if (existing) return new Response('ok', { status: 200 });
    const entity = event?.payload?.subscription?.entity; const subscriptionId = entity?.id ? String(entity.id) : '';
    const mappedStatus: Record<string, string> = { 'subscription.authenticated': 'active', 'subscription.activated': 'active', 'subscription.charged': 'active', 'subscription.updated': String(entity?.status || 'active'), 'subscription.pending': 'pending', 'subscription.completed': 'expired', 'subscription.halted': 'failed', 'subscription.paused': 'paused', 'subscription.resumed': 'active', 'subscription.cancelled': 'cancelled' };
    let incomingStatus = mappedStatus[eventName];
    if (eventName === 'subscription.updated') {
      const remoteStatus = String(entity?.status || '').toLowerCase();
      incomingStatus = remoteStatus === 'cancelled' ? 'cancelled' : remoteStatus || 'active';
    }
    if (subscriptionId && incomingStatus) {
      const { data: record } = await admin.from('user_subscriptions').select('id,current_period_start,current_period_end,status').eq('provider', 'razorpay').eq('provider_subscription_id', subscriptionId).maybeSingle();
      if (record) {
        const incomingStart = iso(entity.current_start) || record.current_period_start || null;
        const incomingEnd = iso(entity.current_end);
        const periodEnd = incomingEnd || record.current_period_end || fallbackPeriodEnd(incomingStart);
        const endMs = new Date(periodEnd).getTime();
        const periodStillActive = Number.isFinite(endMs) && endMs > Date.now();
        // Cancellation must never revoke access before the paid period ends.
        const status = incomingStatus === 'cancelled' && periodStillActive ? 'active' : incomingStatus;
        const cancelAtPeriodEnd = incomingStatus === 'cancelled' || Number(entity.remaining_count) === 0 || entity.status === 'cancelled';
        const { error: updateError } = await admin.from('user_subscriptions').update({ status, provider: 'razorpay', current_period_start: incomingStart, current_period_end: periodEnd, cancel_at_period_end: cancelAtPeriodEnd, updated_at: new Date().toISOString() }).eq('id', record.id);
        if (updateError) throw new Error(`Subscription update failed: ${updateError.message}`);
      }
    }
    const { error: eventError } = await admin.from('payment_events').insert({ provider: 'razorpay', event_id: eventId, event_type: eventName || null, payload: event, processed_at: new Date().toISOString() });
    if (eventError && eventError.code !== '23505') throw new Error(`Unable to persist Razorpay event: ${eventError.message}`);
    return new Response('ok', { status: 200 });
  } catch (error) { console.error('Razorpay webhook failed:', error instanceof Error ? error.message : 'unknown error'); return new Response('Webhook error', { status: 500 }); }
});
