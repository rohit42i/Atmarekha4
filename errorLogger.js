const SENTRY_DSN = String(import.meta.env.VITE_SENTRY_DSN || '').trim();

function scrub(value) {
  return String(value || '')
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/[?&](access_token|refresh_token|code|token|key|password|otp|secret|api_key)=[^&\s]*/gi, '$1=[redacted]')
    .replace(/\b(password|passcode|otp|secret|api[_-]?key|authorization|email|phone|mobile|upi_pin|cvv|card_number)\b\s*[:=]\s*["']?[^"',\s&]+/gi, '$1=[redacted]')
    .slice(0, 1000);
}

function parseDsn(dsn) {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    if (!publicKey || !projectId) return null;
    return { publicKey, projectId, host: url.host };
  } catch {
    return null;
  }
}

const parsed = parseDsn(SENTRY_DSN);

export async function logFrontendError(error, context = {}) {
  const err = error instanceof Error ? error : new Error(String(error || 'Unknown frontend error'));
  // Avoid writing raw errors, stack traces, or caller-supplied context to the browser console.
  console.error('[Atma Rekha] Frontend error captured.');
  if (!parsed) return;

  const eventId = crypto.randomUUID().replaceAll('-', '');
  const envelopeHeader = {
    event_id: eventId,
    sent_at: new Date().toISOString(),
    sdk: { name: 'atma-rekha-error-logger', version: '1.0.0' },
  };
  const safeMessage = scrub(err.message);
  const event = {
    event_id: eventId,
    message: safeMessage,
    level: 'error',
    platform: 'javascript',
    environment: import.meta.env.MODE,
    exception: { values: [{ type: err.name || 'Error', value: safeMessage, stacktrace: { frames: [] } }] },
    contexts: { app: { route: scrub(window.location.pathname), language: document.documentElement.lang || 'en' } },
    tags: { source: scrub(context.source || 'frontend') },
  };

  try {
    const payload = JSON.stringify(event);
    await fetch(\`https://\${parsed.host}/api/\${parsed.projectId}/envelope/?sentry_version=7&sentry_key=\${encodeURIComponent(parsed.publicKey)}&sentry_client=atma-rekha-error-logger/1.0.0\`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: JSON.stringify(envelopeHeader) + '\\n' + JSON.stringify({ type: 'event', length: payload.length }) + '\\n' + payload,
    });
  } catch {
    // Error telemetry must never interrupt the website.
  }
}

export function installGlobalErrorLogging() {
  window.addEventListener('error', event => logFrontendError(event.error || new Error(event.message), { source: 'window.error' }));
  window.addEventListener('unhandledrejection', event => logFrontendError(event.reason || new Error('Unhandled promise rejection'), { source: 'unhandledrejection' }));
}
