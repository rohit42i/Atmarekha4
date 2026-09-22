import { supabase } from './supabase';

export const PDLPL_MEDIA_WORKER_URL =
  import.meta.env.VITE_PDLPL_MEDIA_WORKER_URL ||
  'https://pdlpl-media.rohitbaswaraj.workers.dev';

const encodePath = path =>
  String(path || '').split('/').map(segment => encodeURIComponent(segment)).join('/');

async function authHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Your Supabase session has expired. Please sign in again.');
  return { Authorization: `Bearer ${token}` };
}

async function request(path, options = {}) {
  const response = await fetch(
    `${PDLPL_MEDIA_WORKER_URL}/media/${encodePath(path)}`,
    { ...options, headers: { ...(options.headers || {}), ...(await authHeaders()) } },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `PDPL media request failed (${response.status}).`);
  }

  return response;
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
  if (file.size > 20 * 1024 * 1024) {
    throw new Error(`${file.name} is larger than 20 MB.`);
  }

  await request(path, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
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
