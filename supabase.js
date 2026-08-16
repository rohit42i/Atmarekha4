import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const R2_WORKER_URL = 'https://tiny-pond-c959.rohitbaswaraj.workers.dev';
const R2_BUCKETS = new Set(['chapter-pages', 'covers']);

const IMAGE_MIN_SIZE = 500 * 1024;
const IMAGE_MAX_SIZE = 1024 * 1024;
const IMAGE_TARGET_SIZE = 768 * 1024;
const IMAGE_MAX_EDGE = 2400;

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

const blobFromCanvas = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('The browser could not encode this image.'));
  }, type, quality);
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

async function compressImage(file) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) return file;

  const image = await decodeImage(file);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const longestEdge = Math.max(sourceWidth, sourceHeight);

  // Small, reasonably-sized images stay completely untouched.
  if (file.size <= IMAGE_MIN_SIZE && longestEdge <= IMAGE_MAX_EDGE) {
    image.close?.();
    return file;
  }

  const canUseWebP = await new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    canvas.toBlob(blob => resolve(Boolean(blob)), 'image/webp', 0.95);
  });
  const outputType = canUseWebP ? 'image/webp' : 'image/jpeg';

  let scale = Math.min(1, IMAGE_MAX_EDGE / longestEdge);

  try {
    // If the first pass is still too large, progressively reduce dimensions.
    for (let dimensionPass = 0; dimensionPass < 6; dimensionPass += 1) {
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Canvas encoding is unavailable in this browser.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);

      // Find the highest quality that remains at or below 1 MB.
      let low = 0.45;
      let high = 0.96;
      let best = null;
      let bestDistance = Infinity;

      for (let i = 0; i < 8; i += 1) {
        const quality = (low + high) / 2;
        const blob = await blobFromCanvas(canvas, outputType, quality);
        if (blob.size <= IMAGE_MAX_SIZE) {
          const distance = Math.abs(blob.size - IMAGE_TARGET_SIZE);
          if (distance < bestDistance) {
            best = blob;
            bestDistance = distance;
          }
          low = quality;
        } else {
          high = quality;
        }
      }

      // Also test the top quality explicitly; this prevents unnecessary quality loss.
      const highest = await blobFromCanvas(canvas, outputType, 0.96);
      if (highest.size <= IMAGE_MAX_SIZE && (!best || highest.size > best.size)) best = highest;

      if (best && best.size <= IMAGE_MAX_SIZE) {
        // If compression naturally lands below 500 KB, keep the best-quality result
        // rather than artificially inflating the file with padding.
        const result = new File([best], file.name, {
          type: outputType,
          lastModified: file.lastModified,
        });
        image.close?.();
        return result;
      }

      // Quality alone was not enough. Reduce the long edge and try again.
      scale *= 0.88;
    }
  } finally {
    image.close?.();
  }

  throw new Error(`${file.name} could not be compressed below 1 MB without excessive quality loss. Try a smaller source image.`);
}

const r2Storage = {
  from(bucket) {
    if (!R2_BUCKETS.has(bucket)) return client.storage.from(bucket);

    const publicPath = path =>
      `${R2_WORKER_URL}/storage/v1/object/public/${bucket}/${encodePath(path)}`;

    return {
      async upload(path, file, options = {}) {
        try {
          const processedFile = await compressImage(file);
          const response = await fetch(publicPath(path), {
            method: 'PUT',
            headers: {
              ...(await authHeaders()),
              'Content-Type': processedFile?.type || options.contentType || file?.type || 'application/octet-stream',
              'Cache-Control': `public, max-age=${options.cacheControl || '31536000'}`,
            },
            body: processedFile,
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
