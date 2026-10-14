import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const R2_WORKER_URL = 'https://tiny-pond-c959.rohitbaswaraj.workers.dev';
const R2_BUCKETS = new Set(['chapter-pages', 'covers', 'community']);
const CHAPTER_PAGES_TABLE = 'chapter_pages';
const SUPABASE_REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(input, init = {}) {
  if (typeof AbortController === 'undefined') return fetch(input, init);
  const controller = new AbortController();
  const parentSignal = init?.signal;
  let timedOut = false;
  const forwardAbort = () => controller.abort(parentSignal.reason);
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else parentSignal.addEventListener('abort', forwardAbort, { once: true });
  }
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, SUPABASE_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error('Request timed out. Please check your connection and try again.');
      timeoutError.name = 'TimeoutError';
      timeoutError.cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener?.('abort', forwardAbort);
  }
}

// Upload original artwork directly. Browser canvas decoding can fail on valid Android-picked
// images and recompression can damage manga linework. Validate supported formats and size instead.
const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
const COMMUNITY_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const IMAGE_MIME_BY_EXT = Object.freeze({
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif',
});
const SUPPORTED_IMAGE_MIMES = new Set(Object.values(IMAGE_MIME_BY_EXT));
const COMMUNITY_ATTACHMENT_MIME_BY_EXT = Object.freeze({
  pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
});

export function isSupportedImageFile(file) {
  if (typeof File === 'undefined' || !(file instanceof File)) return false;
  const name = String(file.name || '');
  const hasExtension = /\\.[^.]+$/.test(name);
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (hasExtension) return Boolean(IMAGE_MIME_BY_EXT[ext]);
  return SUPPORTED_IMAGE_MIMES.has(String(file.type || '').toLowerCase());
}

function imageContentType(file, options = {}) {
  const name = String(file?.name || '');
  const hasExtension = /\\.[^.]+$/.test(name);
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (hasExtension) {
    const mapped = IMAGE_MIME_BY_EXT[ext];
    if (!mapped) {
      throw new Error('Unsupported image format. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.');
    }
    return mapped;
  }
  const declared = String(file?.type || options.contentType || '').toLowerCase().split(';')[0];
  if (SUPPORTED_IMAGE_MIMES.has(declared)) return declared;
  throw new Error('Unsupported image format. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.');
}

function communityContentType(file, options = {}) {
  const name = String(file?.name || '');
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const declared = String(file?.type || options.contentType || '').toLowerCase().split(';')[0];
  if (declared.startsWith('image/')) {
    if (!SUPPORTED_IMAGE_MIMES.has(declared) && !IMAGE_MIME_BY_EXT[ext]) {
      throw new Error('Unsupported image format. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.');
    }
    return IMAGE_MIME_BY_EXT[ext] || declared;
  }
  return COMMUNITY_ATTACHMENT_MIME_BY_EXT[ext] || declared || 'application/octet-stream';
}

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

const client = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, global: { fetch: fetchWithTimeout } },
);
const encodePath = path => String(path || '').split('/').map(encodeURIComponent).join('/');

function normalizeAtmaR2Path(bucket, path) {
  const clean = String(path || '').replace(/^\/+/, '');
  const hasPrefix = value => clean.toLowerCase().startsWith((value + '/').toLowerCase());

  // R2 object keys include the bucket prefix because the media Worker uses
  // one R2 bucket and routes by key prefix. Keep normalization idempotent:
  // upload() and publicPath() both normalize the same path.
  if (bucket === 'chapter-pages') {
    if (hasPrefix('chapter-pages')) return clean;

    // Convert the legacy admin uploader path into the canonical page key.
    const legacyPage = clean.match(/^chapters\/([0-9a-f-]{36})\/pages\/[^/]+-(\d+)\/(.+)$/i);
    if (legacyPage) return 'chapter-pages/' + legacyPage[1] + '/' + legacyPage[2] + '/' + legacyPage[3];

    // Legacy replacement pages are intentionally stored at the UUID root.
    if (/^[0-9a-f-]{36}\/replacements\/[^/]+$/i.test(clean)) return clean;

    // Admin cleanup extracts object paths without their bucket prefix.
    return 'chapter-pages/' + clean;
  }

  if (hasPrefix(bucket)) return clean;
  return bucket + '/' + clean;
}


async function authHeaders() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Your Supabase session has expired. Please sign in again.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export async function fetchAuthenticatedMedia(url, options = {}, retried = false) {
  let response;
  const controller = new AbortController();
  const parentSignal = options.signal;
  let timedOut = false;
  const forwardAbort = () => controller.abort(parentSignal.reason);
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else parentSignal.addEventListener('abort', forwardAbort, { once: true });
  }
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...(options.headers || {}), ...(await authHeaders()) },
    });
  } catch (error) {
    const failure = new Error(
      `Authenticated media request failed: ${error?.message || error}. Check the media Worker CORS/network configuration.`,
    );
    failure.name = timedOut ? 'TimeoutError' : (error?.name || 'NetworkError');
    if (timedOut) failure.message = 'Authenticated media request timed out. Please try again.';
    failure.url = url;
    failure.cause = error;
    throw failure;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener?.('abort', forwardAbort);
  }

  if (response.status === 401 && !retried) {
    const { error } = await client.auth.refreshSession();
    if (error) throw error;
    return fetchAuthenticatedMedia(url, options, true);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = '';
    try { message = JSON.parse(body)?.error || ''; } catch (_) {}
    throw new Error(message || `Authenticated media request failed (HTTP ${response.status}).`);
  }

  return response;
}

export async function fetchAuthenticatedMediaBlobUrl(url, options = {}) {
  const response = await fetchAuthenticatedMedia(url, options);
  return URL.createObjectURL(await response.blob());
}

export const cloudflareR2 = {
  from(bucket) {
    if (!R2_BUCKETS.has(bucket)) return client.storage.from(bucket);
    const publicPath = path => `${R2_WORKER_URL}/storage/v1/object/public/${encodePath(normalizeAtmaR2Path(bucket, path))}`;
    return {
      async upload(path, file, options = {}) {
        try {
          const storagePath = normalizeAtmaR2Path(bucket, path);
          if (!file || typeof file.size !== 'number') throw new Error('Please select a file to upload.');
          if (file.size <= 0) throw new Error(`${file.name || 'Selected file'} is empty.`);
          const maxBytes = bucket === 'community' ? COMMUNITY_MAX_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
          if (file.size > maxBytes) {
            throw new Error(bucket === 'community'
              ? 'Community attachments must be 15 MB or smaller.'
              : 'Images must be 95 MB or smaller.');
          }
          const contentType = bucket === 'community'
            ? communityContentType(file, options)
            : imageContentType(file, options);
          // Never decode or re-encode uploads in the browser. It fails on valid mobile files
          // and can reduce the quality of line art; the original file is uploaded unchanged.
          const response = await fetch(publicPath(storagePath), {
            method: 'PUT',
            headers: {
              ...(await authHeaders()),
              'Content-Type': contentType,
              'Cache-Control': `public, max-age=${options.cacheControl || '31536000'}`,
            },
            body: file,
          });
          if (!response.ok) {
            const text = await response.text();
            return { data: null, error: new Error(text || `R2 upload failed (${response.status})`) };
          }
          return { data: { path }, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      getPublicUrl(path) { return { data: { publicUrl: publicPath(path) } }; },
      async remove(paths) { const clean = (paths || []).filter(Boolean); try { const headers = await authHeaders(); for (const path of clean) { const response = await fetch(publicPath(path), { method: 'DELETE', headers }); if (!response.ok) { const text = await response.text(); return { data: null, error: new Error(text || `R2 delete failed (${response.status})`) }; } } return { data: clean.map(path => ({ name: path })), error: null }; } catch (error) { return { data: null, error }; } },
    };
  },
};

/**
 * The admin UI historically performs chapter-page replacement as two calls:
 * DELETE old rows, then INSERT new rows. Intercept those two operations and
 * route the actual replacement through the database transaction function.
 * This prevents a failed insert from ever leaving a published chapter empty.
 */
function chapterPagesTable() {
  const table = client.from(CHAPTER_PAGES_TABLE);
  return new Proxy(table, {
    get(target, property, receiver) {
      if (property === 'delete') {
        return () => ({
          eq: async (column, value) => {
            if (column === 'chapter_id') return { data: null, error: null };
            return target.delete().eq(column, value);
          },
        });
      }
      if (property === 'insert') {
        return rows => {
          const list = Array.isArray(rows) ? rows : [];
          if (list.length && list.every(row => row?.chapter_id && row?.page_number != null && typeof row?.image_url === 'string')) {
            const chapterId = list[0].chapter_id;
            if (!list.every(row => row.chapter_id === chapterId)) {
              return Promise.resolve({ data: null, error: new Error('All chapter pages must belong to the same chapter.') });
            }
            return client.rpc('replace_chapter_pages', {
              p_chapter_id: chapterId,
              p_pages: list.map(row => ({ page_number: row.page_number, image_url: row.image_url })),
            });
          }
          return target.insert(rows);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

export async function getPublicReaderTiers(userIds = []) {
  const ids = [...new Set((userIds || []).filter(Boolean))].slice(0, 50); if (!ids.length) return new Map();
  const { data, error } = await client.from('profiles').select('id,public_badge').in('id', ids); if (error) throw error;
  return new Map((data || []).filter(row => row?.id && ['mini_member','supporter','premium'].includes(row.public_badge)).map(row => [row.id, row.public_badge]));
}

/** Reads only rows allowed by user_subscriptions RLS; no privileged RPC is used. */
export async function getCurrentMemberships(userIds = []) {
  const ids = [...new Set((userIds || []).filter(Boolean))]; if (!ids.length) return new Map();
  const { data, error } = await client.from('user_subscriptions').select('user_id,plan_id,status,current_period_end').in('user_id', ids).in('status', ['active', 'cancelled']);
  if (error) throw error;
  const now = Date.now();
  const rows = (data || []).filter(row => {
    const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
    if (row.status === 'active') return end === null || end > now;
    return row.status === 'cancelled' && end !== null && end > now;
  }).sort((a, b) => { const rank = id => ({ premium: 3, supporter: 2, mini_member: 1, free: 0 }[id] || 0); return rank(b.plan_id) - rank(a.plan_id); });
  return new Map(rows.filter(row => row?.user_id && row?.plan_id).map(row => [row.user_id, row.plan_id]));
}

export async function getCurrentMembership(userId) { if (!userId) return null; return (await getCurrentMemberships([userId])).get(userId) || null; }
export async function getCurrentlySubscribedUserIds(userIds = []) { return new Set((await getCurrentMemberships(userIds)).keys()); }
export async function isCurrentlySubscribed(userId) { return Boolean(await getCurrentMembership(userId)); }

function promiseCompatibleRpc(builder) {
  if (!builder || typeof builder !== 'object') return builder;
  return new Proxy(builder, {
    get(target, property) {
      if (property === 'catch') {
        return onRejected => Promise.resolve(target).catch(onRejected);
      }
      if (property === 'finally') {
        return onFinally => Promise.resolve(target).finally(onFinally);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export const supabase = new Proxy(client, {
  get(target, property) {
    if (property === 'storage') return cloudflareR2;
    if (property === 'from') return table => table === CHAPTER_PAGES_TABLE ? chapterPagesTable() : client.from(table);
    if (property === 'rpc') return (...args) => promiseCompatibleRpc(client.rpc(...args));

    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

export async function secureSignInWithPassword(email, password) {
  const normalizedEmail = String(email || '').trim();
  const value = String(password || '');

  if (!normalizedEmail || !value) {
    throw Object.assign(new Error('Invalid email or password.'), {
      code: 'INVALID_LOGIN',
      status: 401,
    });
  }
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Sign-in service is temporarily unavailable.');
  }

  const { data, error } = await client.functions.invoke('secure-password-login', {
    body: { email: normalizedEmail, password: value },
  });

  if (error) {
    let payload = null;
    try {
      if (error.context?.clone) {
        const clone = error.context.clone();
        payload = await clone.json();
      } else if (typeof error.context?.json === 'function') {
        payload = await error.context.json();
      }
    } catch (_) {}

    const message = payload?.error || (error.message === 'Failed to send a request to the Edge Function' ? 'Sign-in service is temporarily unavailable.' : error.message);
    const authError = new Error(message || 'Invalid email or password.');
    authError.code = payload?.code || 'INVALID_LOGIN';
    authError.status = payload?.code === 'ACCOUNT_LOCKED' ? 429 : (error.status || 401);
    authError.lockedUntil = payload?.locked_until || null;
    throw authError;
  }

  if (!data?.ok || !data?.session?.access_token || !data?.session?.refresh_token) {
    const authError = new Error(data?.error || 'Invalid email or password.');
    authError.code = data?.code || 'INVALID_LOGIN';
    authError.status = data?.code === 'ACCOUNT_LOCKED' ? 429 : 401;
    authError.lockedUntil = data?.locked_until || null;
    throw authError;
  }

  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) throw sessionError;
  return { data: sessionData, error: null };
}

