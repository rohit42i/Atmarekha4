const STORAGE_KEY = 'atma-rekha-marketing-attribution-v1';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
import { hasAnalyticsConsent } from './privacyConsent.js';

function readStored() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function captureMarketingAttribution() {
  if (typeof window === 'undefined') return null;
  if (!hasAnalyticsConsent()) {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    return null;
  }
  const url = new URL(window.location.href);
  const current = Object.fromEntries(
    UTM_KEYS.map(key => [key, String(url.searchParams.get(key) || '').trim()]).filter(([, value]) => value),
  );
  if (!Object.keys(current).length) return readStored();

  const previous = readStored() || {};
  const next = {
    ...previous,
    first_touch: previous.first_touch || current,
    last_touch: current,
    captured_at: previous.captured_at || new Date().toISOString(),
  };
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function getMarketingAttribution() {
  if (typeof window === 'undefined' || !hasAnalyticsConsent()) return null;
  return readStored();
}
