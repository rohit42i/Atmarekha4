const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
const IMAGE_MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif',
};
const COMMUNITY_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const COMMUNITY_MIME_BY_EXT = {
  pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

function normalizeOrigin(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  try { return new URL(input).origin; } catch (_) { return input.replace(/\/+$/, ''); }
}
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(normalizeOrigin).filter(Boolean);
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowlist = allowedOrigins(env);
  const allowOrigin = allowlist.includes(normalizeOrigin(origin))
    ? origin
    : (allowlist[0] || 'https://www.atmarekha.in');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Authorization, Accept, Content-Type, Cache-Control',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'ETag, Content-Type, Content-Length, Cache-Control',
    'Vary': 'Origin, Access-Control-Request-Headers',
  };
}
function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env) } });
}
function withCors(request, env, response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function bearer(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth : null;
}
function apiKey(env) {
  return String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
}
function supabaseHeaders(env, authorization = null) {
  const key = apiKey(env);
  return { apikey: key, ...(authorization ? { Authorization: authorization } : {}), Accept: 'application/json' };
}
async function supabaseRows(env, table, query, authorization = null) {
  const url = new URL(`${String(env.SUPABASE_URL || '').replace(/\/$/, '')}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: supabaseHeaders(env, authorization) });
  if (!response.ok) throw new Error(`Supabase media authorization check failed (${response.status}).`);
  return response.json();
}
async function getUser(request, env) {
  const authorization = bearer(request);
  if (!authorization || !env.SUPABASE_URL || !apiKey(env)) return null;
  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/user`, { headers: supabaseHeaders(env, authorization) });
  if (!response.ok) return null;
  return response.json();
}
async function isAdmin(user, request, env) {
  if (!user?.id || !bearer(request)) return false;
  const rows = await supabaseRows(env, 'admins', { select: 'user_id', user_id: `eq.${user.id}`, limit: '1' }, bearer(request));
  return Array.isArray(rows) && rows.length > 0;
}
async function hasPaidAtmaMembership(user, request, env) {
  if (!user?.id || !bearer(request)) return false;
  const rows = await supabaseRows(env, 'user_subscriptions', {
    select: 'plan_id,status,current_period_end',
    user_id: `eq.${user.id}`,
    status: 'in.(active,cancelled)',
  }, bearer(request));
  const now = Date.now();
  return (rows || []).some(row => {
    if (!['mini_member', 'supporter', 'premium'].includes(String(row?.plan_id || '').toLowerCase())) return false;
    const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
    if (row.status === 'active') return end === null || end > now;
    return row.status === 'cancelled' && end !== null && end > now;
  });
}
function objectKey(request) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith('/storage/v1/object/public/')) return null;
  let key = '';
  try { key = decodeURIComponent(pathname.slice('/storage/v1/object/public/'.length)); } catch (_) { return null; }
  if (!key || key.length > 1024 || key.includes('..') || key.includes('\\') || key.startsWith('/')) return null;
  const cover = new RegExp(`^covers/chapters/${UUID_PATTERN}/[^/]+$`, 'i');
  const page = new RegExp(`^(?:chapter-pages/${UUID_PATTERN}/[^/]+/[^/]+|${UUID_PATTERN}/replacements/[^/]+)$`, 'i');
  const community = /^community\/[^/]+$/i.test(key);
  return cover.test(key) || page.test(key) || community.test(key) ? key : null;
}
function chapterIdFromKey(key) {
  const normal = key.match(new RegExp(`^chapter-pages/(${UUID_PATTERN})/`, 'i'));
  if (normal?.[1]) return normal[1];
  const replacement = key.match(new RegExp(`^(${UUID_PATTERN})/replacements/`, 'i'));
  return replacement?.[1] || null;
}
async function getChapter(env, chapterId, authorization = null) {
  const rows = await supabaseRows(env, 'chapters', { select: 'id,chapter_number,status', id: `eq.${chapterId}`, limit: '1' }, authorization);
  return Array.isArray(rows) ? rows[0] || null : null;
}
function isPublishedFreeChapter(chapter) {
  if (!chapter || String(chapter.status || '').toLowerCase() !== 'published') return false;
  const value = Number(chapter.chapter_number);
  return Number.isFinite(value) && value >= 1 && value <= 8;
}
async function authorizePage(request, env, key) {
  const chapterId = chapterIdFromKey(key);
  if (!chapterId) return { status: 400, message: 'Invalid chapter path.' };
  const authorization = bearer(request);
  const user = await getUser(request, env);
  const admin = user ? await isAdmin(user, request, env) : false;
  const chapter = await getChapter(env, chapterId, authorization);
  if (!chapter) return { status: 404, message: 'Media not available.' };
  if (admin) return { user, admin, chapter };
  if (isPublishedFreeChapter(chapter)) return { user, admin, chapter };
  if (!user) return { status: 401, message: 'Authentication required.' };
  if (String(chapter.status || '').toLowerCase() !== 'published') return { status: 404, message: 'Media not available.' };
  if (!(await hasPaidAtmaMembership(user, request, env))) return { status: 403, message: 'Active Atma Rekha membership required.' };
  return { user, admin, chapter };
}
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    try {
      const key = objectKey(request);
      if (!key) return json(request, env, { error: 'Invalid media path.' }, 400);
      const publicCover = /^covers\/chapters\//i.test(key);
      const communityMedia = /^community\/[^/]+$/i.test(key);
      const publicMedia = publicCover || communityMedia;
      if (request.method === 'GET' || request.method === 'HEAD') {
        if (!publicMedia) {
          const access = await authorizePage(request, env, key);
          if (access.status) return json(request, env, { error: access.message }, access.status);
        }
        const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
        const cached = await caches.default.match(cacheKey);
        if (cached) {
          return request.method === 'HEAD'
            ? new Response(null, { status: cached.status, headers: cached.headers })
            : withCors(request, env, cached);
        }
        const object = await env.MANGA_BUCKET.get(key);
        if (!object) return json(request, env, { error: 'Media not found.' }, 404);
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('ETag', object.httpEtag);
        headers.set('Cache-Control', publicMedia ? 'public, max-age=86400, stale-while-revalidate=604800' : 'private, max-age=86400, stale-while-revalidate=604800');
        const contentType = headers.get('Content-Type') || '';
        headers.set('Content-Disposition', communityMedia && !contentType.startsWith('image/') ? 'attachment' : 'inline');
        headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
        headers.set('X-Content-Type-Options', 'nosniff');
        const response = withCors(request, env, new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers }));
        await caches.default.put(cacheKey, response.clone());
        return response;
      }
      const user = await getUser(request, env);
      const admin = user ? await isAdmin(user, request, env) : false;
      if (!admin) return json(request, env, { error: 'Admin access required.' }, 403);
      if (request.method === 'PUT') {
        const communityMedia = /^community\/[^/]+$/i.test(key);
        const declaredType = String(request.headers.get('Content-Type') || '').toLowerCase();
        const ext = key.split('.').pop()?.toLowerCase() || '';
        const contentType = communityMedia ? (declaredType || COMMUNITY_MIME_BY_EXT[ext]) : (declaredType.startsWith('image/') ? declaredType : IMAGE_MIME_BY_EXT[ext]);
        if (!contentType) return json(request, env, { error: communityMedia ? 'Supported community attachment required.' : 'Supported image upload required.' }, 415);
        const length = Number(request.headers.get('Content-Length') || 0);
        if (!request.body) return json(request, env, { error: 'Empty upload body.' }, 400);
        const maxBytes = communityMedia ? COMMUNITY_MAX_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
        if (length > maxBytes) return json(request, env, { error: communityMedia ? 'Community attachment is larger than 15 MB.' : 'Image is larger than 95 MB.' }, 413);
        await env.MANGA_BUCKET.put(key, request.body, { httpMetadata: { contentType, cacheControl: communityMedia ? 'public, max-age=86400' : 'private, max-age=3600' } });
        return json(request, env, { ok: true, path: key });
      }
      if (request.method === 'DELETE') {
        await env.MANGA_BUCKET.delete(key);
        return json(request, env, { ok: true, path: key });
      }
      return json(request, env, { error: 'Method not allowed.' }, 405);
    } catch (error) {
      return json(request, env, { error: error?.message || 'Atma media operation failed.' }, 500);
    }
  },
};