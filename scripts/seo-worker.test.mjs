import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { getAnalyticsConsent, hasAnalyticsConsent, setAnalyticsConsent } from '../privacyConsent.js';
import { getMarketingAttribution } from '../attribution.js';

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete globalThis.caches;
  else globalThis.caches = originalCaches;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

function mockRuntime(chapters = []) {
  globalThis.caches = {
    default: {
      match: async () => undefined,
      put: async () => undefined,
    },
  };

  globalThis.fetch = async input => {
    const url = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
    if (url.pathname === '/rest/v1/chapters') {
      return new Response(JSON.stringify(chapters), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error('Unexpected outbound request: ' + url.origin + url.pathname);
  };

  const html = '<!doctype html><html><head><title>Atma Rekha</title>' +
    '<meta name="robots" content="index,follow" />' +
    '<link rel="canonical" href="https://www.atmarekha.in/" />' +
    '<script type="application/ld+json" id="atma-rekha-site-schema">' +
    JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Atma Rekha' }) +
    '</script></head><body><div id="root"></div></body></html>';

  return {
    ASSETS: {
      fetch: async () => new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    },
  };
}

test('analytics stays off until affirmative opt-in and denial clears optional identifiers', () => {
  const values = new Map([
    ['atma-rekha-marketing-attribution-v1', '{"utm_source":"example"}'],
    ['atma-rekha-viewer-key-v1', 'browser-key-example'],
    ['atma-rekha-view-recorded-v2:chapter-1', '1'],
  ]);
  const events = [];
  const localStorage = {
    get length() { return values.size; },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
  };
  globalThis.window = {
    localStorage,
    dispatchEvent: event => { events.push(event); return true; },
  };

  assert.equal(getAnalyticsConsent(), null);
  assert.equal(hasAnalyticsConsent(), false);
  assert.equal(getMarketingAttribution(), null);
  assert.equal(setAnalyticsConsent('granted'), true);
  assert.equal(hasAnalyticsConsent(), true);
  assert.equal(events.at(-1)?.detail?.consent, 'granted');

  assert.equal(setAnalyticsConsent('denied'), true);
  assert.equal(hasAnalyticsConsent(), false);
  assert.equal(values.has('atma-rekha-marketing-attribution-v1'), false);
  assert.equal(values.has('atma-rekha-viewer-key-v1'), false);
  assert.equal(values.has('atma-rekha-view-recorded-v2:chapter-1'), false);
  assert.equal(events.at(-1)?.detail?.consent, 'denied');
  // Even if an older client version left attribution behind, opt-out must suppress retrieval.
  values.set('atma-rekha-marketing-attribution-v1', '{"utm_source":"stale"}');
  assert.equal(getMarketingAttribution(), null);
});

test('returns HTTP 404 and noindex for a chapter URL confirmed missing by metadata', async () => {
  const env = mockRuntime([]);
  const response = await worker.fetch(new Request('https://www.atmarekha.in/chapter/9999'), env);
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(response.headers.get('X-Robots-Tag') || '', /noindex/);
  assert.match(body, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('cdn-cache-control'), null);
});

test('keeps a published chapter indexable and canonicalized', async () => {
  const env = mockRuntime([{
    id: 'a6ddc25b-c814-4ad2-8386-58ce94639586',
    chapter_number: 1,
    title: 'Chapter One',
    language: 'hi',
    status: 'published',
    cover_url: 'https://tiny-pond-c959.rohitbaswaraj.workers.dev/covers/chapter-one.webp',
    release_date: '2026-09-14',
  }]);
  const response = await worker.fetch(new Request('https://www.atmarekha.in/chapter/1'), env);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /<title>Chapter One \| Atma Rekha<\/title>/);
  assert.match(body, /rel="canonical" href="https:\/\/www\.atmarekha\.in\/chapter\/1"/);
  assert.match(body, /name="robots" content="index,follow/);
  assert.doesNotMatch(response.headers.get('X-Robots-Tag') || '', /noindex/);
});

test('includes matching FAQ content and structured data on the About page', async () => {
  const env = mockRuntime([]);
  const response = await worker.fetch(new Request('https://www.atmarekha.in/info/about'), env);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /"@type":"FAQPage"/);
  assert.match(body, /What is Atma Rekha\?/);
  assert.match(body, /atmarekhasupport@gmail\.com/);
});

test('keeps administrative routes out of search indexes', async () => {
  const env = mockRuntime([]);
  const response = await worker.fetch(new Request('https://www.atmarekha.in/admin'), env);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('X-Robots-Tag') || '', /noindex/);
  assert.match(body, /name="robots" content="noindex,nofollow,noarchive"/);
});

test('returns HTTP 404 for an unknown SPA route rather than a soft 404', async () => {
  const env = mockRuntime([]);
  const response = await worker.fetch(new Request('https://www.atmarekha.in/this-route-should-not-exist'), env);

  assert.equal(response.status, 404);
  assert.match(response.headers.get('X-Robots-Tag') || '', /noindex/);
});
