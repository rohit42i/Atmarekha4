import { client } from "../supabase/client.js";
import { publicEnv } from "../../config/publicEnv.js";
import { encodePath, normalizeAtmaR2Path } from "./r2Domain.js";

const R2_WORKER_URL = publicEnv.mediaWorkerUrl;
const R2_BUCKETS = new Set(["chapter-pages", "covers", "community"]);

// Preserve manga line texture and small lettering when uploads need compression.
const IMAGE_MIN_SIZE = 2 * 1024 * 1024;
const IMAGE_MAX_SIZE = 4 * 1024 * 1024;
const IMAGE_MAX_EDGE = 3200;

async function authHeaders() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) {
    throw new Error("Your Supabase session has expired. Please sign in again.");
  }
  return { Authorization: "Bearer " + data.session.access_token };
}

/** @param {string} url @param {RequestInit} [options] @param {boolean} [retried] */
export async function fetchAuthenticatedMedia(url, options = {}, retried = false) {
  let response;
  const controller = new AbortController();
  const parentSignal = options.signal;
  let timedOut = false;
  const forwardAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else parentSignal.addEventListener("abort", forwardAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...(options.headers || {}), ...(await authHeaders()) },
    });
  } catch (error) {
    const requestError = error instanceof Error ? error : new Error(String(error));
    const failure = /** @type {Error & { url?: string }} */ (
      new Error(
        `Authenticated media request failed: ${requestError.message}. Check the media Worker CORS/network configuration.`,
      )
    );
    failure.name = timedOut ? "TimeoutError" : requestError.name || "NetworkError";
    if (timedOut) {
      failure.message = "Authenticated media request timed out. Please try again.";
    }
    failure.url = url;
    failure.cause = requestError;
    throw failure;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener?.("abort", forwardAbort);
  }

  if (response.status === 401 && !retried) {
    const { error } = await client.auth.refreshSession();
    if (error) throw error;
    return fetchAuthenticatedMedia(url, options, true);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let message = "";
    try {
      message = JSON.parse(body)?.error || "";
    } catch (_) {}
    throw new Error(
      message || `Authenticated media request failed (HTTP ${response.status}).`,
    );
  }

  return response;
}

/** @param {string} url @param {RequestInit} [options] */
export async function fetchAuthenticatedMediaBlobUrl(url, options = {}) {
  const response = await fetchAuthenticatedMedia(url, options);
  return URL.createObjectURL(await response.blob());
}

/** @param {HTMLCanvasElement} canvas @param {string} type @param {number} quality */
const blobFromCanvas = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The browser could not encode this image.")),
      type,
      quality,
    );
  });

/** @param {File} file @returns {Promise<ImageBitmap | HTMLImageElement>} */
async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (_) {}
  }
  return await new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected image could not be decoded."));
    };
    image.src = url;
  });
}

/** @returns {Promise<boolean>} */

/** @param {ImageBitmap | HTMLImageElement} image */
function closeDecodedImage(image) {
  if ("close" in image && typeof image.close === "function") image.close();
}
async function supportsWebP() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(Boolean(blob)), "image/webp", 0.9),
  );
}

/** @param {File} file @returns {Promise<File | Blob>} */
async function compressImage(file) {
  if (!(file instanceof File) || !file.type.startsWith("image/")) return file;
  const image = await decodeImage(file);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const longestEdge = Math.max(sourceWidth, sourceHeight);
  if (file.size <= IMAGE_MIN_SIZE && longestEdge <= IMAGE_MAX_EDGE) {
    closeDecodedImage(image);
    return file;
  }
  const outputType = (await supportsWebP()) ? "image/webp" : "image/jpeg";
  let scale = Math.min(1, IMAGE_MAX_EDGE / longestEdge);
  try {
    for (let dimensionPass = 0; dimensionPass < 7; dimensionPass += 1) {
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: outputType === "image/webp" });
      if (!context) throw new Error("Canvas encoding is unavailable in this browser.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);
      let low = 0.45;
      let high = 0.98;
      let best = null;
      for (let i = 0; i < 10; i += 1) {
        const quality = (low + high) / 2;
        const blob = await blobFromCanvas(canvas, outputType, quality);
        if (blob.size <= IMAGE_MAX_SIZE) {
          best = blob;
          low = quality;
        } else high = quality;
      }
      const highest = await blobFromCanvas(canvas, outputType, 0.98);
      if (highest.size <= IMAGE_MAX_SIZE) best = highest;
      if (best)
        return new File(
          [best],
          file.name.replace(/\.(png|jpe?g|gif|bmp|avif)$/i, ".webp"),
          { type: outputType, lastModified: file.lastModified },
        );
      scale *= 0.86;
    }
  } finally {
    closeDecodedImage(image);
  }
  throw new Error(
    `${file.name} could not be compressed below 4 MB while preserving acceptable quality.`,
  );
}

/** Storage-compatible R2 adapter. Use the normal Supabase storage API for other buckets. */
export const cloudflareR2 = {
  /** @param {string} bucket */
  from(bucket) {
    if (!R2_BUCKETS.has(bucket)) return client.storage.from(bucket);
    /** @param {string} path */
    const publicPath = (path) =>
      `${R2_WORKER_URL}/storage/v1/object/public/${encodePath(normalizeAtmaR2Path(bucket, path))}`;
    return {
      /**
       * @param {string} path
       * @param {File} file
       * @param {{ contentType?: string, cacheControl?: string | number }} [options]
       */
      async upload(path, file, options = {}) {
        try {
          const storagePath = normalizeAtmaR2Path(bucket, path);
          const processedFile = await compressImage(file);
          const response = await fetch(publicPath(storagePath), {
            method: "PUT",
            headers: {
              ...(await authHeaders()),
              "Content-Type":
                processedFile?.type ||
                options.contentType ||
                file?.type ||
                "application/octet-stream",
              "Cache-Control": `public, max-age=${options.cacheControl || "31536000"}`,
            },
            body: processedFile,
          });
          if (!response.ok) {
            const text = await response.text();
            return {
              data: null,
              error: new Error(text || `R2 upload failed (${response.status})`),
            };
          }
          return { data: { path }, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      /** @param {string} path */
      getPublicUrl(path) {
        return { data: { publicUrl: publicPath(path) } };
      },
      /** @param {string[]} paths */
      async remove(paths) {
        const clean = (paths || []).filter(Boolean);
        try {
          const headers = await authHeaders();
          for (const path of clean) {
            const response = await fetch(publicPath(path), {
              method: "DELETE",
              headers,
            });
            if (!response.ok) {
              const text = await response.text();
              return {
                data: null,
                error: new Error(text || `R2 delete failed (${response.status})`),
              };
            }
          }
          return { data: clean.map((path) => ({ name: path })), error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
    };
  },
};
