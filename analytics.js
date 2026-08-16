const STORAGE_KEY = 'atma_rekha_analytics_session';
const SESSION_KEY = 'atma_rekha_analytics_id';

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch { return 'anonymous'; }
}

function sanitize(value) {
  if (value == null) return undefined;
  if (typeof value === 'string') return value.slice(0, 120);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return undefined;
}

export function track(event, properties = {}) {
  if (!event) return;
  const payload = {
    event,
    properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, sanitize(value)]).filter(([, value]) => value !== undefined)),
    path: window.location.hash || '#home',
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent('atma:analytics', { detail: payload }));

  if (Array.isArray(window.dataLayer)) window.dataLayer.push(payload);
  if (typeof window.gtag === 'function') window.gtag('event', event, payload.properties);

  try {
    const existing = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    existing.push(payload);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(-50)));
  } catch {}
}

export function trackPageView() {
  track('page_view', { page: window.location.hash || '#home' });
}

export function installAnalytics() {
  let last = '';
  const send = () => {
    const current = window.location.hash || '#home';
    if (current === last) return;
    last = current;
    trackPageView();
  };
  send();
  window.addEventListener('hashchange', send, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') send();
  }, { passive: true });
  return () => window.removeEventListener('hashchange', send);
}

if (typeof window !== 'undefined') window.atmaAnalytics = { track, trackPageView };
