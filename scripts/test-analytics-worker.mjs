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

  const journeyChapterTwo = 'f3bfec99-d077-43ca-977a-345e7f0b2298';
  const journeyViewerTwo = 'reader-journey-test-viewer-0123456789';
  const journeySessions = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
  ];
  const journeyPost = payload => analyticsWorker.fetch(
    request('https://analytics.test/v1/reader-event', 'POST', origin, payload),
    env,
  );
  const baseJourney = {
    chapterId,
    chapterNumber: 1,
    language: 'en',
    totalPages: 3,
  };
  const journeyStart = (sessionId, key, chapter = baseJourney) => ({
    ...chapter, sessionId, viewerKey: key, eventType: 'start',
  });
  const journeyProgress = (sessionId, key, pageNumber, chapter = baseJourney) => ({
    ...chapter, sessionId, viewerKey: key, eventType: 'progress', pageNumber,
  });

  const invalidJourney = await journeyPost({
    ...baseJourney, sessionId: 'not-a-session', viewerKey, eventType: 'start',
  });
  assert.equal(invalidJourney.status, 400, 'reader journey must reject malformed session IDs');

  const journeyEvents = [
    journeyStart(journeySessions[0], viewerKey),
    journeyProgress(journeySessions[0], viewerKey, 1),
    journeyProgress(journeySessions[0], viewerKey, 2),
    {
      ...baseJourney, sessionId: journeySessions[0], viewerKey, eventType: 'exit',
      pageNumber: 2, exitReason: 'page_exit',
    },
    journeyStart(journeySessions[1], journeyViewerTwo),
    journeyProgress(journeySessions[1], journeyViewerTwo, 1),
    journeyProgress(journeySessions[1], journeyViewerTwo, 2),
    journeyProgress(journeySessions[1], journeyViewerTwo, 3),
    {
      ...baseJourney, sessionId: journeySessions[1], viewerKey: journeyViewerTwo,
      eventType: 'complete', pageNumber: 3,
    },
    journeyStart(journeySessions[2], viewerKey, {
      chapterId: journeyChapterTwo, chapterNumber: 2, language: 'en', totalPages: 2,
    }),
    journeyProgress(journeySessions[2], viewerKey, 1, {
      chapterId: journeyChapterTwo, chapterNumber: 2, language: 'en', totalPages: 2,
    }),
    {
      chapterId: journeyChapterTwo, chapterNumber: 2, language: 'en', totalPages: 2,
      sessionId: journeySessions[2], viewerKey, eventType: 'exit',
      pageNumber: 1, exitReason: 'next_chapter',
    },
    journeyStart('44444444-4444-4444-8444-444444444444', journeyViewerTwo, {
      chapterId: journeyChapterTwo, chapterNumber: 2, language: 'en', totalPages: 2,
    }),
    {
      chapterId: journeyChapterTwo, chapterNumber: 2, language: 'en', totalPages: 2,
      sessionId: '44444444-4444-4444-8444-444444444444', viewerKey: journeyViewerTwo,
      eventType: 'exit', pageNumber: 1, exitReason: 'navigation',
    },
  ];
  for (const event of journeyEvents) {
    const result = await journeyPost(event);
    assert.equal(result.status, 200, 'valid reader journey events must be accepted: ' + event.eventType);
  }
  const repeatedPage = await journeyPost(journeyProgress(journeySessions[0], viewerKey, 2));
  assert.equal(repeatedPage.status, 200, 'repeated page progress should be idempotent');

  const journeyDay = new Date().toISOString().slice(0, 10);
  const journeyStartObject = await bucket.get('analytics/reader-journeys/' + journeyDay + '/' + journeySessions[0] + '/start.json');
  assert.ok(journeyStartObject, 'the reader session start must be persisted in R2');
  const storedJourneyStart = await journeyStartObject.json();
  assert.equal(storedJourneyStart.viewerHash.length, 64, 'journey storage must contain a hashed browser key');
  assert.equal(JSON.stringify(storedJourneyStart).includes(viewerKey), false, 'raw browser identifiers must not be written to journey objects');

  const journeyAdminRequest = () => new Request('https://analytics.test/v1/admin/reader-analytics?days=7', {
    method: 'GET',
    headers: { Origin: origin, Authorization: 'Bearer test-token' },
  });
  const journeyAnalyticsResponse = await analyticsWorker.fetch(journeyAdminRequest(), adminEnv);
  assert.equal(journeyAnalyticsResponse.status, 200, 'authenticated reader journey analytics must load');
  const journeyAnalytics = await journeyAnalyticsResponse.json();
  assert.equal(journeyAnalytics.summary.unique_readers, 2, 'journey readers should deduplicate sessions by anonymous browser key');
  assert.equal(journeyAnalytics.summary.sessions, 4, 'journey analytics should count all four chapter sessions');
  assert.equal(journeyAnalytics.summary.completed_sessions, 1, 'the final page event should count as a completion');
  assert.equal(journeyAnalytics.summary.explicit_exits, 3, 'journey analytics should distinguish explicit exits');
  assert.equal(journeyAnalytics.summary.navigation_exits, 1, 'non-specific navigation away should be counted separately');
  assert.equal(journeyAnalytics.summary.next_chapter_clicks, 1, 'next chapter navigation should have its own exit reason');
  assert.equal(journeyAnalytics.summary.pages_read, 6, 'page exposure events should be counted once per session and page');
  const firstChapterJourney = journeyAnalytics.chapters.find(row => row.chapter_id === chapterId);
  assert.ok(firstChapterJourney, 'chapter page funnel should include the tracked chapter');
  assert.equal(firstChapterJourney.sessions, 2, 'chapter funnel should count both chapter sessions');
  assert.equal(firstChapterJourney.readers, 2, 'chapter funnel should count unique browser identities');
  assert.equal(firstChapterJourney.completed_sessions, 1, 'chapter funnel should expose completed sessions');
  assert.equal(firstChapterJourney.page_stats[2].readers_reached, 1, 'page funnel should expose unique readers who reached the last page');
  assert.equal(firstChapterJourney.page_stats[1].exits_after_page, 1, 'page funnel should identify exits after page two');
  assert.equal(journeyAnalytics.chapter_transitions.find(row => row.from_chapter_id === chapterId && row.to_chapter_id === journeyChapterTwo)?.readers, 1, 'chapter movement should identify readers who actually opened the next chapter');

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
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Analytics Worker R2 flow passed: view validation, persistence, idempotency, exact counts, stale-snapshot protection and reader-identity integrity.');
