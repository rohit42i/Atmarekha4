const CONSENT_STORAGE_KEY = 'atma-analytics-consent-v1';
const ATTRIBUTION_STORAGE_KEY = 'atma-rekha-marketing-attribution-v1';
const VIEWER_KEY_STORAGE = 'atma-rekha-viewer-key-v1';
const VIEW_RECORDED_PREFIX = 'atma-rekha-view-recorded-v2:';

export function getAnalyticsConsent() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent() {
  return getAnalyticsConsent() === 'granted';
}

export function setAnalyticsConsent(choice) {
  if (choice !== 'granted' && choice !== 'denied') {
    throw new TypeError('Analytics consent must be granted or denied.');
  }
  if (typeof window === 'undefined') return false;

  let saved = false;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    saved = true;
    if (choice === 'denied') {
      window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      window.localStorage.removeItem(VIEWER_KEY_STORAGE);
      const toRemove = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key && key.startsWith(VIEW_RECORDED_PREFIX)) toRemove.push(key);
      }
      toRemove.forEach(key => window.localStorage.removeItem(key));
    }
  } catch {
    saved = false;
  }

  try {
    window.dispatchEvent(new CustomEvent('atma-analytics-consent-changed', { detail: { consent: choice } }));
  } catch {}
  return saved;
}
