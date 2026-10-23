const CONSENT_STORAGE_KEY = 'atma-analytics-consent-v1';
const ATTRIBUTION_STORAGE_KEY = 'atma-rekha-marketing-attribution-v1';
const ANALYTICS_VIEWER_KEY_STORAGE = 'atma-rekha-analytics-viewer-key-v1';
const VIEW_RECORDED_PREFIXES = [
  'atma-rekha-view-recorded-v3:',
  'atma-rekha-view-recorded-v2:',
  'atma-rekha-view-recorded-v1:',
];

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
  } catch {}

  if (choice === 'denied') {
    try { window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY); } catch {}
    try { window.localStorage.removeItem(ANALYTICS_VIEWER_KEY_STORAGE); } catch {}
    try {
      const toRemove = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key && VIEW_RECORDED_PREFIXES.some(prefix => key.startsWith(prefix))) toRemove.push(key);
      }
      toRemove.forEach(key => {
        try { window.localStorage.removeItem(key); } catch {}
      });
    } catch {}
  }

  try {
    window.dispatchEvent(new CustomEvent('atma-analytics-consent-changed', { detail: { consent: choice } }));
  } catch {}
  return saved;
}
