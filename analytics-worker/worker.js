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

async function viewRowsForPeriod(env, start, end) {
  if (!(start instanceof Date) || !(end instanceof Date) || start >= end) return [];
  const counts = new Map();
  for (let cursor = dayStart(start); cursor < end; cursor = addDays(cursor, 1)) {
    const day = dayKey(cursor);
    const nextDay = addDays(cursor, 1);
    const prefix = `${ARCHIVE_PREFIX}/events/${day}/`;
    const isFullDay = start <= cursor && end >= nextDay;
    let pageCursor;
    do {
      const page = await env.ANALYTICS_BUCKET.list({
        prefix,
        limit: 1000,
        ...(pageCursor ? { cursor: pageCursor } : {}),
      });
      for (const object of page.objects || []) {
        const chapterId = object.key.slice(prefix.length).split('/')[0];
        if (!validChapterId(chapterId)) continue;
        if (!isFullDay) {
          const stored = await env.ANALYTICS_BUCKET.get(object.key);
          if (!stored) continue;
          let event;
          try { event = await stored.json(); } catch { continue; }
          const createdAt = new Date(event?.createdAt || 0).getTime();
          if (!Number.isFinite(createdAt) || createdAt < start.getTime() || createdAt >= end.getTime()) continue;
        }
        const key = day + ':' + chapterId;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      pageCursor = page.truncated ? page.cursor : null;
    } while (pageCursor);
  }
  return [...counts.entries()].map(([key, views]) => {
    const separator = key.indexOf(':');
    return { day: key.slice(0, separator), chapterId: key.slice(separator + 1), views };
  });
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

async function combinedPeriodCounts(env, start, end) {
  const result = {};
  if (!(start instanceof Date) || !(end instanceof Date) || start >= end) return result;
  const today = dayStart(new Date());
  const monthCache = new Map();
  for (let cursor = dayStart(start); cursor < end; cursor = addDays(cursor, 1)) {
    const day = dayKey(cursor);
    const nextDay = addDays(cursor, 1);
    const segmentStart = new Date(Math.max(start.getTime(), cursor.getTime()));
    const segmentEnd = new Date(Math.min(end.getTime(), nextDay.getTime()));
    let archived = null;
    if (cursor < today) {
      const month = monthKey(cursor);
      if (!monthCache.has(month)) {
        monthCache.set(month, await readJson(env, monthObjectKey(month), null));
      }
      archived = monthCache.get(month)?.days?.[day] || null;
    }
    const isFullDay = segmentStart.getTime() === cursor.getTime() && segmentEnd.getTime() === nextDay.getTime();
    if (archived && archived.chapters && typeof archived.chapters === 'object' && isFullDay) {
      mergeChapterCounts(result, Object.entries(archived.chapters).map(([chapterId, views]) => ({ chapterId, views })));
      continue;
    }
    // Rolling windows often start partway through a UTC day. For those boundary
    // slices, count timestamped R2 events instead of including a whole daily archive.
    mergeChapterCounts(result, await viewRowsForPeriod(env, segmentStart, segmentEnd));
  }
  return result;
}

async function dailyTrendForPeriod(env, start, end) {
  const trend = [];
  const today = dayStart(new Date());
  const monthCache = new Map();
  for (let cursor = dayStart(start); cursor < end; cursor = addDays(cursor, 1)) {
    const day = dayKey(cursor);
    const nextDay = addDays(cursor, 1);
    const segmentStart = new Date(Math.max(start.getTime(), cursor.getTime()));
    const segmentEnd = new Date(Math.min(end.getTime(), nextDay.getTime()));
    let views = 0;
    if (cursor < today) {
      const month = monthKey(cursor);
      if (!monthCache.has(month)) monthCache.set(month, await readJson(env, monthObjectKey(month), null));
      const record = monthCache.get(month)?.days?.[day];
      if (record) {
        const chapterCounts = record.chapters || {};
        views = Math.max(0, Number(record.views ?? Object.values(chapterCounts).reduce((sum, count) => sum + Number(count || 0), 0)) || 0);
      } else {
        views = (await viewRowsForPeriod(env, segmentStart, segmentEnd)).reduce((sum, row) => sum + Number(row.views || 0), 0);
      }
    } else {
      views = (await viewRowsForPeriod(env, segmentStart, segmentEnd)).reduce((sum, row) => sum + Number(row.views || 0), 0);
    }
    trend.push({ day, views, partial: cursor < start || nextDay > end });
  }
  return trend;
}

function dateKeyFromAnalytics(value) {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dayKey(date);
}

async function totalFromMap(map) {
  return Object.values(map).reduce((sum, value) => sum + Number(value || 0), 0);
}

async function readerMetrics(env, start, end) {
  if (!(start instanceof Date) || !(end instanceof Date) || start >= end) {
    return { activeReaders: 0, returningReaders: 0, unavailable: false };
  }

  // R2 is already the durable source of truth for view events. Use the hashed
  // viewer identity in each event key to calculate reader counts even when
  // Analytics Engine is disabled or no SQL binding is available.
  const activeViewers = new Set();
  const activeDaysByViewer = new Map();
  let identityIncomplete = false;
  try {
    for (let cursor = dayStart(start); cursor < end; cursor = addDays(cursor, 1)) {
      const day = dayKey(cursor);
      const nextDay = addDays(cursor, 1);
      const prefix = `${ARCHIVE_PREFIX}/events/${day}/`;
      const isFullDay = start.getTime() <= cursor.getTime() && end.getTime() >= nextDay.getTime();
      let pageCursor;
      do {
        const page = await env.ANALYTICS_BUCKET.list({
          prefix,
          limit: 1000,
          ...(pageCursor ? { cursor: pageCursor } : {}),
        });
        for (const object of page.objects || []) {
          const parts = object.key.slice(prefix.length).split('/');
          const chapterId = parts[0];
          const viewerHash = String(parts[1] || '').replace(/\.json$/i, '');
          if (!validChapterId(chapterId)) continue;

          // Boundary days contain events outside a rolling window. Validate timestamps
          // before flagging missing identity, otherwise an out-of-window legacy event
          // could incorrectly mark this reporting period as incomplete.
          if (!isFullDay) {
            const stored = await env.ANALYTICS_BUCKET.get(object.key);
            if (!stored) continue;
            let event;
            try { event = await stored.json(); } catch { continue; }
            const createdAt = new Date(event?.createdAt || 0).getTime();
            if (!Number.isFinite(createdAt) || createdAt < start.getTime() || createdAt >= end.getTime()) continue;
          }

          if (!/^[a-f0-9]{64}$/i.test(viewerHash)) {
            // Imported legacy views preserve counts, but do not contain a recoverable
            // viewer identity. Never present the identifiable subset as a complete
            // active/returning reader count.
            identityIncomplete = true;
            continue;
          }

          activeViewers.add(viewerHash);
          if (!activeDaysByViewer.has(viewerHash)) activeDaysByViewer.set(viewerHash, new Set());
          activeDaysByViewer.get(viewerHash).add(day);
        }
        pageCursor = page.truncated ? page.cursor : null;
      } while (pageCursor);
    }

    let returningReaders = 0;
    for (const days of activeDaysByViewer.values()) {
      if (days.size >= 2) returningReaders++;
    }
    return {
      activeReaders: activeViewers.size,
      returningReaders,
      unavailable: identityIncomplete,
      reason: identityIncomplete
        ? 'Historical view events lack stable viewer identities, so unique and returning reader counts are incomplete.'
        : null,
      source: 'r2',
    };
  } catch (error) {
    const reason = error?.message || 'R2 reader metrics unavailable';
    return {
      activeReaders: 0,
      returningReaders: 0,
      unavailable: true,
      reason,
      error: reason,
    };
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

async function handleAdminAnalytics(request, env) {
  if (!(await verifyAdmin(request, env))) return text(request, 'Admin authorization required.', 403);
  await ensureLegacyBootstrapped(env);
  const days = Number(new URL(request.url).searchParams.get('days') || 30);
  if (!PERIODS.has(days)) return text(request, 'Analytics period must be 1, 7, 30 or 90 days.', 400);

  const now = new Date();
  const currentStart = new Date(now.getTime() - days * DAY_MS);
  const previousStart = new Date(now.getTime() - days * 2 * DAY_MS);
  const current = await combinedPeriodCounts(env, currentStart, now);
  const previous = await combinedPeriodCounts(env, previousStart, currentStart);
  const [currentReaders, previousReaders, dailyTrend, previousDailyTrend] = await Promise.all([
    readerMetrics(env, currentStart, now),
    readerMetrics(env, previousStart, currentStart),
    dailyTrendForPeriod(env, currentStart, now),
    dailyTrendForPeriod(env, previousStart, currentStart),
  ]);

  const summary = await readJson(env, summaryKey(), { chapterViews: {} });
  const liveToday = await combinedPeriodCounts(env, dayStart(now), new Date(now.getTime() + 1));
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

  return json(request, {
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
  }, 200, { 'Cache-Control': 'private, no-store' });
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
