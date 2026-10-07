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

// Manga pages keep a wider quality envelope to preserve line texture, hatching and small text.
const IMAGE_MIN_SIZE = 2 * 1024 * 1024;
const IMAGE_MAX_SIZE = 4 * 1024 * 1024;
const IMAGE_MAX_EDGE = 3200;

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
  if (bucket !== 'chapter-pages') return clean;
  const match = clean.match(/^chapters\/([0-9a-f-]{36})\/pages\/[^/]+-(\d+)\/(.+)$/i);
  if (!match) return clean;
  return `chapter-pages/${match[1]}/${match[2]}/${match[3]}`;
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

const blobFromCanvas = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode this image.')), type, quality);
});

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) {}
  }
  return await new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The selected image could not be decoded.')); };
    image.src = url;
  });
}

async function supportsWebP() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  return new Promise(resolve => canvas.toBlob(blob => resolve(Boolean(blob)), 'image/webp', 0.9));
}

async function compressImage(file) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) return file;
  const image = await decodeImage(file); const sourceWidth = image.width; const sourceHeight = image.height; const longestEdge = Math.max(sourceWidth, sourceHeight);
  if (file.size <= IMAGE_MIN_SIZE && longestEdge <= IMAGE_MAX_EDGE) { image.close?.(); return file; }
  const outputType = await supportsWebP() ? 'image/webp' : 'image/jpeg'; let scale = Math.min(1, IMAGE_MAX_EDGE / longestEdge);
  try {
    for (let dimensionPass = 0; dimensionPass < 7; dimensionPass += 1) {
      const width = Math.max(1, Math.round(sourceWidth * scale)); const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { alpha: outputType === 'image/webp' }); if (!context) throw new Error('Canvas encoding is unavailable in this browser.');
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(image, 0, 0, width, height);
      let low = 0.45; let high = 0.98; let best = null;
      for (let i = 0; i < 10; i += 1) { const quality = (low + high) / 2; const blob = await blobFromCanvas(canvas, outputType, quality); if (blob.size <= IMAGE_MAX_SIZE) { best = blob; low = quality; } else high = quality; }
      const highest = await blobFromCanvas(canvas, outputType, 0.98); if (highest.size <= IMAGE_MAX_SIZE) best = highest;
      if (best) return new File([best], file.name.replace(/\.(png|jpe?g|gif|bmp|avif)$/i, '.webp'), { type: outputType, lastModified: file.lastModified });
      scale *= 0.86;
    }
  } finally { image.close?.(); }
  throw new Error(`${file.name} could not be compressed below 4 MB while preserving acceptable quality.`);
}

export const cloudflareR2 = {
  from(bucket) {
    if (!R2_BUCKETS.has(bucket)) return client.storage.from(bucket);
    const publicPath = path => `${R2_WORKER_URL}/storage/v1/object/public/${encodePath(normalizeAtmaR2Path(bucket, path))}`;
    return {
      async upload(path, file, options = {}) { try { const storagePath = normalizeAtmaR2Path(bucket, path); const processedFile = await compressImage(file); const response = await fetch(publicPath(storagePath), { method: 'PUT', headers: { ...(await authHeaders()), 'Content-Type': processedFile?.type || options.contentType || file?.type || 'application/octet-stream', 'Cache-Control': `public, max-age=${options.cacheControl || '31536000'}` }, body: processedFile }); if (!response.ok) { const text = await response.text(); return { data: null, error: new Error(text || `R2 upload failed (${response.status})`) }; } return { data: { path }, error: null }; } catch (error) { return { data: null, error }; } },
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
  return new Map((data || []).filter(row => row?.id && (row.public_badge === 'premium' || row.public_badge === 'supporter')).map(row => [row.id, row.public_badge]));
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