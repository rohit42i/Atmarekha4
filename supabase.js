import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const R2_WORKER_URL = (import.meta.env.VITE_R2_WORKER_URL || 'https://tiny-pond-c959.rohitbaswaraj.workers.dev').replace(/\/$/, '');
const R2_BUCKETS = new Set(['chapter-pages', 'covers']);

const client = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const encodePath = path => String(path || '').split('/').map(encodeURIComponent).join('/');

async function authHeaders() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Your Supabase session has expired. Please sign in again.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function fetchWithRetry(url, options, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, cache: 'no-store' });
      if (response.ok || (response.status >= 400 && response.status < 500)) return response;
      lastError = new Error(`Worker request failed (${response.status})`);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError || new Error('Worker request failed.');
}

const r2Storage = {
  from(bucket) {
    if (!R2_BUCKETS.has(bucket)) return client.storage.from(bucket);
    const publicPath = path => `${R2_WORKER_URL}/storage/v1/object/public/${bucket}/${encodePath(path)}`;
    return {
      async upload(path, file, options = {}) {
        try {
          const response = await fetchWithRetry(publicPath(path), {
            method: 'PUT',
            headers: {
              ...(await authHeaders()),
              'Content-Type': options.contentType || file?.type || 'application/octet-stream',
              'Cache-Control': `public, max-age=${options.cacheControl || '31536000'}`,
            },
            body: file,
          });
          if (!response.ok) {
            const text = await response.text().catch(() => '');
            return { data: null, error: new Error(text || `R2 upload failed (${response.status})`) };
          }
          return { data: { path }, error: null };
        } catch (error) {
          return { data: null, error: new Error(error?.message === 'Failed to fetch' ? 'Cloudflare upload service is unreachable. Please retry after the Worker is deployed.' : error?.message || 'R2 upload failed.') };
        }
      },
      getPublicUrl(path) { return { data: { publicUrl: publicPath(path) } }; },
      async remove(paths) {
        try {
          const headers = await authHeaders();
          const clean = (paths || []).filter(Boolean);
          for (const path of clean) {
            const response = await fetchWithRetry(publicPath(path), { method: 'DELETE', headers });
            if (!response.ok) {
              const text = await response.text().catch(() => '');
              return { data: null, error: new Error(text || `R2 delete failed (${response.status})`) };
            }
          }
          return { data: clean.map(path => ({ name: path })), error: null };
        } catch (error) { return { data: null, error }; }
      },
    };
  },
};

export const supabase = new Proxy(client, {
  get(target, property, receiver) { return property === 'storage' ? r2Storage : Reflect.get(target, property, receiver); },
});
