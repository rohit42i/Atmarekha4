import { publicEnv } from "../../config/publicEnv.js";

/** @type {string} */
export const PDLPL_MEDIA_WORKER_URL = publicEnv.pdlplMediaWorkerUrl;

/**
 * Build a URL for a PdPL media object. Encode each segment independently so
 * existing slash-delimited object keys remain hierarchical in the Worker.
 *
 * @param {unknown} path
 * @param {string} [workerUrl]
 */
export function getPdlplMediaUrl(path, workerUrl = PDLPL_MEDIA_WORKER_URL) {
  const clean = String(path ?? "").trim().replace(/^\/+/, "");
  if (!clean) return "";

  const base = String(workerUrl ?? "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("PdPL media Worker URL is not configured.");

  const encoded = clean
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/media/${encoded}`;
}
