const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
const IMAGE_MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif',
};

function mimeFromKey(key) {
  const ext = key.split('.').pop()?.toLowerCase() || '';
  return IMAGE_MIME_BY_EXT[ext] || '';
}

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

function normalizeOrigin(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    return new URL(input).origin;
  } catch (_) {
    return input.replace(/\/+$/, '');
  }
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers') || '';
  const allowedOrigins = getAllowedOrigins(env);
  const allowOrigin = allowedOrigins.includes(normalizeOrigin(origin))
    ? origin
    : (allowedOrigins[0] || 'https://www.atmarekha.in');
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': requestedHeaders || 'Authorization, Accept, Content-Type, Cache-Control',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'ETag, Content-Type, Content-Length, Cache-Control',
    'Vary': 'Origin, Access-Control-Request-Headers',
  };
  return headers;
}

function getSupabaseApiKey(env) {
  return String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env),
    },
  });
}

function withCors(request, env, response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getBearer(request) {
  const value = request.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value : null;
}

async function getUser(request, env) {
  const authorization = getBearer(request);
  if (!authorization) return null;

  const apiKey = getSupabaseApiKey(env);
  if (!env.SUPABASE_URL || !apiKey) {
    throw new Error('PDPL media Worker is missing its Supabase API configuration.');
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: apiKey,
      Authorization: authorization,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

async function supabaseRows(env, authorization, table, query) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      apikey: getSupabaseApiKey(env),
      Authorization: authorization,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase authorization check failed (${response.status}).`);
  }

  return response.json();
}

async function isAdmin(user, request, env) {
  const authorization = getBearer(request);
  if (!authorization || !user?.id) return false;

  const rows = await supabaseRows(env, authorization, 'admins', {
    select: 'user_id',
    user_id: `eq.${user.id}`,
    limit: '1',
  });

  return Array.isArray(rows) && rows.length > 0;
}

async function hasMembership(user, request, env) {
  const authorization = getBearer(request);
  if (!authorization || !user?.id) return false;

  const rows = await supabaseRows(env, authorization, 'user_subscriptions', {
    select: 'plan_id,status,current_period_end',
    user_id: `eq.${user.id}`,
    status: 'in.(active,cancelled)',
  });

  const now = Date.now();

  return (rows || []).some(row => {
    if (!['supporter', 'premium'].includes(String(row?.plan_id || '').toLowerCase())) return false;

    const end = row.current_period_end
      ? new Date(row.current_period_end).getTime()
      : null;

    if (row.status === 'active') return end === null || end > now;

    return row.status === 'cancelled' && end !== null && end > now;
  });
}

function objectKey(request) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith('/media/')) return null;

  let key = '';
  try {
    key = decodeURIComponent(pathname.slice('/media/'.length));
  } catch (_) {
    return null;
  }

  if (
    !key ||
    key.length > 1024 ||
    key.includes('..') ||
    key.includes('\\') ||
    key.startsWith('/')
  ) {
    return null;
  }

  const cover = new RegExp(
    `^covers/chapters/${UUID_PATTERN}/[^/]+$`,
    'i',
  );

  const page = new RegExp(
    `^chapters/${UUID_PATTERN}/pages/[^/]+/[^/]+$`,
    'i',
  );

  const replacement = new RegExp(
    `^chapters/${UUID_PATTERN}/replacements/[^/]+$`,
    'i',
  );

  return cover.test(key) || page.test(key) || replacement.test(key)
    ? key
    : null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    try {
      const key = objectKey(request);
      if (!key) {
        return json(request, env, { error: 'Invalid media path.' }, 400);
      }

      const publicCover = request.method === 'GET' && /^covers\/chapters\//i.test(key);
      let user = null;
      let admin = false;
      if (!publicCover) {
        user = await getUser(request, env);
        if (!user) {
          return json(request, env, { error: 'Authentication required.' }, 401);
        }
        admin = await isAdmin(user, request, env);
      }

      if (request.method === 'GET') {
        if (!publicCover && !admin) {
          const chapterMatch = key.match(new RegExp(`^chapters/(${UUID_PATTERN})/(?:pages|replacements)/`, 'i'));
          const chapterId = chapterMatch?.[1] || '';
          if (!chapterId) return json(request, env, { error: 'Invalid chapter path.' }, 400);
          const rows = await supabaseRows(env, getBearer(request), 'pal_do_pal_ke_lamhe_chapters', {
            select: 'id,status',
            id: `eq.${chapterId}`,
            limit: '1',
          });
          if (!Array.isArray(rows) || String(rows[0]?.status || '').toLowerCase() !== 'published') {
            return json(request, env, { error: 'Media not available.' }, 404);
          }
          if (!(await hasMembership(user, request, env))) {
            return json(request, env, { error: 'Active PDPKL membership required.' }, 403);
          }
        }

        const cache = caches.default;
        const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
        const cached = await cache.match(cacheKey);
        if (cached) return withCors(request, env, cached);

        const object = await env.PDLPL_BUCKET.get(key);
        if (!object) {
          return json(request, env, { error: 'Media not found.' }, 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('ETag', object.httpEtag);
        headers.set('Cache-Control', publicCover ? 'public, max-age=86400, stale-while-revalidate=604800' : 'private, max-age=86400, stale-while-revalidate=604800');
        headers.set('Content-Disposition', 'inline');
        headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
        headers.set('X-Content-Type-Options', 'nosniff');

        const response = withCors(
          request,
          env,
          new Response(object.body, { headers }),
        );
        await cache.put(cacheKey, response.clone());
        return response;
      }

      if (!admin) {
        return json(request, env, { error: 'Admin access required.' }, 403);
      }

      if (request.method === 'PUT') {
        const declaredType = String(request.headers.get('Content-Type') || '').toLowerCase();
        const contentType = declaredType.startsWith('image/') ? declaredType : mimeFromKey(key);

        if (!contentType) {
          return json(request, env, { error: 'Only JPG, PNG, WEBP, GIF, BMP, and AVIF uploads are allowed.' }, 415);
        }

        const length = Number(request.headers.get('Content-Length') || 0);
        if (length > MAX_UPLOAD_BYTES) {
          return json(request, env, { error: 'Image is larger than 95 MB.' }, 413);
        }

        await env.PDLPL_BUCKET.put(key, request.body, {
          httpMetadata: {
            contentType,
            cacheControl: 'private, max-age=3600',
          },
        });

        return json(request, env, { ok: true, path: key });
      }

      if (request.method === 'DELETE') {
        await env.PDLPL_BUCKET.delete(key);
        return json(request, env, { ok: true, path: key });
      }

      return json(request, env, { error: 'Method not allowed.' }, 405);
    } catch (error) {
      return json(
        request,
        env,
        { error: error?.message || 'PDPL media operation failed.' },
        500,
      );
    }
  },
};

// Keep the PDPL media worker redeployed with the main application pipeline so its auth secret stays synchronized.
