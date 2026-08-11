import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const R2_WORKER_URL = 'https://tiny-pond-c959.rohitbaswaraj.workers.dev';
const R2_BUCKETS = new Set(['chapter-pages', 'covers']);

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
  );
}

const client = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

const encodePath = path => String(path || '').split('/').map(encodeURIComponent).join('/');

async function authHeaders() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Your Supabase session has expired. Please sign in again.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

const r2Storage = {
  from(bucket) {
    if (!R2_BUCKETS.has(bucket)) return client.storage.from(bucket);

    const publicPath = path =>
      `${R2_WORKER_URL}/storage/v1/object/public/${bucket}/${encodePath(path)}`;

    return {
      async upload(path, file, options = {}) {
        try {
          const response = await fetch(publicPath(path), {
            method: 'PUT',
            headers: {
              ...(await authHeaders()),
              'Content-Type': options.contentType || file?.type || 'application/octet-stream',
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

      getPublicUrl(path) {
        return { data: { publicUrl: publicPath(path) } };
      },

      async remove(paths) {
        const clean = (paths || []).filter(Boolean);
        try {
          const headers = await authHeaders();
          for (const path of clean) {
            const response = await fetch(publicPath(path), { method: 'DELETE', headers });
            if (!response.ok) {
              const text = await response.text();
              return { data: null, error: new Error(text || `R2 delete failed (${response.status})`) };
            }
          }
          return { data: clean.map(path => ({ name: path })), error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
    };
  },
};

export const supabase = new Proxy(client, {
  get(target, property, receiver) {
    if (property === 'storage') return r2Storage;
    return Reflect.get(target, property, receiver);
  },
});
