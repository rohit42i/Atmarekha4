export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function validateEmail(value) {
  const email = String(value || '').trim();
  if (!email) return { ok: false, message: 'Email is required.' };
  if (!EMAIL_RE.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  return { ok: true, message: 'Email looks good.' };
}

export function passwordScore(value) {
  const password = String(value || '');
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

export function passwordStrength(value) {
  const score = passwordScore(value);
  if (!value) return { label: 'Enter a password', score: 0 };
  if (score <= 2) return { label: 'Weak', score };
  if (score <= 4) return { label: 'Medium', score };
  if (score === 5) return { label: 'Strong', score };
  return { label: 'Very strong', score };
}

export function rememberDraft(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function loadDraft(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch { return fallback; }
}

export function clearDraft(key) {
  try { localStorage.removeItem(key); } catch {}
}
