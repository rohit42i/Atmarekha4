import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://www.atmarekha.in', 'https://atmarekha.in', 'http://localhost:5173']);
function cors(origin: string | null) { return { 'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
function json(body: Record<string, unknown>, status: number, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } }); }

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
  try {
    const url = Deno.env.get('SUPABASE_URL')?.trim() || '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
    if (!url || !service) return json({ error: 'Supabase server configuration is missing.' }, 500, origin);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Authentication required.' }, 401, origin);
    const admin = createClient(url, service);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Authentication failed.' }, 401, origin);
    const { data: isAdmin, error: adminError } = await admin.rpc('is_admin');
    if (adminError || !isAdmin) return json({ error: 'Admin access required.' }, 403, origin);
    const [profiles, push] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('push_subscriptions').select('user_id').not('user_id', 'is', null),
    ]);
    if (profiles.error) throw profiles.error;
    if (push.error) throw push.error;
    return json({ logged_in_users: Number(profiles.count || 0), notification_users: new Set((push.data || []).map(row => row.user_id).filter(Boolean)).size }, 200, origin);
  } catch (error) {
    console.error('Admin user stats failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Unable to load admin user statistics.' }, 500, origin);
  }
});
