import assert from 'node:assert/strict';
import analyticsWorker from '../analytics-worker/worker.js';

class MemoryR2 {
  constructor() {
    this.objects = new Map();
  }

  async put(key, value, options = {}) {
    const text = typeof value === 'string' ? value : String(value);
    this.objects.set(key, { text, options });
    return { key };
  }

  async get(key) {
    const stored = this.objects.get(key);
    if (!stored) return null;
    return {
      json: async () => JSON.parse(stored.text),
      text: async () => stored.text,
      arrayBuffer: async () => new TextEncoder().encode(stored.text).buffer,
      httpMetadata: stored.options?.httpMetadata || {},
    };
  }

  async head(key) {
    const stored = this.objects.get(key);
    return stored ? { key, size: stored.text.length } : null;
  }

  async list({ prefix = '', limit = 1000, cursor } = {}) {
    const keys = [...this.objects.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = cursor ? Math.max(0, keys.indexOf(cursor) + 1) : 0;
    const page = keys.slice(start, start + limit);
    const truncated = start + page.length < keys.length;
    return {
      objects: page.map(key => ({ key, size: this.objects.get(key).text.length })),
      truncated,
      cursor: truncated ? page.at(-1) : undefined,
    };
  }
}

function envFor(bucket) {
  return { ANALYTICS_BUCKET: bucket };
}

function request(url, method, origin, body) {
  return new Request(url, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const bucket = new MemoryR2();
const env = envFor(bucket);
const origin = 'https://www.atmarekha.in';
const chapterId = 'a6ddc25b-c814-4ad2-8386-58ce94639586';
const viewerKey = 'worker-test-viewer-key-0123456789';

// Mark legacy import as completed so the unit test has no external Supabase dependency.
await bucket.put('analytics/views/legacy-imported.json', JSON.stringify({ rows: 0 }));
await bucket.put('analytics/views/summary.json', JSON.stringify({ version: 1, chapterViews: {} }));
await bucket.put('analytics/views/current.json', JSON.stringify({
  version: 1,
  day: new Date().toISOString().slice(0, 10),
  views: 0,
  chapterViews: {},
}));

const invalid = await analyticsWorker.fetch(
  request('https://analytics.test/v1/view', 'POST', origin, { chapterId: 'not-a-uuid', viewerKey }),
  env,
);
assert.equal(invalid.status, 400, 'invalid chapter IDs must be rejected');

const post = () => analyticsWorker.fetch(
  request('https://analytics.test/v1/view', 'POST', origin, { chapterId, viewerKey }),
  env,
);

const first = await post();
assert.equal(first.status, 200, 'a valid view must be accepted');
assert.deepEqual(await first.json(), { recorded: true });

const second = await post();
assert.equal(second.status, 200, 'retrying a view must remain successful');
assert.deepEqual(await second.json(), { recorded: true });

const todayPrefix = `analytics/views/events/${new Date().toISOString().slice(0, 10)}/${chapterId}/`;
const todaysEvents = await bucket.list({ prefix: todayPrefix });
assert.equal(todaysEvents.objects.length, 1, 'same viewer/chapter/day retries must be idempotent');

const otherChapterId = 'f3bfec99-d077-43ca-977a-345e7f0b2298';
// Simulate a stale hourly snapshot that says this chapter had views, despite no R2 event.
await bucket.put('analytics/views/current.json', JSON.stringify({
  version: 1,
  day: new Date().toISOString().slice(0, 10),
  views: 99,
  chapterViews: { [otherChapterId]: 99 },
}));
const views = await analyticsWorker.fetch(
  request(`https://analytics.test/v1/views?chapterIds=${chapterId},${otherChapterId}`, 'GET', origin),
  env,
);
assert.equal(views.status, 200, 'public view counts must be readable after recording');
const counts = await views.json();
assert.equal(counts[chapterId], 1, 'recorded R2 event must be included in the public chapter count');
assert.equal(counts[otherChapterId], 0, 'a successful live zero must not be replaced by a stale hourly snapshot');

// Authenticated analytics must not report the identifiable subset as a complete audience
// when imported legacy views in the selected period have no stable viewer identity.
const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = String(input);
  if (url.endsWith('/auth/v1/user')) {
    return new Response(JSON.stringify({ id: 'test-admin' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('/rest/v1/admins?')) {
    return new Response(JSON.stringify([{ user_id: 'test-admin' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('Unexpected network request in analytics worker test: ' + url);
};
const adminEnv = {
  ...env,
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
};
const adminRequest = () => new Request('https://analytics.test/v1/admin/analytics?days=1', {
  method: 'GET',
  headers: { Origin: origin, Authorization: 'Bearer test-token' },
});
try {
  const completeReaders = await analyticsWorker.fetch(adminRequest(), adminEnv);
  assert.equal(completeReaders.status, 200, 'authenticated analytics should load');
  const completePayload = await completeReaders.json();
  assert.equal(completePayload.reader_metrics_limited, false, 'reader counts with stable identities should remain available');
  assert.equal(completePayload.current_views, 1, 'authenticated analytics should preserve real view totals');

  const now = new Date();
  const legacyHash = 'legacy-viewer-identity';
  const legacyKey = `analytics/views/events/${now.toISOString().slice(0, 10)}/${chapterId}/${legacyHash}.json`;
  await bucket.put(legacyKey, JSON.stringify({
    chapterId,
    viewerHash: legacyHash,
    createdAt: new Date(now.getTime() - 60_000).toISOString(),
  }));

  const incompleteReaders = await analyticsWorker.fetch(adminRequest(), adminEnv);
  assert.equal(incompleteReaders.status, 200, 'incomplete identity history must not hide view totals');
  const incompletePayload = await incompleteReaders.json();
  assert.equal(incompletePayload.current_views, 2, 'legacy and identified events must both count as views');
  assert.equal(incompletePayload.reader_metrics_limited, true, 'legacy identity gaps must flag reader counts as incomplete');
  assert.match(incompletePayload.reader_metrics_limited_reason, /stable viewer identities/i, 'the response should explain why reader counts are limited');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Analytics Worker R2 flow passed: view validation, persistence, idempotency, exact counts, stale-snapshot protection and reader-identity integrity.');
