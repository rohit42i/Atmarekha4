import { supabase } from './supabase';

export const PDLPL_MEDIA_WORKER_URL =
  import.meta.env.VITE_PDLPL_MEDIA_WORKER_URL ||
  'https://pdlpl-media.rohitbaswaraj.workers.dev';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

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
  if (!body) return fallback;

  try {
    const payload = JSON.parse(body);
    return payload?.error || payload?.message || fallback;
  } catch (_) {
    return body;
  }
}

async function request(path, options = {}, retried = false) {
  const headers = {
    ...(options.headers || {}),
    ...(await authHeaders({ refresh: retried })),
  };

  const response = await fetch(
    `${PDLPL_MEDIA_WORKER_URL}/media/${encodePath(path)}`,
    { ...options, headers },
  );

  if (response.ok) return response;

  if (response.status === 401 && !retried) {
    return request(path, options, true);
  }

  const body = await response.text().catch(() => '');
  throw new Error(parseError(body, response.status));
}

export async function fetchPdlplMedia(path, { signal } = {}) {
  const response = await request(path, { method: 'GET', signal });
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function uploadPdlplFile(file, path) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }
  if (file.size === 0) {
    throw new Error(`${file.name} is empty.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is larger than 20 MB.`);
  }

  await request(path, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
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
