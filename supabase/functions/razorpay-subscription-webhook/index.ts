import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function hexBytes(hex: string) { if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null; const b = new Uint8Array(hex.length / 2); for (let i = 0; i < b.length; i++) b[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16); return b; }
function safeEqual(a: Uint8Array, b: Uint8Array) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
async function hmac(body: string, secret: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)); return new Uint8Array(sig); }
function iso(unix?: number) { return unix ? new Date(unix * 1000).toISOString() : null; }

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secret || !supabaseUrl || !service) return new Response('Webhook configuration missing', { status: 500 });

    const raw = await req.text();
    const received = req.headers.get('x-razorpay-signature') || '';
    const expected = await hmac(raw, secret);
    const receivedBytes = hexBytes(received);
    if (!receivedBytes || !safeEqual(expected, receivedBytes)) return new Response('Invalid signature', { status: 400 });

    const event = JSON.parse(raw);
    const eventId = String(event?.account_id || '') + ':' + String(event?.created_at || '') + ':' + String(event?.event || '') + ':' + String(event?.payload?.subscription?.entity?.id || '');
    const admin = createClient(supabaseUrl, service);
    const { data: existing } = await admin.from('payment_events').select('id').eq('provider', 'razorpay').eq('event_id', eventId).maybeSingle();
    if (existing) return new Response('ok', { status: 200 });
    await admin.from('payment_events').insert({ provider: 'razorpay', event_id: eventId, event_type: event?.event || null, payload: event, processed_at: new Date().toISOString() });

    const entity = event?.payload?.subscription?.entity;
    if (!entity?.id) return new Response('ok', { status: 200 });
    const notes = entity.notes || {};
    const userId = notes.user_id;
    const planId = notes.plan_id;
    if (!userId || !planId) return new Response('ok', { status: 200 });

    const statusMap: Record<string, string> = {
      'subscription.authenticated': 'active',
      'subscription.activated': 'active',
      'subscription.charged': 'active',
      'subscription.completed': 'expired',
      'subscription.halted': 'failed',
      'subscription.paused': 'paused',
      'subscription.resumed': 'active',
      'subscription.cancelled': 'cancelled',
    };
    const status = statusMap[event?.event];
    if (status) {
      await admin.from('user_subscriptions').upsert({
        user_id: userId,
        plan_id: planId,
        provider: 'razorpay',
        provider_subscription_id: entity.id,
        status,
        current_period_start: iso(entity.current_start),
        current_period_end: iso(entity.current_end),
        cancel_at_period_end: Boolean(entity.remaining_count === 0 || entity.status === 'cancelled'),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('Razorpay webhook failed:', error instanceof Error ? error.message : 'unknown error');
    return new Response('Webhook error', { status: 500 });
  }
});
