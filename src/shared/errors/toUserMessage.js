const SAFE_MESSAGES_BY_CODE = Object.freeze({
  AUTH_REQUIRED: "Please sign in to continue.",
  INVALID_LOGIN: "Invalid email or password.",
  ACCOUNT_LOCKED: "Too many attempts. Please try again later.",
  NETWORK_ERROR: "Connection problem. Check your internet and try again.",
});

/**
 * @param {unknown} error
 * @param {string} field
 */
function readErrorField(error, field) {
  if (!error || typeof error !== "object" || !(field in error)) return "";
  const fields = /** @type {Record<string, unknown>} */ (error);
  return String(fields[field] ?? "").trim();
}

/**
 * Keep known, short validation messages useful while hiding SQL, stack traces,
 * internal endpoints, and provider diagnostics from reader-facing UI.
 *
 * @param {unknown} error
 * @param {string} [fallback]
 */
export function toUserMessage(
  error,
  fallback = "Something went wrong. Please try again.",
) {
  if (typeof error === "string") {
    error = { message: error };
  }

  const code = readErrorField(error, "code").toUpperCase();
  const safeMessages = /** @type {Record<string, string>} */ (SAFE_MESSAGES_BY_CODE);
  if (safeMessages[code]) return safeMessages[code];

  const name = readErrorField(error, "name");
  if (name === "AbortError" || name === "TimeoutError") {
    return "The request timed out. Please try again.";
  }

  const message = readErrorField(error, "message");
  if (!message || message.length > 240) return fallback;

  const containsInternalDetails =
    /https?:\/\/|stack trace|syntaxerror|referenceerror|supabase|postgres|sqlstate|constraint|permission denied|service_role|authorization:/i.test(
      message,
    );

  return containsInternalDetails ? fallback : message;
}
