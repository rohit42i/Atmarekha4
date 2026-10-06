import { supabase } from './supabase';

export const PDLPL_MEDIA_WORKER_URL = (
  String(import.meta.env.VITE_PDLPL_MEDIA_WORKER_URL || 'https://pdlpl-media.rohitbaswaraj.workers.dev').trim()
    .replace(/\/+$/, '')
);

export function getPdlplMediaUrl(path) {
  const clean = String(path || '').trim().replace(/^\/+/, '');
  if (!clean) return '';
  const encoded = clean.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${PDLPL_MEDIA_WORKER_URL}/media/${encoded}`;
}

const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
const IMAGE_MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif',
};

function getImageMime(file) {
  const declared = String(file?.type || '').toLowerCase();
  if (declared.startsWith('image/')) return declared;
  const ext = String(file?.name || '').split('.').pop()?.toLowerCase() || '';
  return IMAGE_MIME_BY_EXT[ext] || '';
}

const encodePath = path =>
  String(path || '').split('/').map(segment => encodeURIComponent(segment)).join('/');

async function getAccessToken({ refresh = false } = {}) {
  const { data, error } = refresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();

  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error('Your Supabase session has expired. Please sign in again.');
  return token;
}

async function authHeaders(options = {}) {
  return {
    Authorization: `Bearer ${await getAccessToken(options)}`,
    Accept: 'application/json',
  };
}

function parseError(body, status) {
  const fallback = `PDPL media request failed (${status}).`;
  if (!body) return { message: fallback, payload: null };

  try {
    const payload = JSON.parse(body);
    return {
      message: payload?.error || payload?.message || fallback,
      payload,
    };
  } catch (_) {
    return { message: body, payload: null };
  }
}

function createMediaError(path, response, body) {
  const parsed = parseError(body, response.status);
  const error = new Error(parsed.message);
  error.status = response.status;
  error.statusText = response.statusText || '';
  error.path = path;
  error.url = response.url;
  error.responseBody = body || '';
  error.payload = parsed.payload;
  return error;
}

async function request(path, options = {}, retried = false) {
  const method = String(options.method || 'GET').toUpperCase();
  const url = `${PDLPL_MEDIA_WORKER_URL}/media/${encodePath(path)}`;
  const publicCover = method === 'GET' && /^covers\/chapters\//i.test(String(path || ''));
  const headers = { ...(options.headers || {}) };
  if (!publicCover) Object.assign(headers, await authHeaders({ refresh: retried }));

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (error) {
    const networkError = new Error(
      `Cloudflare R2 ${method} request failed: ${error?.message || error}. `
      + `This is usually a browser-to-Worker CORS/network failure; verify the deployed Worker allows origin "${window.location.origin}".`,
    );
    networkError.name = error?.name || 'NetworkError';
    networkError.path = path;
    networkError.url = url;
    networkError.origin = typeof window !== 'undefined' ? window.location.origin : '';
    networkError.hint = 'Check the PDPKL media Worker CORS allow-list and deployment. The Worker must return CORS headers on both preflight and error responses.';
    networkError.cause = error;
    throw networkError;
  }

  if (response.ok) return response;

  if (response.status === 401 && !retried) {
    return request(path, options, true);
  }

  const body = await response.text().catch(() => '');
  const parsed = parseError(body, response.status);
  const failure = new Error(`Cloudflare R2 ${method} request failed (HTTP ${response.status}) for "${path}": ${parsed.message}`);
  failure.name = 'PdlplMediaHttpError';
  failure.status = response.status;
  failure.statusText = response.statusText;
  failure.path = path;
  failure.url = url;
  failure.responseBody = body;
  failure.payload = parsed.payload;
  throw failure;
}

export async function fetchPdlplMedia(path, { signal } = {}) {
  const response = await request(path, { method: 'GET', signal });
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function uploadPdlplFile(file, path) {
  if (!(file instanceof File)) {
    throw new Error('Please select an image file.');
  }
  const imageMime = getImageMime(file);
  if (!imageMime) {
    throw new Error('Please select JPG, PNG, WEBP, GIF, BMP, or AVIF image files.');
  }
  if (file.size === 0) {
    throw new Error(`${file.name} is empty.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is larger than 95 MB.`);
  }

  await request(path, {
    method: 'PUT',
    headers: {
      'Content-Type': imageMime,
      'Cache-Control': 'private, max-age=3600',
    },
    body: file,
  });

  return path;
}

export async function removePdlplFiles(paths = []) {
  for (const path of paths.filter(Boolean)) {
    await request(path, { method: 'DELETE' });
  }
}
