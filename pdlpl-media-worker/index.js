const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const headers = {
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Cache-Control',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
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

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
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
      apikey: env.SUPABASE_ANON_KEY,
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
    if (!row?.plan_id || String(row.plan_id).toLowerCase() === 'free') return false;

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

    const key = objectKey(request);
    if (!key) {
      return json(request, env, { error: 'Invalid media path.' }, 400);
    }

    const user = await getUser(request, env);
    if (!user) {
      return json(request, env, { error: 'Authentication required.' }, 401);
    }

    try {
      const admin = await isAdmin(user, request, env);

      if (request.method === 'GET') {
        if (!admin && !(await hasMembership(user, request, env))) {
          return json(request, env, { error: 'Active membership required.' }, 403);
        }

        const object = await env.PDLPL_BUCKET.get(key);
        if (!object) {
          return json(request, env, { error: 'Media not found.' }, 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('ETag', object.httpEtag);
        headers.set('Cache-Control', 'private, max-age=3600');
        headers.set('Content-Disposition', 'inline');
        headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
        headers.set('X-Content-Type-Options', 'nosniff');

        return withCors(
          request,
          env,
          new Response(object.body, { headers }),
        );
      }

      if (!admin) {
        return json(request, env, { error: 'Admin access required.' }, 403);
      }

      if (request.method === 'PUT') {
        const contentType = request.headers.get('Content-Type') || '';

        if (!contentType.startsWith('image/')) {
          return json(request, env, { error: 'Only image uploads are allowed.' }, 415);
        }

        const length = Number(request.headers.get('Content-Length') || 0);
        if (length > MAX_UPLOAD_BYTES) {
          return json(request, env, { error: 'Image is larger than 20 MB.' }, 413);
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
