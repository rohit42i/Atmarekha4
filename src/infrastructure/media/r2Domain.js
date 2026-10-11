/**
 * Pure helpers for translating application storage paths into the Worker's
 * canonical object-key format. These functions must be idempotent because
 * admin uploads and deletion paths can arrive in either canonical or legacy
 * form.
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
  const prefix = String(bucket || "") + "/";

  if (bucket !== "chapter-pages") {
    // The Atma Worker uses one R2 bucket and validates these namespaces in the
    // object key. Preserve an explicit namespace or add it for bucket-relative
    // paths such as those recovered from a URL.
    return clean.toLowerCase().startsWith(prefix.toLowerCase())
      ? clean
      : prefix + clean;
  }

  // Already-canonical chapter page keys must survive a second normalization.
  if (new RegExp("^chapter-pages/" + UUID_PATTERN + "/[^/]+/[^/]+$", "i").test(clean)) {
    return clean;
  }

  // Older database rows can contain the bucket namespace around the previous
  // layout, so strip it only when it is not already canonical.
  if (clean.toLowerCase().startsWith(prefix.toLowerCase())) {
    clean = clean.slice(prefix.length);
  }

  const legacy = clean.match(
    /^chapters\/([0-9a-f-]{36})\/pages\/[^/]+-(\d+)\/(.+)$/i,
  );
  if (legacy) {
    return "chapter-pages/" + legacy[1] + "/" + legacy[2] + "/" + legacy[3];
  }

  // Keep the worker's supported legacy replacement keys intact. This must
  // precede the generic UUID/revision/file shape below.
  if (/^[0-9a-f-]{36}\/replacements\/[^/]+$/i.test(clean)) return clean;

  // pathFromUrl() returns the part after "chapter-pages/" for object cleanup.
  const canonicalSuffix = clean.match(/^([0-9a-f-]{36})\/[^/]+\/[^/]+$/i);
  if (canonicalSuffix) return "chapter-pages/" + clean;

  // Do not guess the meaning of older, unrecognized key shapes.
  return clean;
}

/** Pattern shared with the protected-page namespace handled by the Worker. */
const UUID_PATTERN = "[0-9a-f-]{36}";
