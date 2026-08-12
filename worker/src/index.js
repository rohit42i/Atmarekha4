const ALLOWED_ORIGINS = new Set([
  'https://atmarekha.in',
  'https://www.atmarekha.in',
]);
const MAX_BYTES = 20 * 1024 * 1024;
const BUCKETS = new Map([
  ['covers', 'COVERS'],
  ['chapter-pages', 'CHAPTER_PAGES'],
]);
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://atmarekha.in',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Cache-Control',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) },
  });
}

function objectPath(url) {
  const match = new URL(url).pathname.match(/^\/storage\/v1\/object\/(?:public\/)?(covers|chapter-pages)\/(.+)$/);
  if (!match) return null;
  const bucket = match[1];
  const path = decodeURIComponent(match[2]);
  if (!path || path.includes('..') || path.startsWith('/') || path.length > 1024) return null;
  if (bucket === 'covers' && !path.startsWith('chapters/')) return null;
  if (bucket === 'chapter-pages' && !/^[0-9a-f-]+\/[^/]+\/\d{4}\.[a-z0-9]+$/i.test(path)) return null;
  return { bucket, path };
}

async function requireAdmin(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('Authentication required.');
  const token = header.slice(7).trim();
  if (!token) throw new Error('Authentication required.');

  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) throw new Error('Invalid or expired Supabase session.');
  const user = await userResponse.json();

  const adminResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!adminResponse.ok) throw new Error('Admin verification failed.');
  const admins = await adminResponse.json();
  if (!Array.isArray(admins) || !admins.length) throw new Error('Admin access required.');
  return user;
}

function binding(env, bucket) {
  const key = BUCKETS.get(bucket);
  return key ? env[key] : null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });

    const target = objectPath(request.url);
    if (!target) return json(request, { error: 'Invalid storage path.' }, 400);
    const store = binding(env, target.bucket);
    if (!store) return json(request, { error: 'Storage binding unavailable.' }, 500);

    if (request.method === 'GET' || request.method === 'HEAD') {
      const object = await store.get(target.path);
      if (!object) return new Response('Not found', { status: 404, headers: corsHeaders(request) });
      const headers = new Headers(corsHeaders(request));
      object.writeHttpMetadata(headers);
      headers.set('ETag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(request.method === 'HEAD' ? null : object.body, { headers });
    }

    if (request.method !== 'PUT' && request.method !== 'DELETE') return json(request, { error: 'Method not allowed.' }, 405);

    try {
      await requireAdmin(request, env);
    } catch (error) {
      return json(request, { error: error.message }, error.message.includes('required') ? 403 : 401);
    }

    if (request.method === 'DELETE') {
      await store.delete(target.path);
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > MAX_BYTES) return json(request, { error: 'Image exceeds the 20 MB limit.' }, 413);
    const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!MIME_TYPES.has(contentType)) return json(request, { error: 'Only JPEG, PNG, WebP and GIF images are allowed.' }, 415);

    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return json(request, { error: 'Image exceeds the 20 MB limit.' }, 413);

    await store.put(target.path, body, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
    return json(request, { ok: true, path: target.path });
  },
};
