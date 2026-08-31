import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);
function cors(origin: string | null) { return { 'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
function json(body: Record<string, unknown>, status: number, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } }); }
async function digest(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''); }

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
  try {
    const url = Deno.env.get('SUPABASE_URL')?.trim() || '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
    if (!url || !service) return json({ error: 'Supabase server configuration is missing.' }, 500, origin);
    const rawBody = await req.text();
    if (rawBody.length > 8192) return json({ error: 'Request is too large.' }, 413, origin);
    const body = JSON.parse(rawBody || '{}');
    const endpoint = String(body?.p_endpoint || '').trim();
    const p256dh = String(body?.p_p256dh || '').trim();
    const auth = String(body?.p_auth || '').trim();
    if (endpoint.length < 20 || endpoint.length > 2048 || p256dh.length < 20 || p256dh.length > 512 || auth.length < 10 || auth.length > 512) return json({ error: 'Invalid push subscription.' }, 400, origin);

    const admin = createClient(url, service);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    let userId: string | null = null;
    if (token) {
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (error || !user) return json({ error: 'Authentication failed. Please sign in again.' }, 401, origin);
      userId = user.id;
    }

    const rateKey = `push-register:${userId || await digest(endpoint)}`;
    const rate = await admin.rpc('consume_rate_limit', { p_rate_key: rateKey, p_limit: 10, p_window_seconds: 60 });
    if (rate.error) throw new Error(`Rate-limit check failed: ${rate.error.message}`);
    if (!rate.data) return json({ error: 'Too many notification registration attempts. Please wait a minute and try again.' }, 429, origin);

    const { data, error } = await admin.from('push_subscriptions').upsert({ user_id: userId, endpoint, p256dh, auth, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' }).select().single();
    if (error) throw new Error(`Push subscription registration failed: ${error.message}`);
    return json({ data }, 200, origin);
  } catch (error) {
    console.error('Push subscription registration failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Unable to register notifications.' }, 500, origin);
  }
});
