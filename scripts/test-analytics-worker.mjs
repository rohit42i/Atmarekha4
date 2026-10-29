import assert from 'node:assert/strict';
import analyticsWorker from '../analytics-worker/worker.js';

class MemoryR2 {
  constructor() {
    this.objects = new Map();
    this.listCallsByPrefix = new Map();
    this.getCallsByKey = new Map();
  }

  async put(key, value, options = {}) {
    const text = typeof value === 'string' ? value : String(value);
    this.objects.set(key, { text, options });
    return { key };
  }

  async get(key) {
    this.getCallsByKey.set(key, (this.getCallsByKey.get(key) || 0) + 1);
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
    this.listCallsByPrefix.set(prefix, (this.listCallsByPrefix.get(prefix) || 0) + 1);
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
const adminRequest = (days = 1) => new Request('https://analytics.test/v1/admin/analytics?days=' + days, {
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

  // R2 archive counts represent whole UTC days. A rolling window's first day must
  // instead count only timestamped events inside the selected 24 hours.
  const nowForWindow = Date.now();
  const yesterday = new Date(nowForWindow - 24 * 60 * 60 * 1000);
  const yesterdayDay = yesterday.toISOString().slice(0, 10);
  const archiveMonth = yesterdayDay.slice(0, 7);
  const archiveKey = 'analytics/views/' + archiveMonth + '.json';
  const archiveObject = await (async () => {
    const stored = await bucket.get(archiveKey);
    return stored ? stored.json() : { version: 1, month: archiveMonth, days: {} };
  })();
  archiveObject.days[yesterdayDay] = { views: 99, chapters: { [chapterId]: 99 } };
  await bucket.put(archiveKey, JSON.stringify(archiveObject));

  const inRangeTime = new Date(nowForWindow - 23 * 60 * 60 * 1000);
  const outOfRangeTime = new Date(nowForWindow - 25 * 60 * 60 * 1000);
  const inRangeHash = 'a'.repeat(64);
  const outOfRangeHash = 'b'.repeat(64);
  await bucket.put('analytics/views/events/' + yesterdayDay + '/' + chapterId + '/' + inRangeHash + '.json', JSON.stringify({
    chapterId, viewerHash: inRangeHash, createdAt: inRangeTime.toISOString(),
  }));
  await bucket.put('analytics/views/events/' + yesterdayDay + '/' + chapterId + '/' + outOfRangeHash + '.json', JSON.stringify({
    chapterId, viewerHash: outOfRangeHash, createdAt: outOfRangeTime.toISOString(),
  }));

  const callsBeforeWindow = new Map(bucket.listCallsByPrefix);
  const rolling = await analyticsWorker.fetch(adminRequest(), adminEnv);
  assert.equal(rolling.status, 200, 'rolling window analytics should load');
  const rollingPayload = await rolling.json();
  const firstDay = rollingPayload.daily_trend.find(row => row.day === yesterdayDay);
  assert.ok(firstDay, 'rolling trend should include its first partial UTC day');
  assert.equal(firstDay.partial, true, 'the first rolling day should be marked partial');
  assert.equal(firstDay.views, 1, 'partial-day trend must ignore archived all-day totals and out-of-window events');

  // The totals, daily trend and reader panels share the same R2 day listings
  // within a request instead of repeating a prefix listing for the same date.
  for (const [prefix, count] of bucket.listCallsByPrefix) {
    const before = callsBeforeWindow.get(prefix) || 0;
    assert.ok(count - before <= 1, 'same R2 prefix should be listed at most once per analytics request: ' + prefix);
  }
  const dayRootPrefix = 'analytics/views/events/';
  const dailyPrefixQueries = [...bucket.listCallsByPrefix.keys()].filter(prefix => {
    const suffix = prefix.slice(dayRootPrefix.length);
    return prefix.startsWith(dayRootPrefix) && suffix.length === 11 && suffix.endsWith('/') && suffix.slice(0, 10).includes('-');
  }).filter(prefix => (bucket.listCallsByPrefix.get(prefix) || 0) > (callsBeforeWindow.get(prefix) || 0));
  assert.equal(dailyPrefixQueries.length, 0, 'analytics should list event objects by month, not issue one R2 list request per day');
  const rollingMonthPrefix = dayRootPrefix + archiveMonth + '-';
  assert.ok(bucket.listCallsByPrefix.get(rollingMonthPrefix) > (callsBeforeWindow.get(rollingMonthPrefix) || 0), 'analytics should build the trend from a month-scoped event listing');

  // The 90-day view must complete without one R2 listing per day. Current and
  // previous trends must exactly reconcile with their respective aggregate totals.
  const callsBeforeLongWindow = new Map(bucket.listCallsByPrefix);
  const longWindowResponse = await analyticsWorker.fetch(adminRequest(90), adminEnv);
  assert.equal(longWindowResponse.status, 200, '90-day analytics should load');
  const longWindow = await longWindowResponse.json();
  assert.ok(longWindow.daily_trend.length >= 89 && longWindow.daily_trend.length <= 92, '90-day trend should cover its rolling date range');
  assert.ok(longWindow.previous_daily_trend.length >= 89 && longWindow.previous_daily_trend.length <= 92, 'previous 90-day trend should cover its rolling date range');
  assert.equal(
    longWindow.daily_trend.reduce((sum, row) => sum + row.views, 0),
    longWindow.current_views,
    'current 90-day trend buckets must reconcile with current view totals',
  );
  assert.equal(
    longWindow.previous_daily_trend.reduce((sum, row) => sum + row.views, 0),
    longWindow.previous_views,
    'previous 90-day trend buckets must reconcile with previous view totals',
  );
  assert.equal(
    longWindow.chapter_stats.reduce((sum, row) => sum + row.views, 0),
    longWindow.total_views,
    'chapter lifetime counts must reconcile with all-time views',
  );
  assert.equal(
    longWindow.chapter_stats.reduce((sum, row) => sum + row.period_views, 0),
    longWindow.current_views,
    'chapter period counts must reconcile with current view totals',
  );
  assert.equal(
    longWindow.chapter_stats.reduce((sum, row) => sum + row.previous_period_views, 0),
    longWindow.previous_views,
    'chapter previous-period counts must reconcile with previous view totals',
  );
  const eventRoot = 'analytics/views/events/';
  const changedMonthlyPrefixes = [...bucket.listCallsByPrefix].filter(([prefix, count]) => {
    const suffix = prefix.slice(eventRoot.length);
    return prefix.startsWith(eventRoot) && /^\\d{4}-\\d{2}-$/.test(suffix) &&
      count > (callsBeforeLongWindow.get(prefix) || 0);
  });
  assert.ok(changedMonthlyPrefixes.length <= 7, 'a 90-day comparison should list no more than seven event months');
  for (const [prefix, count] of changedMonthlyPrefixes) {
    assert.equal(count - (callsBeforeLongWindow.get(prefix) || 0), 1, 'event months should be cached once per request: ' + prefix);
  }
  const changedDailyPrefixes = [...bucket.listCallsByPrefix].filter(([prefix, count]) => {
    const suffix = prefix.slice(eventRoot.length);
    return prefix.startsWith(eventRoot) && /^\\d{4}-\\d{2}-\\d{2}\\/$/.test(suffix) &&
      count > (callsBeforeLongWindow.get(prefix) || 0);
  });
  assert.equal(changedDailyPrefixes.length, 0, 'a 90-day comparison must not issue one R2 listing per day');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Analytics Worker R2 flow passed: view validation, persistence, idempotency, exact counts, stale-snapshot protection and reader-identity integrity.');
