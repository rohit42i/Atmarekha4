const DATASET_NAME = 'atma_rekha_views';
const DATASET_TABLE = `events.analyticsEngine."${DATASET_NAME}"`;
const ARCHIVE_PREFIX = 'analytics/views';
const SITE_ORIGINS = new Set([
  'https://www.atmarekha.in',
  'https://atmarekha.in',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const PERIODS = new Set([1, 7, 30, 90]);
const DAY_MS = 86400000;
const RETENTION_DAYS = 90;
const ADMIN_ANALYTICS_CACHE_TTL_MS = 10000;
const adminAnalyticsCache = new Map();

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': SITE_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request, body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      ...extra,
    },
  });
}

function text(request, body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function validChapterId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validViewerKey(value) {
  return typeof value === 'string' && value.length >= 16 && value.length <= 128;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function dayStart(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayKey(date) {
  return dayStart(date).toISOString().slice(0, 10);
}

function addDays(date, amount) {
  return new Date(dayStart(date).getTime() + amount * DAY_MS);
}

function monthKey(date) {
  return dayKey(date).slice(0, 7);
}

function monthObjectKey(month) {
  return `${ARCHIVE_PREFIX}/${month}.json`;
}

function summaryKey() {
  return `${ARCHIVE_PREFIX}/summary.json`;
}

function currentKey() {
  return `${ARCHIVE_PREFIX}/current.json`;
}

async function readJson(env, key, fallback) {
  const object = await env.ANALYTICS_BUCKET.get(key);
  if (!object) return fallback;
  try {
    return await object.json();
  } catch {
    return fallback;
  }
}

async function writeJson(env, key, value) {
  await env.ANALYTICS_BUCKET.put(key, JSON.stringify(value), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=60',
    },
  });
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

function createAnalyticsReadContext() {
  return {
    monthCache: new Map(),
    eventListCache: new Map(),
    eventBodyCache: new Map(),
    viewRowsCache: new Map(),
  };
}

async function readCachedMonth(env, month, context) {
  if (!context?.monthCache) return readJson(env, monthObjectKey(month), null);
  if (!context.monthCache.has(month)) {
    const pending = readJson(env, monthObjectKey(month), null).catch(error => {
      context.monthCache.delete(month);
      throw error;
    });
    context.monthCache.set(month, pending);
  }
  return context.monthCache.get(month);
}

async function listViewEventObjects(env, day, context) {
  const cache = context?.eventListCache;
  if (cache?.has(day)) return cache.get(day);
  const pending = (async () => {
    const prefix = `${ARCHIVE_PREFIX}/events/${day}/`;
    const objects = [];
    let cursor;
    do {
      const page = await env.ANALYTICS_BUCKET.list({
        prefix,
        limit: 1000,
        ...(cursor ? { cursor } : {}),
      });
      objects.push(...(page.objects || []));
      cursor = page.truncated ? page.cursor : null;
    } while (cursor);
    return objects;
  })();
  if (cache) cache.set(day, pending);
  try {
    return await pending;
  } catch (error) {
    if (cache?.get(day) === pending) cache.delete(day);
    throw error;
  }
}

async function readViewEvent(env, key, context) {
  const cache = context?.eventBodyCache;
  if (cache?.has(key)) return cache.get(key);
  const pending = (async () => {
    const stored = await env.ANALYTICS_BUCKET.get(key);
    if (!stored) return null;
    try { return await stored.json(); } catch { return null; }
  })();
  if (cache) cache.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    if (cache?.get(key) === pending) cache.delete(key);
    throw error;
  }
}

function periodDaySegments(start, end) {
  const segments = [];
  for (let cursor = dayStart(start); cursor < end; cursor = addDays(cursor, 1)) {
    const nextDay = addDays(cursor, 1);
    segments.push({
      cursor,
      day: dayKey(cursor),
      nextDay,
      start: new Date(Math.max(start.getTime(), cursor.getTime())),
      end: new Date(Math.min(end.getTime(), nextDay.getTime())),
      fullDay: start.getTime() <= cursor.getTime() && end.getTime() >= nextDay.getTime(),
    });
  }
  return segments;
}

async function viewRowsForPeriod(env, start, end, context = null) {
  if (!(start instanceof Date) || !(end instanceof Date) || start >= end) return [];
  const cache = context?.viewRowsCache;
  const cacheKey = `${start.getTime()}:${end.getTime()}`;
  if (cache?.has(cacheKey)) return cache.get(cacheKey);
  const pending = (async () => {
    const segments = periodDaySegments(start, end);
    const dailyRows = await mapWithConcurrency(segments, 8, async segment => {
      const prefix = `${ARCHIVE_PREFIX}/events/${segment.day}/`;
      const objects = await listViewEventObjects(env, segment.day, context);
      const counts = new Map();
      for (const object of objects) {
        const chapterId = object.key.slice(prefix.length).split('/')[0];
        if (!validChapterId(chapterId)) continue;
        if (!segment.fullDay) {
          const event = await readViewEvent(env, object.key, context);
          const createdAt = new Date(event?.createdAt || 0).getTime();
          if (!Number.isFinite(createdAt) || createdAt < start.getTime() || createdAt >= end.getTime()) continue;
        }
        counts.set(chapterId, (counts.get(chapterId) || 0) + 1);
      }
      return [...counts.entries()].map(([chapterId, views]) => ({ day: segment.day, chapterId, views }));
    });
    return dailyRows.flat();
  })();
  if (cache) cache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (error) {
    if (cache?.get(cacheKey) === pending) cache.delete(cacheKey);
    throw error;
  }
}

function mergeChapterCounts(target, source) {
  for (const row of source || []) {
    const id = String(row.chapterId || '');
    if (!id) continue;
    target[id] = (target[id] || 0) + Math.max(0, Number(row.views) || 0);
  }
}

function archiveRowsForPeriod(monthObject, start, end, target) {
  const days = monthObject?.days || {};
  for (const [day, record] of Object.entries(days)) {
    const d = new Date(`${day}T00:00:00Z`);
    if (d >= start && d < end) mergeChapterCounts(target, Object.entries(record?.chapters || {}).map(([chapterId, views]) => ({ chapterId, views })));
  }
}

function monthRange(start, end) {
  const result = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= limit) {
    result.push(monthKey(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return result;
}

async function archiveCountsForPeriod(env, start, end) {
  const target = {};
  for (const month of monthRange(start, end)) {
    const object = await readJson(env, monthObjectKey(month), null);
    if (object) archiveRowsForPeriod(object, start, end, target);
  }
  return target;
}

async function combinedPeriodCounts(env, start, end, context = null) {
  const result = {};
  if (!(start instanceof Date) || !(end instanceof Date) || start >= end) return result;
  const today = dayStart(new Date());
  const segments = periodDaySegments(start, end);
  const segmentCounts = await mapWithConcurrency(segments, 8, async segment => {
    let archived = null;
    if (segment.cursor < today) {
      const month = monthKey(segment.cursor);
      archived = (await readCachedMonth(env, month, context))?.days?.[segment.day] || null;
    }
    if (archived && archived.chapters && typeof archived.chapters === 'object' && segment.fullDay) {
      return Object.entries(archived.chapters).map(([chapterId, views]) => ({ chapterId, views }));
    }
    // A partial boundary must be read from timestamped events, never from a whole-day archive.
    return viewRowsForPeriod(env, segment.start, segment.end, context);
  });
  for (const rows of segmentCounts) mergeChapterCounts(result, rows);
  return result;
}

async function dailyTrendForPeriod(env, start, end, context = null) {
  const today = dayStart(new Date());
  const segments = periodDaySegments(start, end);
  return mapWithConcurrency(segments, 8, async segment => {
    let views;
    let archived = null;
    if (segment.cursor < today) {
      const month = monthKey(segment.cursor);
      archived = (await readCachedMonth(env, month, context))?.days?.[segment.day] || null;
    }
    // A whole-day archive is valid only for a whole-day reporting bucket. The first and
    // last bars are rolling-window slices and must be based on event timestamps.
    if (archived && segment.fullDay && archived.chapters && typeof archived.chapters === 'object') {
      const chapterCounts = archived.chapters;
      views = Math.max(0, Number(archived.views ?? Object.values(chapterCounts).reduce((sum, count) => sum + Number(count || 0), 0)) || 0);
    } else {
      const rows = await viewRowsForPeriod(env, segment.start, segment.end, context);
      views = rows.reduce((sum, row) => sum + Number(row.views || 0), 0);
    }
    return { day: segment.day, views, partial: !segment.fullDay };
  });
}

function dateKeyFromAnalytics(value) {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dayKey(date);
}

async function totalFromMap(map) {
  return Object.values(map).reduce((sum, value) => sum + Number(value || 0), 0);
}

async function readerMetrics(env, start, end, context = null) {
  if (!(start instanceof Date) || !(end instanceof Date) || start >= end) {
    return { activeReaders: 0, returningReaders: 0, unavailable: false };
  }

  const activeViewers = new Set();
  const activeDaysByViewer = new Map();
  const segments = periodDaySegments(start, end);

  try {
    for (let offset = 0; offset < segments.length; offset += 8) {
      const batch = segments.slice(offset, offset + 8);
      const dayResults = await mapWithConcurrency(batch, 8, async segment => {
        const prefix = ARCHIVE_PREFIX + '/events/' + segment.day + '/';
        const objects = await listViewEventObjects(env, segment.day, context);
        const viewers = [];
        for (const object of objects) {
          const parts = object.key.slice(prefix.length).split('/');
          const chapterId = parts[0];
          const viewerHash = String(parts[1] || '').replace('.json', '');
          if (!validChapterId(chapterId)) continue;

          if (!segment.fullDay) {
            const event = await readViewEvent(env, object.key, context);
            const createdAt = new Date(event?.createdAt || 0).getTime();
            if (!Number.isFinite(createdAt) || createdAt < start.getTime() || createdAt >= end.getTime()) continue;
          }

          const validHash = viewerHash.length === 64 && [...viewerHash].every(ch => '0123456789abcdefABCDEF'.includes(ch));
          if (!validHash) return { identityIncomplete: true, viewers: [] };
          viewers.push({ viewerHash, day: segment.day });
        }
        return { identityIncomplete: false, viewers };
      });

      if (dayResults.some(result => result.identityIncomplete)) {
        return {
          activeReaders: 0,
          returningReaders: 0,
          unavailable: true,
          reason: 'Historical view events lack stable viewer identities, so unique and returning reader counts are incomplete.',
          source: 'r2',
        };
      }

      for (const result of dayResults) {
        for (const { viewerHash, day } of result.viewers) {
          activeViewers.add(viewerHash);
          if (!activeDaysByViewer.has(viewerHash)) activeDaysByViewer.set(viewerHash, new Set());
          activeDaysByViewer.get(viewerHash).add(day);
        }
      }
    }

    let returningReaders = 0;
    for (const days of activeDaysByViewer.values()) {
      if (days.size >= 2) returningReaders++;
    }
    return { activeReaders: activeViewers.size, returningReaders, unavailable: false, reason: null, source: 'r2' };
  } catch (error) {
    const reason = error?.message || 'R2 reader metrics unavailable';
    return { activeReaders: 0, returningReaders: 0, unavailable: true, reason, error: reason };
  }
}

async function verifyAdmin(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) throw new Error('Worker is missing Supabase variables.');
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: auth,
    },
  });
  if (!userResponse.ok) return false;
  const user = await userResponse.json();
  if (!user?.id) return false;
  const adminResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`,
    {
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: auth,
      },
    },
  );
  if (!adminResponse.ok) return false;
  const admins = await adminResponse.json();
  return Array.isArray(admins) && admins.length > 0;
}

async function fetchLegacyRows(env, untilExclusive) {
  const rowsOut = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const url = new URL(`${env.SUPABASE_URL}/rest/v1/chapter_views`);
    url.searchParams.set('select', 'chapter_id,created_at');
    url.searchParams.set('created_at', `lt.${untilExclusive.toISOString()}`);
    url.searchParams.set('order', 'created_at.asc');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    const response = await fetch(url, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
    });
    if (!response.ok) throw new Error(`Legacy chapter view import failed (${response.status}).`);
    const page = await response.json();
    rowsOut.push(...(Array.isArray(page) ? page : []));
    if (!Array.isArray(page) || page.length < limit) break;
    offset += limit;
  }
  return rowsOut;
}

async function bootstrapLegacy(env, today) {
  const markerKey = `${ARCHIVE_PREFIX}/legacy-imported.json`;
  if (await env.ANALYTICS_BUCKET.head(markerKey)) return;
  const summary = await readJson(env, summaryKey(), {
    version: 1,
    processedThrough: null,
    chapterViews: {},
    updatedAt: null,
  });
  try {
    const legacyRows = await fetchLegacyRows(env, dayStart(today));
    const byDay = {};
    for (const row of legacyRows) {
      if (!validChapterId(row?.chapter_id)) continue;
      const day = dayKey(row.created_at);
      byDay[day] ||= {};
      byDay[day][row.chapter_id] = (byDay[day][row.chapter_id] || 0) + 1;
    }
    let latestDay = null;
    for (const [day, chapters] of Object.entries(byDay)) {
      const monthObject = await readJson(env, monthObjectKey(day.slice(0, 7)), { version: 1, month: day.slice(0, 7), days: {} });
      monthObject.days[day] = { views: Object.values(chapters).reduce((sum, value) => sum + value, 0), chapters };
      await writeJson(env, monthObjectKey(day.slice(0, 7)), monthObject);
      for (const [chapterId, count] of Object.entries(chapters)) summary.chapterViews[chapterId] = (summary.chapterViews[chapterId] || 0) + count;
      if (!latestDay || day > latestDay) latestDay = day;
    }
    summary.processedThrough = latestDay || summary.processedThrough;
    summary.updatedAt = new Date().toISOString();
    await writeJson(env, summaryKey(), summary);
    await writeJson(env, markerKey, { importedAt: new Date().toISOString(), rows: legacyRows.length });
  } catch (error) {
    // The import is best-effort. The live Analytics Engine path still works if
    // Supabase's legacy view table is not publicly readable.
    const chapterSummary = await fetch(`${env.SUPABASE_URL}/rest/v1/chapter_engagement_summary?select=chapter_id,views_count`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
    }).then(response => response.ok ? response.json() : []);
    for (const row of chapterSummary || []) {
      if (validChapterId(row?.chapter_id)) summary.chapterViews[row.chapter_id] = Number(row.views_count || 0);
    }
    summary.processedThrough = dayKey(addDays(today, -1));
    summary.updatedAt = new Date().toISOString();
    await writeJson(env, summaryKey(), summary);
    await writeJson(env, markerKey, { importedAt: new Date().toISOString(), rows: 0, fallback: true });
  }
}

async function archiveMissingDays(env, today) {
  const summary = await readJson(env, summaryKey(), {
    version: 1,
    processedThrough: null,
    chapterViews: {},
    updatedAt: null,
  });
  const target = addDays(today, -1);
  let cursor = summary.processedThrough ? addDays(summary.processedThrough, 1) : target;
  if (cursor > target) return summary;
  while (cursor <= target) {
    const dayEnd = addDays(cursor, 1);
    const rowsForDay = await viewRowsForPeriod(env, cursor, dayEnd);
    const month = monthKey(cursor);
    const monthObject = await readJson(env, monthObjectKey(month), { version: 1, month, days: {} });
    const day = dayKey(cursor);
    const existingRecord = monthObject.days[day];
    const eventChapters = Object.fromEntries(rowsForDay.map(row => [row.chapterId, row.views]));
    // Preserve older archived counts when the new live-event store has no rows for
    // a day that was already archived by the previous Analytics Engine pipeline.
    const chapters = Object.keys(eventChapters).length || !existingRecord
      ? eventChapters
      : (existingRecord.chapters || {});
    const total = Object.values(chapters).reduce((sum, value) => sum + Number(value || 0), 0);
    monthObject.days[day] = { views: total, chapters };
    await writeJson(env, monthObjectKey(month), monthObject);
    const oldChapters = existingRecord?.chapters || {};
    for (const chapterId of new Set([...Object.keys(oldChapters), ...Object.keys(chapters)])) {
      const delta = Number(chapters[chapterId] || 0) - Number(oldChapters[chapterId] || 0);
      if (delta) summary.chapterViews[chapterId] = Math.max(0, Number(summary.chapterViews[chapterId] || 0) + delta);
    }
    summary.processedThrough = day;
    summary.updatedAt = new Date().toISOString();
    cursor = dayEnd;
  }
  await writeJson(env, summaryKey(), summary);
  return summary;
}

async function updateCurrent(env, today) {
  const start = dayStart(today);
  const end = addDays(start, 1);
  const rowsForDay = await viewRowsForPeriod(env, start, end);
  const chapters = Object.fromEntries(rowsForDay.map(row => [row.chapterId, row.views]));
  await writeJson(env, currentKey(), {
    version: 1,
    day: dayKey(today),
    updatedAt: new Date().toISOString(),
    views: Object.values(chapters).reduce((sum, value) => sum + Number(value || 0), 0),
    chapterViews: chapters,
  });
}

async function ensureLegacyBootstrapped(env) {
  const markerKey = `${ARCHIVE_PREFIX}/legacy-imported.json`;
  if (await env.ANALYTICS_BUCKET.head(markerKey)) return;
  // Import legacy counts on demand so users do not wait for the next hourly cron.
  // Once written, the marker prevents repeated imports on subsequent requests.
  await bootstrapLegacy(env, dayStart(new Date()));
}

async function handleView(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return text(request, 'Invalid JSON body.', 400);
  }
  const chapterId = String(payload?.chapterId || '');
  const viewerKey = payload?.viewerKey;
  if (!validChapterId(chapterId) || !validViewerKey(viewerKey)) return text(request, 'Invalid chapter or viewer key.', 400);
  const viewerHash = await sha256(viewerKey);
  const createdAt = new Date();
  const eventKey = `${ARCHIVE_PREFIX}/events/${dayKey(createdAt)}/${chapterId}/${viewerHash}.json`;
  try {
    // R2 is the immediate source of truth for counts; a stable object key makes
    // retries idempotent for this browser/chapter/day and avoids counter races.
    await env.ANALYTICS_BUCKET.put(eventKey, JSON.stringify({
      chapterId,
      viewerHash,
      createdAt: createdAt.toISOString(),
    }), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  } catch (error) {
    return text(request, `Unable to persist view event: ${error?.message || 'storage error'}`, 503);
  }
  // R2 is the source of truth; this optional sink must never block view counts.
  try {
    if (typeof env.ANALYTICS?.writeDataPoint === 'function') {
      env.ANALYTICS.writeDataPoint({
        blobs: [chapterId, viewerHash],
        doubles: [1],
        indexes: ['atma-rekha'],
      });
    }
  } catch { /* The durable R2 event already recorded the view. */ }
  return json(request, { recorded: true });
}

async function handlePublicViews(request, env) {
  const ids = [...new Set(new URL(request.url).searchParams.getAll('chapterIds').join(',').split(',').map(value => value.trim()).filter(validChapterId))].slice(0, 100);
  if (!ids.length) return json(request, {});
  await ensureLegacyBootstrapped(env);
  const now = new Date();
  const today = dayStart(now);
  const [summary, liveToday] = await Promise.all([
    readJson(env, summaryKey(), { chapterViews: {} }),
    combinedPeriodCounts(env, today, new Date(now.getTime() + 1)),
  ]);
  const result = {};
  for (const id of ids) {
    const archived = Number(summary.chapterViews?.[id] || 0);
    // A successful R2 query is authoritative even when it returns zero for a chapter.
    // Never substitute a stale hourly snapshot for an actual zero.
    const liveCount = Number(liveToday[id] || 0);
    result[id] = archived + liveCount;
  }
  return json(request, result, 200, { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=20' });
}

async function buildAdminAnalytics(env, days) {
  await ensureLegacyBootstrapped(env);
  const now = new Date();
  const currentStart = new Date(now.getTime() - days * DAY_MS);
  const previousStart = new Date(now.getTime() - days * 2 * DAY_MS);
  const context = createAnalyticsReadContext();

  // These share per-request month, object-list, event-body, and period caches.
  // A view can be counted for the totals and trend without repeating the same R2 calls.
  const [summary, current, previous, currentReaders, dailyTrend, previousDailyTrend] = await Promise.all([
    readJson(env, summaryKey(), { chapterViews: {} }),
    combinedPeriodCounts(env, currentStart, now, context),
    combinedPeriodCounts(env, previousStart, currentStart, context),
    readerMetrics(env, currentStart, now, context),
    dailyTrendForPeriod(env, currentStart, now, context),
    dailyTrendForPeriod(env, previousStart, currentStart, context),
  ]);

  const liveToday = await combinedPeriodCounts(env, dayStart(now), new Date(now.getTime() + 1), context);
  const allTime = { ...(summary.chapterViews || {}) };
  // R2 is the source of truth for today's counts. An empty successful result is zero,
  // not a reason to resurrect values from a potentially stale hourly snapshot.
  for (const [id, count] of Object.entries(liveToday)) {
    allTime[id] = Number(allTime[id] || 0) + Number(count || 0);
  }

  const ids = new Set([...Object.keys(allTime), ...Object.keys(current), ...Object.keys(previous)]);
  const chapterStats = [...ids].map(id => ({
    id,
    views: Number(allTime[id] || 0),
    period_views: Number(current[id] || 0),
    previous_period_views: Number(previous[id] || 0),
  }));

  return {
    version: 1,
    total_views: await totalFromMap(allTime),
    current_views: await totalFromMap(current),
    previous_views: await totalFromMap(previous),
    active_readers: currentReaders.activeReaders,
    returning_readers: currentReaders.returningReaders,
    reader_metrics_limited: Boolean(currentReaders.unavailable),
    reader_metrics_limited_reason: currentReaders.reason || null,
    chapter_stats: chapterStats,
    daily_trend: dailyTrend,
    previous_daily_trend: previousDailyTrend,
    updated_at: new Date().toISOString(),
  };
}

async function handleAdminAnalytics(request, env) {
  if (!(await verifyAdmin(request, env))) return text(request, 'Admin authorization required.', 403);
  const days = Number(new URL(request.url).searchParams.get('days') || 30);
  if (!PERIODS.has(days)) return text(request, 'Analytics period must be 1, 7, 30 or 90 days.', 400);

  // Authorize every request before using this short-lived aggregate cache. It stores
  // no personal data and prevents the dashboard's parallel widgets from stampeding R2.
  const cached = adminAnalyticsCache.get(days);
  if (cached && cached.expiresAt > Date.now()) {
    const payload = cached.value || await cached.promise;
    return json(request, payload, 200, { 'Cache-Control': 'private, no-store' });
  }

  const entry = { expiresAt: Date.now() + ADMIN_ANALYTICS_CACHE_TTL_MS, value: null, promise: null };
  entry.promise = buildAdminAnalytics(env, days);
  adminAnalyticsCache.set(days, entry);
  try {
    const payload = await entry.promise;
    if (adminAnalyticsCache.get(days) === entry) {
      adminAnalyticsCache.set(days, { expiresAt: Date.now() + ADMIN_ANALYTICS_CACHE_TTL_MS, value: payload, promise: null });
    }
    return json(request, payload, 200, { 'Cache-Control': 'private, no-store' });
  } catch (error) {
    if (adminAnalyticsCache.get(days) === entry) adminAnalyticsCache.delete(days);
    throw error;
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
    try {
      const url = new URL(request.url);
      if (request.method === 'POST' && url.pathname === '/v1/view') return await handleView(request, env);
      if (request.method === 'GET' && url.pathname === '/v1/views') return await handlePublicViews(request, env);
      if (request.method === 'GET' && url.pathname === '/v1/admin/analytics') return await handleAdminAnalytics(request, env);
      return text(request, 'Not found.', 404);
    } catch (error) {
      return text(request, `Analytics worker error: ${error?.message || 'unknown error'}`, 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      const now = new Date();
      const today = dayStart(now);
      await bootstrapLegacy(env, today);
      await archiveMissingDays(env, today);
      await updateCurrent(env, today);
    })());
  },
};
