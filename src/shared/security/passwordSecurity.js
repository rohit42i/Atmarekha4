const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const PASSWORD_CHECK_TIMEOUT_MS = 8_000;
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Keep the complete password on-device. Only the first five hex characters of
 * its SHA-1 digest are sent to the HIBP range API (k-anonymity protocol).
 *
 * @param {string} value
 */
async function toSha1Hex(value) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
}

/**
 * @param {string} responseBody
 * @param {string} suffix
 * @returns {number}
 */
export function findPasswordBreachCount(responseBody, suffix) {
  const target = String(suffix || "").trim().toUpperCase();
  if (!/^[A-F0-9]{35}$/.test(target)) return 0;

  const line = String(responseBody || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.split(":", 1)[0].toUpperCase() === target);

  if (!line) return 0;
  const count = Number(line.split(":", 2)[1]);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

/**
 * @param {unknown} password
 * @returns {Promise<{ compromised: false }>}
 */
export async function validateNewPassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Password security checking is unavailable in this browser. Please use a modern browser over HTTPS.",
    );
  }

  const hash = await toSha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PASSWORD_CHECK_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      method: "GET",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      "We could not complete the password security check. Please try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(
      "We could not complete the password security check. Please try again.",
    );
  }

  let body;
  try {
    body = await response.text();
  } catch {
    throw new Error(
      "We could not complete the password security check. Please try again.",
    );
  }

  if (findPasswordBreachCount(body, suffix) > 0) {
    throw new Error(
      "Choose a different password. This password has appeared in known data breaches.",
    );
  }

  return { compromised: false };
}
