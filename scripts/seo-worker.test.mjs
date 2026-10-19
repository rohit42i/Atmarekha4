import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete globalThis.caches;
  else globalThis.caches = originalCaches;
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

test('returns HTTP 404 and noindex for a chapter URL confirmed missing by metadata', async () => {
  const env = mockRuntime([]);
  const response = await worker.fetch(new Request('https://www.atmarekha.in/chapter/9999'), env);
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(response.headers.get('X-Robots-Tag') || '', /noindex/);
  assert.match(body, /name="robots" content="noindex,nofollow,noarchive"/);
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
