const DATASET_NAME = 'atma_rekha_views';
const DATASET_TABLE = `events.analyticsEngine."${DATASET_NAME}"`;
const ARCHIVE_PREFIX = 'analytics/views';
const JOURNEY_PREFIX = 'analytics/reader-journeys';
const SITE_ORIGINS = new Set([
  'https://www.atmarekha.in',
  'https://atmarekha.in',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const PERIODS = new Set([1, 7, 30, 90]);
const DAY_MS = 86400000;
const RETENTION_DAYS = 90;
const READER_INACTIVITY_MS = 30 * 60 * 1000;
const READER_DEVICE_TYPES = new Set(['mobile', 'tablet', 'desktop', 'unknown']);
const READER_ENTRY_SOURCES = new Set(['direct', 'search', 'social', 'internal', 'referral', 'unknown']);
const adminAnalyticsInFlight = new Map();

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
    eventMonthListCache: new Map(),
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
  const dayCache = context?.eventListCache;
  if (dayCache?.has(day)) return dayCache.get(day);

  const month = day.slice(0, 7);
  const monthCache = context?.eventMonthListCache;
  const monthPrefix = ARCHIVE_PREFIX + '/events/' + month + '-';
  let monthPending;
  if (monthCache?.has(month)) {
    monthPending = monthCache.get(month);
  } else {
    monthPending = (async () => {
      const objects = [];
      let cursor;
      do {
        const page = await env.ANALYTICS_BUCKET.list({
          prefix: monthPrefix,
          limit: 1000,
          ...(cursor ? { cursor } : {}),
        });
        objects.push(...(page.objects || []));
        cursor = page.truncated ? page.cursor : null;
      } while (cursor);
      return objects;
    })();
    if (monthCache) monthCache.set(month, monthPending);
  }

  const pending = (async () => {
    try {
      const monthlyObjects = await monthPending;
      const dayPrefix = ARCHIVE_PREFIX + '/events/' + day + '/';
      return monthlyObjects.filter(object => object.key.startsWith(dayPrefix));
    } catch (error) {
      if (monthCache?.get(month) === monthPending) monthCache.delete(month);
      throw error;
    }
  })();
  if (dayCache) dayCache.set(day, pending);
  try {
    return await pending;
  } catch (error) {
    if (dayCache?.get(day) === pending) dayCache.delete(day);
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
        const parts = object.key.slice(prefix.length).split('/');
        const chapterId = parts[0];
        if (!validChapterId(chapterId)) continue;
        if (!segment.fullDay) {
          const event = await readViewEvent(env, object.key, context);
          const createdAt = new Date(event?.createdAt || 0).getTime();
          if (!Number.isFinite(createdAt) || createdAt < segment.start.getTime() || createdAt >= segment.end.getTime()) continue;
        }
        const row = counts.get(chapterId) || { pageviews: 0, readerDays: 0 };
        if (parts[1] === 'visits') row.pageviews++;
        else row.readerDays++;
        counts.set(chapterId, row);
      }
      return [...counts.entries()].map(([chapterId, row]) => ({
        day: segment.day,
        chapterId,
        views: row.readerDays,
        readerDays: row.readerDays,
        pageviews: row.pageviews,
      }));
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
  for (const rows of segmentCounts) mergeChapterCounts(result, rows.map(row => ({
    chapterId: row.chapterId,
    views: row.readerDays ?? row.views ?? 0,
  })));
  return result;
}

async function combinedPeriodPageviews(env, start, end, context = null) {
  const result = {};
  if (!(start instanceof Date) || !(end instanceof Date) || start >= end) return result;
  // Page-open records are queried directly for the selected period. This avoids waiting
  // for the hourly archive job and keeps rolling-period counts exact.
  const segments = periodDaySegments(start, end);
  const segmentRows = await mapWithConcurrency(segments, 8, segment =>
    viewRowsForPeriod(env, segment.start, segment.end, context)
  );
  for (const rows of segmentRows) mergeChapterCounts(result, rows.map(row => ({
    chapterId: row.chapterId,
    views: row.pageviews || 0,
  })));
  return result;
}

async function dailyTrendForPeriod(env, start, end, context = null) {
  const today = dayStart(new Date());
  const segments = periodDaySegments(start, end);
  return mapWithConcurrency(segments, 8, async segment => {
    let archived = null;
    if (segment.cursor < today) {
      const month = monthKey(segment.cursor);
      archived = (await readCachedMonth(env, month, context))?.days?.[segment.day] || null;
    }
    // Whole-day archives are valid only for complete daily buckets. Rolling boundaries
    // are read from timestamped R2 events so the reporting window stays exact.
    const rows = (!archived || !segment.fullDay)
      ? await viewRowsForPeriod(env, segment.start, segment.end, context)
      : null;
    const readerDays = archived && segment.fullDay
      ? Math.max(0, Number(archived.readerDays ?? archived.views ?? 0))
      : (rows || []).reduce((sum, row) => sum + Number(row.readerDays ?? row.views ?? 0), 0);
    const pageviews = archived && segment.fullDay
      ? Math.max(0, Number(archived.pageviews || 0))
      : (rows || []).reduce((sum, row) => sum + Number(row.pageviews || 0), 0);
    return { day: segment.day, views: readerDays, reader_days: readerDays, pageviews, partial: !segment.fullDay };
  });
}

async function dailyPageviewTrendForPeriod(env, start, end, context = null) {
  const segments = periodDaySegments(start, end);
  return mapWithConcurrency(segments, 8, async segment => {
    const rows = await viewRowsForPeriod(env, segment.start, segment.end, context);
    return {
      day: segment.day,
      pageviews: rows.reduce((sum, row) => sum + Number(row.pageviews || 0), 0),
      partial: !segment.fullDay,
    };
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
          if (parts[1] === 'visits') continue;
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
    chapterPageviews: {},
    updatedAt: null,
  });
  summary.chapterPageviews ||= {};
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
      const existingDay = monthObject.days[day] || {};
      const readerDays = Object.values(chapters).reduce((sum, value) => sum + value, 0);
      monthObject.days[day] = {
        ...existingDay,
        views: readerDays,
        readerDays,
        chapters,
        pageviews: Math.max(0, Number(existingDay.pageviews || 0)),
        chapterPageviews: existingDay.chapterPageviews || {},
      };
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
    chapterPageviews: {},
    updatedAt: null,
  });
  summary.chapterPageviews ||= {};
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
    const eventReaderDays = Object.fromEntries(rowsForDay.map(row => [row.chapterId, row.readerDays ?? row.views ?? 0]));
    const eventPageviews = Object.fromEntries(rowsForDay.filter(row => row.pageviews > 0).map(row => [row.chapterId, row.pageviews]));
    // Preserve archived reader-day and pageview totals when their source events are no longer present.
    const chapters = Object.keys(eventReaderDays).length || !existingRecord
      ? eventReaderDays
      : (existingRecord.chapters || {});
    const chapterPageviews = Object.keys(eventPageviews).length || !existingRecord
      ? eventPageviews
      : (existingRecord.chapterPageviews || {});
    const total = Object.values(chapters).reduce((sum, value) => sum + Number(value || 0), 0);
    const pageviewTotal = Object.values(chapterPageviews).reduce((sum, value) => sum + Number(value || 0), 0);
    monthObject.days[day] = { views: total, readerDays: total, chapters, pageviews: pageviewTotal, chapterPageviews };
    await writeJson(env, monthObjectKey(month), monthObject);
    const oldChapters = existingRecord?.chapters || {};
    for (const chapterId of new Set([...Object.keys(oldChapters), ...Object.keys(chapters)])) {
      const delta = Number(chapters[chapterId] || 0) - Number(oldChapters[chapterId] || 0);
      if (delta) summary.chapterViews[chapterId] = Math.max(0, Number(summary.chapterViews[chapterId] || 0) + delta);
    }
    const oldPageviews = existingRecord?.chapterPageviews || {};
    for (const chapterId of new Set([...Object.keys(oldPageviews), ...Object.keys(chapterPageviews)])) {
      const delta = Number(chapterPageviews[chapterId] || 0) - Number(oldPageviews[chapterId] || 0);
      if (delta) summary.chapterPageviews[chapterId] = Math.max(0, Number(summary.chapterPageviews[chapterId] || 0) + delta);
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
  const chapters = Object.fromEntries(rowsForDay.map(row => [row.chapterId, row.readerDays ?? row.views ?? 0]));
  const chapterPageviews = Object.fromEntries(rowsForDay.filter(row => row.pageviews > 0).map(row => [row.chapterId, row.pageviews]));
  await writeJson(env, currentKey(), {
    version: 2,
    day: dayKey(today),
    updatedAt: new Date().toISOString(),
    views: Object.values(chapters).reduce((sum, value) => sum + Number(value || 0), 0),
    chapterViews: chapters,
    readerDays: Object.values(chapters).reduce((sum, value) => sum + Number(value || 0), 0),
    chapterPageviews,
    pageviews: Object.values(chapterPageviews).reduce((sum, value) => sum + Number(value || 0), 0),
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
  const visitId = payload?.visitId == null ? null : String(payload.visitId);
  if (!validChapterId(chapterId) || !validViewerKey(viewerKey)) return text(request, 'Invalid chapter or viewer key.', 400);
  if (visitId && !validJourneySessionId(visitId)) return text(request, 'Invalid chapter visit ID.', 400);
  const viewerHash = await sha256(viewerKey);
  const createdAt = new Date();
  const dayPrefix = `${ARCHIVE_PREFIX}/events/${dayKey(createdAt)}/${chapterId}/`;
  const uniqueReaderDayKey = dayPrefix + viewerHash + '.json';
  const pageviewKey = visitId ? dayPrefix + 'visits/' + visitId + '.json' : null;
  try {
    // One daily unique-browser/chapter record supports reader-day and returning-reader metrics.
    await env.ANALYTICS_BUCKET.put(uniqueReaderDayKey, JSON.stringify({
      chapterId,
      viewerHash,
      createdAt: createdAt.toISOString(),
      eventType: 'reader_day',
    }), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
    // Each successful chapter open receives an idempotent pageview record of its own.
    if (pageviewKey) {
      await env.ANALYTICS_BUCKET.put(pageviewKey, JSON.stringify({
        chapterId,
        visitId,
        viewerHash,
        createdAt: createdAt.toISOString(),
        eventType: 'chapter_open',
      }), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
    }
  } catch (error) {
    return text(request, `Unable to persist chapter open: ${error?.message || 'storage error'}`, 503);
  }
  // R2 is the source of truth; this optional sink must never block view counts.
  try {
    if (typeof env.ANALYTICS?.writeDataPoint === 'function') {
      env.ANALYTICS.writeDataPoint({
        blobs: [chapterId, viewerHash, visitId || 'legacy'],
        doubles: [1, visitId ? 1 : 0],
        indexes: ['atma-rekha'],
      });
    }
  } catch { /* The durable R2 event already recorded the view. */ }
  return json(request, { recorded: true, pageview: Boolean(visitId), readerDay: true });
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
  const [summary, current, previous, currentPageviews, previousPageviews, currentReaders, dailyTrend, previousDailyTrend, pageviewDailyTrend, previousPageviewDailyTrend] = await Promise.all([
    readJson(env, summaryKey(), { chapterViews: {}, chapterPageviews: {} }),
    combinedPeriodCounts(env, currentStart, now, context),
    combinedPeriodCounts(env, previousStart, currentStart, context),
    combinedPeriodPageviews(env, currentStart, now, context),
    combinedPeriodPageviews(env, previousStart, currentStart, context),
    readerMetrics(env, currentStart, now, context),
    dailyTrendForPeriod(env, currentStart, now, context),
    dailyTrendForPeriod(env, previousStart, currentStart, context),
    dailyPageviewTrendForPeriod(env, currentStart, now, context),
    dailyPageviewTrendForPeriod(env, previousStart, currentStart, context),
  ]);

  const liveToday = await combinedPeriodCounts(env, dayStart(now), new Date(now.getTime() + 1), context);
  const allTime = { ...(summary.chapterViews || {}) };
  // R2 is the source of truth for today's counts. An empty successful result is zero,
  // not a reason to resurrect values from a potentially stale hourly snapshot.
  for (const [id, count] of Object.entries(liveToday)) {
    allTime[id] = Number(allTime[id] || 0) + Number(count || 0);
  }

  const allTimePageviews = { ...(summary.chapterPageviews || {}) };
  const firstUnarchivedDay = summary.processedThrough
    ? dayStart(addDays(summary.processedThrough, 1))
    : dayStart(new Date(now.getTime() - RETENTION_DAYS * DAY_MS));
  const liveTodayPageviews = await combinedPeriodPageviews(env, firstUnarchivedDay, new Date(now.getTime() + 1), context);
  for (const [id, count] of Object.entries(liveTodayPageviews)) {
    allTimePageviews[id] = Number(allTimePageviews[id] || 0) + Number(count || 0);
  }

  const ids = new Set([
    ...Object.keys(allTime), ...Object.keys(current), ...Object.keys(previous),
    ...Object.keys(allTimePageviews), ...Object.keys(currentPageviews), ...Object.keys(previousPageviews),
  ]);
  const chapterStats = [...ids].map(id => ({
    id,
    views: Number(allTime[id] || 0),
    period_views: Number(current[id] || 0),
    previous_period_views: Number(previous[id] || 0),
    reader_days: Number(allTime[id] || 0),
    period_reader_days: Number(current[id] || 0),
    previous_period_reader_days: Number(previous[id] || 0),
    pageviews: Number(allTimePageviews[id] || 0),
    period_pageviews: Number(currentPageviews[id] || 0),
    previous_period_pageviews: Number(previousPageviews[id] || 0),
  }));

  return {
    version: 2,
    total_views: await totalFromMap(allTime),
    current_views: await totalFromMap(current),
    previous_views: await totalFromMap(previous),
    total_reader_days: await totalFromMap(allTime),
    current_reader_days: await totalFromMap(current),
    previous_reader_days: await totalFromMap(previous),
    total_pageviews: await totalFromMap(allTimePageviews),
    current_pageviews: await totalFromMap(currentPageviews),
    previous_pageviews: await totalFromMap(previousPageviews),
    active_readers: currentReaders.activeReaders,
    returning_readers: currentReaders.returningReaders,
    reader_metrics_limited: Boolean(currentReaders.unavailable),
    reader_metrics_limited_reason: currentReaders.reason || null,
    chapter_stats: chapterStats,
    daily_trend: dailyTrend,
    previous_daily_trend: previousDailyTrend,
    pageview_daily_trend: pageviewDailyTrend,
    previous_pageview_daily_trend: previousPageviewDailyTrend,
    updated_at: new Date().toISOString(),
  };
}

async function handleAdminAnalytics(request, env) {
  if (!(await verifyAdmin(request, env))) return text(request, 'Admin authorization required.', 403);
  const days = Number(new URL(request.url).searchParams.get('days') || 30);
  if (!PERIODS.has(days)) return text(request, 'Analytics period must be 1, 7, 30 or 90 days.', 400);

  // Authenticate every call. Coalesce concurrent identical aggregate requests, but
  // never reuse completed results so new views are visible on the next refresh.
  const pending = adminAnalyticsInFlight.get(days);
  if (pending) {
    const payload = await pending;
    return json(request, payload, 200, { 'Cache-Control': 'private, no-store' });
  }

  const task = buildAdminAnalytics(env, days);
  adminAnalyticsInFlight.set(days, task);
  try {
    const payload = await task;
    return json(request, payload, 200, { 'Cache-Control': 'private, no-store' });
  } finally {
    if (adminAnalyticsInFlight.get(days) === task) adminAnalyticsInFlight.delete(days);
  }
}


function validJourneySessionId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const JOURNEY_EXIT_REASONS = new Set([
  'next_chapter', 'previous_chapter', 'chapter_list', 'navigation', 'page_exit',
]);

async function handleReaderJourneyEvent(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return text(request, 'Invalid JSON body.', 400);
  }

  const eventType = String(payload?.eventType || '');
  const chapterId = String(payload?.chapterId || '');
  const sessionId = String(payload?.sessionId || '');
  const viewerKey = payload?.viewerKey;
  const totalPages = Number(payload?.totalPages);
  const pageNumber = payload?.pageNumber == null ? null : Number(payload.pageNumber);
  const chapterNumber = payload?.chapterNumber == null ? null : Number(payload.chapterNumber);
  const language = String(payload?.language || '');
  const deviceType = READER_DEVICE_TYPES.has(String(payload?.deviceType || '')) ? String(payload.deviceType) : 'unknown';
  const entrySource = READER_ENTRY_SOURCES.has(String(payload?.entrySource || '')) ? String(payload.entrySource) : 'unknown';

  if (!['start', 'progress', 'complete', 'exit', 'engagement'].includes(eventType)) {
    return text(request, 'Invalid reader journey event type.', 400);
  }
  if (!validChapterId(chapterId) || !validJourneySessionId(sessionId) || !validViewerKey(viewerKey)) {
    return text(request, 'Invalid chapter, session or viewer key.', 400);
  }
  if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 500) {
    return text(request, 'Invalid chapter page count.', 400);
  }
  if (chapterNumber !== null && (!Number.isInteger(chapterNumber) || chapterNumber < 0 || chapterNumber > 9999)) {
    return text(request, 'Invalid chapter number.', 400);
  }
  if (!['en', 'hi'].includes(language)) return text(request, 'Invalid chapter language.', 400);
  if (['progress', 'complete'].includes(eventType) &&
      (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > totalPages)) {
    return text(request, 'Invalid reader page number.', 400);
  }
  if (eventType === 'complete' && pageNumber !== totalPages) {
    return text(request, 'A chapter can only be completed on its final page.', 400);
  }
  const activeSeconds = payload?.activeSeconds == null ? null : Number(payload.activeSeconds);
  if (activeSeconds !== null && (!Number.isInteger(activeSeconds) || activeSeconds < 0 || activeSeconds > 86400)) {
    return text(request, 'Invalid active reading duration.', 400);
  }
  const engagementSequence = eventType === 'engagement' ? Number(payload?.sequence) : null;
  if (eventType === 'engagement' &&
      (activeSeconds === null || !Number.isInteger(engagementSequence) || engagementSequence < 1 || engagementSequence > 100000)) {
    return text(request, 'Invalid engagement event sequence.', 400);
  }
  if (eventType === 'exit' && pageNumber !== null &&
      (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > totalPages)) {
    return text(request, 'Invalid reader exit position.', 400);
  }
  const exitReason = eventType === 'exit' ? String(payload?.exitReason || 'page_exit') : null;
  if (eventType === 'exit' && !JOURNEY_EXIT_REASONS.has(exitReason)) {
    return text(request, 'Invalid reader exit reason.', 400);
  }
  const nextChapterId = eventType === 'exit' && payload?.nextChapterId != null
    ? String(payload.nextChapterId)
    : null;
  if (nextChapterId && !validChapterId(nextChapterId)) return text(request, 'Invalid next chapter ID.', 400);

  const viewerHash = await sha256(viewerKey);
  const createdAt = new Date();
  const day = dayKey(createdAt);
  const eventFile = eventType === 'progress'
    ? 'progress/' + pageNumber + '.json'
    : eventType === 'engagement'
      ? 'engagement/' + engagementSequence + '.json'
      : eventType + '.json';
  const key = JOURNEY_PREFIX + '/' + day + '/' + sessionId + '/' + eventFile;
  const record = {
    eventType,
    sessionId,
    chapterId,
    viewerHash,
    chapterNumber,
    language,
    deviceType,
    entrySource,
    totalPages,
    pageNumber,
    exitReason,
    nextChapterId,
    activeSeconds,
    sequence: engagementSequence,
    createdAt: createdAt.toISOString(),
  };

  try {
    await env.ANALYTICS_BUCKET.put(key, JSON.stringify(record), {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'private, no-store',
      },
    });
  } catch (error) {
    return text(request, 'Unable to persist reader journey event: ' + (error?.message || 'storage error'), 503);
  }
  return json(request, { recorded: true, eventType }, 200, { 'Cache-Control': 'no-store' });
}

async function readerJourneyObjectsForPeriod(env, start, end) {
  const months = monthRange(start, end);
  const monthObjects = await mapWithConcurrency(months, 4, async month => {
    const objects = [];
    let cursor;
    do {
      const page = await env.ANALYTICS_BUCKET.list({
        prefix: JOURNEY_PREFIX + '/' + month,
        limit: 1000,
        ...(cursor ? { cursor } : {}),
      });
      objects.push(...(page.objects || []));
      cursor = page.truncated ? page.cursor : null;
    } while (cursor);
    return objects;
  });
  const listed = monthObjects.flat();
  const rows = await mapWithConcurrency(listed, 16, async object => {
    try {
      const stored = await env.ANALYTICS_BUCKET.get(object.key);
      if (!stored) return null;
      const event = await stored.json();
      const createdAt = new Date(event?.createdAt || 0);
      if (!Number.isFinite(createdAt.getTime()) || createdAt < start || createdAt > end) return null;
      if (!validChapterId(event?.chapterId) || !validJourneySessionId(event?.sessionId) ||
          !['start', 'progress', 'complete', 'exit', 'engagement'].includes(event?.eventType)) return null;
      return event;
    } catch {
      return null;
    }
  });
  return rows.filter(Boolean);
}

function emptyJourneyDaily(day) {
  return { day, sessions: 0, completed: 0, exits: 0, inactive: 0 };
}

function isReaderSessionInactive(session, now) {
  if (!session || session.completed || session.exited) return false;
  const lastActivity = new Date(session.lastEventAt).getTime();
  return Number.isFinite(lastActivity) && now.getTime() - lastActivity >= READER_INACTIVITY_MS;
}

async function buildReaderJourneyAnalytics(env, days) {
  const now = new Date();
  const start = new Date(now.getTime() - days * DAY_MS);
  const events = await readerJourneyObjectsForPeriod(env, start, now);
  const eventOrder = { start: 0, engagement: 1, progress: 2, complete: 3, exit: 4 };
  events.sort((a, b) => {
    const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return byTime || eventOrder[a.eventType] - eventOrder[b.eventType];
  });

  const sessions = new Map();

  // Create every session from its start record first. Browser beacons and normal
  // fetches can arrive out of order, so processing the raw event stream once by
  // timestamp can otherwise discard an exit that reached R2 before its start.
  for (const event of events) {
    if (event.eventType !== 'start' || sessions.has(event.sessionId)) continue;
    sessions.set(event.sessionId, {
      sessionId: event.sessionId,
      chapterId: event.chapterId,
      viewerHash: event.viewerHash,
      chapterNumber: event.chapterNumber,
      language: event.language,
      deviceType: READER_DEVICE_TYPES.has(event.deviceType) ? event.deviceType : 'unknown',
      entrySource: READER_ENTRY_SOURCES.has(event.entrySource) ? event.entrySource : 'unknown',
      totalPages: Number(event.totalPages) || 0,
      startedAt: event.createdAt,
      lastEventAt: event.createdAt,
      pages: new Set(),
      exitPage: null,
      exitAt: null,
      exitReason: null,
      nextChapterId: null,
      completed: false,
      exited: false,
      activeSeconds: null,
    });
  }

  // Apply all non-start events after session creation, independent of arrival
  // order. Idempotent R2 object keys prevent duplicate events from inflating counts.
  for (const event of events) {
    if (event.eventType === 'start') continue;
    const session = sessions.get(event.sessionId);
    if (!session || event.chapterId !== session.chapterId || event.viewerHash !== session.viewerHash) continue;
    if (new Date(event.createdAt).getTime() >= new Date(session.lastEventAt).getTime()) {
      session.lastEventAt = event.createdAt;
    }
    if (event.activeSeconds != null && Number.isInteger(Number(event.activeSeconds)) && Number(event.activeSeconds) >= 0) {
      session.activeSeconds = Math.max(session.activeSeconds ?? 0, Number(event.activeSeconds));
    }
    if (!session.completed && event.eventType === 'progress' && Number.isInteger(Number(event.pageNumber))) {
      session.pages.add(Number(event.pageNumber));
    } else if (event.eventType === 'complete') {
      session.pages.add(Number(event.pageNumber));
      session.completed = true;
    } else if (event.eventType === 'exit') {
      session.exited = true;
      session.exitPage = event.pageNumber == null ? null : Number(event.pageNumber);
      session.exitAt = event.createdAt;
      session.exitReason = event.exitReason || 'page_exit';
      session.nextChapterId = event.nextChapterId || null;
    }
  }

  const validSessions = [...sessions.values()];
  const inactiveSessions = validSessions.filter(session => isReaderSessionInactive(session, now));
  const recentUnconfirmedSessions = validSessions.filter(session =>
    !session.completed && !session.exited && !isReaderSessionInactive(session, now)
  );
  const inactiveSessionIds = new Set(inactiveSessions.map(session => session.sessionId));
  const recentUnconfirmedSessionIds = new Set(recentUnconfirmedSessions.map(session => session.sessionId));
  const isSettledSession = session => session.completed || session.exited || inactiveSessionIds.has(session.sessionId);
  const chapterBuckets = new Map();
  const daily = new Map();
  const readerChapters = new Map();
  const allReaders = new Set();
  for (const session of validSessions) {
    allReaders.add(session.viewerHash);
    if (session.pages.size > 0) {
      if (!readerChapters.has(session.viewerHash)) readerChapters.set(session.viewerHash, new Set());
      readerChapters.get(session.viewerHash).add(session.chapterId);
    }

    if (!chapterBuckets.has(session.chapterId)) {
      chapterBuckets.set(session.chapterId, {
        chapter_id: session.chapterId,
        chapter_number: session.chapterNumber,
        language: session.language,
        sessions: [],
      });
    }
    chapterBuckets.get(session.chapterId).sessions.push(session);

    const day = dayKey(session.startedAt);
    if (!daily.has(day)) daily.set(day, emptyJourneyDaily(day));
    daily.get(day).sessions++;
    if (session.completed) daily.get(day).completed++;
    if (session.exited && !session.completed) daily.get(day).exits++;
    if (inactiveSessionIds.has(session.sessionId)) daily.get(day).inactive++;
  }

  const chapterStats = [...chapterBuckets.values()].map(chapter => {
    const rows = chapter.sessions;
    const completed = rows.filter(session => session.completed);
    const exits = rows.filter(session => session.exited && !session.completed);
    const reached = pageNumber => rows.filter(session => session.pages.has(pageNumber));
    const pagesRead = rows.reduce((sum, session) => sum + session.pages.size, 0);
    const completionValues = rows.map(session => session.totalPages > 0
      ? (Math.max(0, ...session.pages) / session.totalPages) * 100
      : 0);
    const durations = rows.filter(isSettledSession).map(session => {
      const elapsed = new Date(session.lastEventAt).getTime() - new Date(session.startedAt).getTime();
      return Math.max(0, elapsed / 1000);
    });
    const exitReasons = {};
    for (const session of exits) {
      const reason = session.exitReason || 'unknown';
      exitReasons[reason] = (exitReasons[reason] || 0) + 1;
    }
    const maxPages = Math.max(0, ...rows.map(session => session.totalPages));
    const pageStats = Array.from({ length: maxPages }, (_, index) => {
      const page = index + 1;
      const pageSessions = reached(page);
      const nextPageSessions = page < maxPages ? reached(page + 1) : [];
      const settledPageSessions = pageSessions.filter(isSettledSession);
      const nextPageSessionIds = new Set(nextPageSessions.map(session => session.sessionId));
      const exitSessions = exits.filter(session => session.exitPage === page);
      const dropOffRows = page < maxPages
        ? settledPageSessions.filter(session => !nextPageSessionIds.has(session.sessionId))
        : [];
      const dropOffSessions = dropOffRows.length;
      const inactiveAfterPage = dropOffRows.filter(session => inactiveSessionIds.has(session.sessionId)).length;
      return {
        page_number: page,
        sessions_reached: pageSessions.length,
        readers_reached: new Set(pageSessions.map(session => session.viewerHash)).size,
        next_page_sessions: nextPageSessions.length,
        settled_sessions: settledPageSessions.length,
        recent_unconfirmed_sessions: pageSessions.length - settledPageSessions.length,
        drop_off_sessions: dropOffSessions,
        inactive_after_page: inactiveAfterPage,
        drop_off_rate: settledPageSessions.length && page < maxPages
          ? (dropOffSessions / settledPageSessions.length) * 100
          : 0,
        exits_after_page: exitSessions.length,
        exit_readers: new Set(exitSessions.map(session => session.viewerHash)).size,
      };
    });
    return {
      chapter_id: chapter.chapter_id,
      chapter_number: chapter.chapter_number,
      language: chapter.language,
      sessions: rows.length,
      readers: new Set(rows.map(session => session.viewerHash)).size,
      completed_sessions: completed.length,
      explicit_exits: exits.length,
      unconfirmed_exits: rows.filter(session => !session.completed && !session.exited).length,
      inactive_sessions: rows.filter(session => inactiveSessionIds.has(session.sessionId)).length,
      recent_unconfirmed_sessions: rows.filter(session => recentUnconfirmedSessionIds.has(session.sessionId)).length,
      settled_sessions: rows.filter(isSettledSession).length,
      settled_completion_rate: rows.filter(isSettledSession).length
        ? completed.length / rows.filter(isSettledSession).length * 100
        : 0,
      next_chapter_clicks: rows.filter(session => session.exitReason === 'next_chapter').length,
      previous_chapter_clicks: rows.filter(session => session.exitReason === 'previous_chapter').length,
      chapter_list_exits: rows.filter(session => session.exitReason === 'chapter_list').length,
      page_exit_events: exits.filter(session => session.exitReason === 'page_exit').length,
      navigation_exits: exits.filter(session => session.exitReason === 'navigation').length,
      pages_read: pagesRead,
      average_pages_read: rows.length ? pagesRead / rows.length : 0,
      average_completion_percent: completionValues.length ? completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length : 0,
      average_reading_seconds: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
      average_engaged_seconds: rows.some(session => session.activeSeconds !== null)
        ? rows.filter(session => session.activeSeconds !== null).reduce((sum, session) => sum + session.activeSeconds, 0) /
          rows.filter(session => session.activeSeconds !== null).length
        : null,
      exit_reasons: exitReasons,
      page_stats: pageStats,
    };
  }).sort((a, b) => b.sessions - a.sessions || Number(a.chapter_number ?? 9999) - Number(b.chapter_number ?? 9999));

  const completedSessions = validSessions.filter(session => session.completed);
  const explicitExits = validSessions.filter(session => session.exited && !session.completed);
  const endedSessions = validSessions.filter(isSettledSession);
  const completionValues = validSessions.map(session => session.totalPages > 0
    ? (Math.max(0, ...session.pages) / session.totalPages) * 100
    : 0);
  const durations = endedSessions.map(session => Math.max(0, (
    new Date(session.lastEventAt).getTime() - new Date(session.startedAt).getTime()
  ) / 1000));
  const sessionsWithEngagement = validSessions.filter(session => session.activeSeconds !== null);
  const readerDepth = new Map();
  for (const chaptersRead of readerChapters.values()) {
    const bucket = chaptersRead.size >= 4 ? '4+' : String(chaptersRead.size);
    readerDepth.set(bucket, (readerDepth.get(bucket) || 0) + 1);
  }
  const depthRows = ['1', '2', '3', '4+'].map(chaptersRead => ({
    chapters_read: chaptersRead,
    readers: readerDepth.get(chaptersRead) || 0,
  }));
  const daysRows = periodDaySegments(start, now).map(segment => {
    const row = daily.get(segment.day) || emptyJourneyDaily(segment.day);
    return { ...row, partial: !segment.fullDay };
  });
  const pageReads = validSessions.reduce((sum, session) => sum + session.pages.size, 0);
  const transitionsByPair = new Map();
  for (const session of validSessions) {
    if (session.exitReason !== 'next_chapter' || !validChapterId(session.nextChapterId || '')) continue;
    const key = session.chapterId + '>' + session.nextChapterId;
    if (!transitionsByPair.has(key)) {
      transitionsByPair.set(key, {
        from_chapter_id: session.chapterId,
        to_chapter_id: session.nextChapterId,
        sessions: 0,
        readers: new Set(),
      });
    }
    const transition = transitionsByPair.get(key);
    transition.sessions++;
    transition.readers.add(session.viewerHash);
  }
  const chapterTransitions = [...transitionsByPair.values()].map(row => {
    const sourceSessions = validSessions.filter(session =>
      session.chapterId === row.from_chapter_id &&
      session.exitReason === 'next_chapter' &&
      session.nextChapterId === row.to_chapter_id
    );
    const followedThrough = sourceSessions.filter(source => {
      const exitTime = new Date(source.exitAt || source.lastEventAt).getTime();
      if (!Number.isFinite(exitTime)) return false;
      return validSessions.some(target => {
        const startTime = new Date(target.startedAt).getTime();
        return target.sessionId !== source.sessionId &&
          target.viewerHash === source.viewerHash &&
          target.chapterId === row.to_chapter_id &&
          target.pages.size > 0 &&
          startTime >= exitTime &&
          startTime - exitTime <= READER_INACTIVITY_MS;
      });
    });
    return {
      from_chapter_id: row.from_chapter_id,
      to_chapter_id: row.to_chapter_id,
      sessions: row.sessions,
      readers: row.readers.size,
      opened_sessions: followedThrough.length,
      opened_readers: new Set(followedThrough.map(session => session.viewerHash)).size,
      follow_through_rate: sourceSessions.length ? followedThrough.length / sourceSessions.length * 100 : 0,
    };
  }).sort((a, b) => b.sessions - a.sessions);

  for (const chapter of chapterStats) {
    const outgoing = chapterTransitions.filter(row => row.from_chapter_id === chapter.chapter_id);
    chapter.next_chapter_opens = outgoing.reduce((sum, row) => sum + row.opened_sessions, 0);
    chapter.next_chapter_follow_through_rate = chapter.next_chapter_clicks
      ? chapter.next_chapter_opens / chapter.next_chapter_clicks * 100
      : 0;
  }

  const buildBreakdown = field => {
    const buckets = new Map();
    for (const session of validSessions) {
      const key = String(session[field] || 'unknown');
      if (!buckets.has(key)) buckets.set(key, { value: key, sessions: 0, readers: new Set(), completed: 0 });
      const bucket = buckets.get(key);
      bucket.sessions++;
      bucket.readers.add(session.viewerHash);
      if (session.completed) bucket.completed++;
    }
    return [...buckets.values()].map(bucket => ({
      value: bucket.value,
      sessions: bucket.sessions,
      readers: bucket.readers.size,
      completed_sessions: bucket.completed,
      completion_rate: bucket.sessions ? bucket.completed / bucket.sessions * 100 : 0,
    })).sort((a, b) => b.sessions - a.sessions);
  };
  const eventCounts = Object.fromEntries(['start', 'progress', 'complete', 'exit', 'engagement'].map(type => [
    type, events.filter(event => event.eventType === type).length,
  ]));
  const openedSessions = chapterTransitions.reduce((sum, row) => sum + row.opened_sessions, 0);
  const nextChapterClicks = validSessions.filter(session => session.exitReason === 'next_chapter').length;

  const explicitReasonCounts = {};
  for (const session of explicitExits) {
    const reason = session.exitReason || 'unknown';
    explicitReasonCounts[reason] = (explicitReasonCounts[reason] || 0) + 1;
  }

  return {
    version: 1,
    has_data: validSessions.length > 0,
    days,
    summary: {
      unique_readers: allReaders.size,
      sessions: validSessions.length,
      completed_sessions: completedSessions.length,
      explicit_exits: explicitExits.length,
      inactive_sessions: inactiveSessions.length,
      recent_unconfirmed_sessions: recentUnconfirmedSessions.length,
      unconfirmed_exits: recentUnconfirmedSessions.length + inactiveSessions.length,
      settled_sessions: completedSessions.length + explicitExits.length + inactiveSessions.length,
      settled_completion_rate: (completedSessions.length + explicitExits.length + inactiveSessions.length)
        ? completedSessions.length / (completedSessions.length + explicitExits.length + inactiveSessions.length) * 100
        : 0,
      next_chapter_clicks: nextChapterClicks,
      next_chapter_opens: openedSessions,
      next_chapter_follow_through_rate: nextChapterClicks ? openedSessions / nextChapterClicks * 100 : 0,
      previous_chapter_clicks: validSessions.filter(session => session.exitReason === 'previous_chapter').length,
      chapter_list_exits: validSessions.filter(session => session.exitReason === 'chapter_list').length,
      page_exit_events: explicitExits.filter(session => session.exitReason === 'page_exit').length,
      navigation_exits: explicitExits.filter(session => session.exitReason === 'navigation').length,
      pages_read: pageReads,
      average_pages_read: validSessions.length ? pageReads / validSessions.length : 0,
      average_completion_percent: completionValues.length ? completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length : 0,
      average_reading_seconds: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
      average_engaged_seconds: sessionsWithEngagement.length
        ? sessionsWithEngagement.reduce((sum, session) => sum + session.activeSeconds, 0) / sessionsWithEngagement.length
        : null,
      completion_rate: validSessions.length ? completedSessions.length / validSessions.length * 100 : 0,
      exit_reasons: explicitReasonCounts,
    },
    chapters: chapterStats,
    chapter_transitions: chapterTransitions,
    daily_trend: daysRows,
    reader_depth: depthRows,
    device_breakdown: buildBreakdown('deviceType'),
    source_breakdown: buildBreakdown('entrySource'),
    tracking_health: {
      total_events: events.length,
      event_counts: eventCounts,
      first_event_at: events.length ? events[0].createdAt : null,
      last_event_at: events.length ? events[events.length - 1].createdAt : null,
      inactivity_threshold_minutes: READER_INACTIVITY_MS / 60000,
    },
    updated_at: new Date().toISOString(),
  };
}

async function handleAdminReaderAnalytics(request, env) {
  if (!(await verifyAdmin(request, env))) return text(request, 'Admin authorization required.', 403);
  const days = Number(new URL(request.url).searchParams.get('days') || 30);
  if (!PERIODS.has(days)) return text(request, 'Analytics period must be 1, 7, 30 or 90 days.', 400);
  const payload = await buildReaderJourneyAnalytics(env, days);
  return json(request, payload, 200, { 'Cache-Control': 'private, no-store' });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
    try {
      const url = new URL(request.url);
      if (request.method === 'POST' && url.pathname === '/v1/view') return await handleView(request, env);
      if (request.method === 'POST' && url.pathname === '/v1/reader-event') return await handleReaderJourneyEvent(request, env);
      if (request.method === 'GET' && url.pathname === '/v1/views') return await handlePublicViews(request, env);
      if (request.method === 'GET' && url.pathname === '/v1/admin/analytics') return await handleAdminAnalytics(request, env);
      if (request.method === 'GET' && url.pathname === '/v1/admin/reader-analytics') return await handleAdminReaderAnalytics(request, env);
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
