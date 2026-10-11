import { normalizeEmail } from "./input.js";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

/**
 * Use the shared email normalizer while preserving the existing inline
 * validation contract used by sign-up and profile forms.
 *
 * @param {unknown} value
 */
export function validateEmail(value) {
  const input = String(value ?? "").trim();
  if (!input) return { ok: false, message: "Email is required." };

  try {
    normalizeEmail(input);
    return { ok: true, message: "Email looks good." };
  } catch {
    return { ok: false, message: "Enter a valid email address." };
  }
}

/** @param {unknown} value */
export function passwordScore(value) {
  const password = String(value ?? "");
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

/** @param {unknown} value */
export function passwordStrength(value) {
  const score = passwordScore(value);
  if (!value) return { label: "Enter a password", score: 0 };
  if (score <= 2) return { label: "Weak", score };
  if (score <= 4) return { label: "Medium", score };
  if (score === 5) return { label: "Strong", score };
  return { label: "Very strong", score };
}

/** @returns {Storage | null} */
function getBrowserStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    // Privacy mode and storage policy can deny access even when the API exists.
    return null;
  }
}

/**
 * Store non-sensitive UI drafts only. Never use localStorage for sessions,
 * passwords, payment data, access tokens, or private reader content.
 *
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} Whether the draft was stored.
 */
export function rememberDraft(key, value) {
  const storage = getBrowserStorage();
  if (!storage) return false;

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T | unknown}
 */
export function loadDraft(key, fallback) {
  const storage = getBrowserStorage();
  if (!storage) return fallback;

  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function clearDraft(key) {
  const storage = getBrowserStorage();
  if (!storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
