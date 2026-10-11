/**
 * Pure helpers for translating application storage paths into the Worker
 * object's canonical key format. Kept separate so legacy path shapes can be
 * verified without issuing a request to the media Worker.
 */

/** @param {string} path */
export const encodePath = (path) =>
  String(path || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");

/**
 * @param {string} bucket
 * @param {string} path
 */
export function normalizeAtmaR2Path(bucket, path) {
  let clean = String(path || "").replace(/^\/+/, "");
  const bucketPrefix = `${bucket}/`;

  if (clean.toLowerCase().startsWith(bucketPrefix.toLowerCase())) {
    clean = clean.slice(bucketPrefix.length);
  }
  if (bucket !== "chapter-pages") return clean;

  const match = clean.match(
    /^chapters\/([0-9a-f-]{36})\/pages\/[^/]+-(\d+)\/(.+)$/i,
  );
  if (!match) return clean;

  return `chapter-pages/${match[1]}/${match[2]}/${match[3]}`;
}
