const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
export const MIN_PASSWORD_LENGTH = 8;

function toSha1Hex(value) {
  return crypto.subtle
    .digest('SHA-1', new TextEncoder().encode(value))
    .then(buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase());
}

export async function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error('Password security checking is unavailable in this browser. Please use a modern browser over HTTPS.');
  }

  const hash = await toSha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  let response;
  try {
    response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      method: 'GET',
      cache: 'no-store',
    });
  } catch (_) {
    throw new Error('We could not complete the password security check. Please try again.');
  }

  if (!response.ok) {
    throw new Error('We could not complete the password security check. Please try again.');
  }

  const body = await response.text();
  const match = body
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.split(':', 1)[0].toUpperCase() === suffix);

  const count = match ? Number(match.split(':', 2)[1]) : 0;
  if (Number.isFinite(count) && count > 0) {
    throw new Error('Choose a different password. This password has appeared in known data breaches.');
  }

  return { compromised: false };
}
