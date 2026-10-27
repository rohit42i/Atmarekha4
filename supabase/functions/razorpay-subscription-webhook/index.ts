import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


async function readLimitedBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
function hexBytes(hex: string) { if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null; const bytes = new Uint8Array(hex.length / 2); for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16); return bytes; }
function safeEqual(a: Uint8Array, b: Uint8Array) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]; return diff === 0; }
async function hmac(body: string, secret: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)); return new Uint8Array(signature); }
async function sha256Hex(body: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)); return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''); }
function iso(unix: unknown) { const value = Number(unix); return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null; }
function fallbackPeriodEnd(startIso: string | null, isAnnual = false) { const end = new Date(startIso || Date.now()); if (isAnnual) end.setUTCFullYear(end.getUTCFullYear() + 1); else end.setUTCDate(end.getUTCDate() + 30); return end.toISOString(); }

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
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')?.trim() || ''; const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || ''; const service = readSupabaseServiceRoleKey();
    if (!secret || !supabaseUrl || !service) return new Response('Webhook configuration missing', { status: 500 });
    const raw = await readLimitedBody(req, 1024 * 1024); if (raw === null) return new Response('Payload too large', { status: 413 }); const received = req.headers.get('x-razorpay-signature') || ''; const expected = await hmac(raw, secret); const receivedBytes = hexBytes(received);
    if (!receivedBytes || !safeEqual(expected, receivedBytes)) return new Response('Invalid signature', { status: 400 });
    let event: any;
    try { event = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
    const eventName = String(event?.event || '');
    const headerEventId = req.headers.get('x-razorpay-event-id')?.trim() || '';
    const eventId = headerEventId || `body:${await sha256Hex(raw)}`;
    const admin = createClient(supabaseUrl, service);
    const { data: existing, error: existingError } = await admin.from('payment_events').select('id')
      .eq('provider', 'razorpay').eq('event_id', eventId).maybeSingle();
    if (existingError) throw new Error(`Could not check Razorpay event idempotency: ${existingError.message}`);
    if (existing) return new Response('ok', { status: 200 });
    const entity = event?.payload?.subscription?.entity; const subscriptionId = entity?.id ? String(entity.id) : '';
    const mappedStatus: Record<string, string> = { 'subscription.authenticated': 'active', 'subscription.activated': 'active', 'subscription.charged': 'active', 'subscription.updated': String(entity?.status || 'active'), 'subscription.pending': 'pending', 'subscription.completed': 'expired', 'subscription.halted': 'failed', 'subscription.paused': 'paused', 'subscription.resumed': 'active', 'subscription.cancelled': 'cancelled' };
    let incomingStatus = mappedStatus[eventName];
    if (eventName === 'subscription.updated') {
      const remoteStatus = String(entity?.status || '').toLowerCase();
      incomingStatus = remoteStatus === 'cancelled' ? 'cancelled' : remoteStatus || 'active';
    }
    if (subscriptionId && incomingStatus) {
      const { data: record, error: recordError } = await admin.from('user_subscriptions')
        .select('id,plan_id,current_period_start,current_period_end,status')
        .eq('provider', 'razorpay').eq('provider_subscription_id', subscriptionId).maybeSingle();
      if (recordError) throw new Error(`Razorpay subscription lookup failed: ${recordError.message}`);
      // Do not persist/acknowledge an event before the local subscription row exists.
      // Returning 500 lets Razorpay retry after subscription creation finishes.
      if (!record) throw new Error('Razorpay subscription record not found for webhook event.');
      if (record) {
        const incomingStart = iso(entity.current_start) || record.current_period_start || null;
        const incomingEnd = iso(entity.current_end);
        const periodEnd = incomingEnd || record.current_period_end || fallbackPeriodEnd(incomingStart, record.plan_id === 'premium_yearly');
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
