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

async function analyticsQuery(env, query, params = {}) {
  if (!env.ANALYTICS_SQL) throw new Error('Analytics SQL binding is not configured.');
  return env.ANALYTICS_SQL.query({ query, params });
}

function rows(result) {
  return Array.isArray(result?.data) ? result.data : [];
}

async function viewRowsForPeriod(env, start, end) {
  const result = await analyticsQuery(
    env,
    `SELECT blob1 AS chapter_id, SUM(_sample_interval) AS views
     FROM ${DATASET_TABLE}
     WHERE timestamp >= $start AND timestamp < $end
     GROUP BY blob1`,
    { start: start.toISOString(), end: end.toISOString() },
  );
  return rows(result).map(row => ({
    chapterId: String(row.chapter_id),
    views: Math.max(0, Number(row.views) || 0),
  }));
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
  const now = new Date();
  const retentionStart = addDays(now, -RETENTION_DAYS);
  const result = {};
  const archiveEnd = new Date(Math.min(end.getTime(), retentionStart.getTime()));
  if (start < archiveEnd) {
    Object.assign(result, await archiveCountsForPeriod(env, start, archiveEnd));
  }
  const analyticsStart = new Date(Math.max(start.getTime(), retentionStart.getTime()));
  if (analyticsStart < end) {
    mergeChapterCounts(result, await viewRowsForPeriod(env, analyticsStart, end));
  }
  return result;
}

async function totalFromMap(map) {
  return Object.values(map).reduce((sum, value) => sum + Number(value || 0), 0);
}

async function readerMetrics(env, start, end) {
  try {
    const activeResult = await analyticsQuery(
      env,
      `SELECT COUNT(DISTINCT blob2) AS active_readers
       FROM ${DATASET_TABLE}
       WHERE timestamp >= $start AND timestamp < $end`,
      { start: start.toISOString(), end: end.toISOString() },
    );
    const returningResult = await analyticsQuery(
      env,
      `SELECT blob2 AS viewer_hash,
              COUNT(DISTINCT toStartOfInterval(timestamp, INTERVAL '1' DAY)) AS active_days
       FROM ${DATASET_TABLE}
       WHERE timestamp >= $start AND timestamp < $end
       GROUP BY blob2
       HAVING active_days >= 2
       LIMIT 100000`,
      { start: start.toISOString(), end: end.toISOString() },
    );
    return {
      activeReaders: Number(rows(activeResult)[0]?.active_readers || 0),
      returningReaders: rows(returningResult).length,
    };
  } catch (error) {
    return { activeReaders: 0, returningReaders: 0, unavailable: true, error: error?.message || 'reader metrics unavailable' };
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
    const chapters = Object.fromEntries(rowsForDay.map(row => [row.chapterId, row.views]));
    const total = Object.values(chapters).reduce((sum, value) => sum + Number(value || 0), 0);
    monthObject.days[dayKey(cursor)] = { views: total, chapters };
    await writeJson(env, monthObjectKey(month), monthObject);
    for (const [chapterId, count] of Object.entries(chapters)) summary.chapterViews[chapterId] = (summary.chapterViews[chapterId] || 0) + Number(count || 0);
    summary.processedThrough = dayKey(cursor);
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
  env.ANALYTICS.writeDataPoint({
    blobs: [chapterId, viewerHash],
    doubles: [1],
    indexes: ['atma-rekha'],
  });
  return json(request, { recorded: true });
}

async function handlePublicViews(request, env) {
  const ids = [...new Set(new URL(request.url).searchParams.getAll('chapterIds').join(',').split(',').map(value => value.trim()).filter(validChapterId))].slice(0, 100);
  if (!ids.length) return json(request, {});
  const [summary, current] = await Promise.all([
    readJson(env, summaryKey(), { chapterViews: {} }),
    readJson(env, currentKey(), { day: dayKey(new Date()), chapterViews: {} }),
  ]);
  const currentDay = dayKey(new Date());
  const result = {};
  for (const id of ids) result[id] = Number(summary.chapterViews?.[id] || 0) + (current.day === currentDay ? Number(current.chapterViews?.[id] || 0) : 0);
  return json(request, result, 200, { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' });
}

async function handleAdminAnalytics(request, env) {
  if (!(await verifyAdmin(request, env))) return text(request, 'Admin authorization required.', 403);
  const days = Number(new URL(request.url).searchParams.get('days') || 30);
  if (!PERIODS.has(days)) return text(request, 'Analytics period must be 1, 7, 30 or 90 days.', 400);

  const now = new Date();
  const currentStart = new Date(now.getTime() - days * DAY_MS);
  const previousStart = new Date(now.getTime() - days * 2 * DAY_MS);
  const current = await combinedPeriodCounts(env, currentStart, now);
  const previous = await combinedPeriodCounts(env, previousStart, currentStart);
  const [currentReaders, previousReaders] = await Promise.all([
    readerMetrics(env, currentStart, now),
    readerMetrics(env, previousStart, currentStart),
  ]);

  const summary = await readJson(env, summaryKey(), { chapterViews: {} });
  const currentDay = dayKey(now);
  const currentFile = await readJson(env, currentKey(), { day: currentDay, chapterViews: {} });
  const allTime = { ...(summary.chapterViews || {}) };
  if (currentFile.day === currentDay) {
    for (const [id, count] of Object.entries(currentFile.chapterViews || {})) allTime[id] = Number(allTime[id] || 0) + Number(count || 0);
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
    chapter_stats: chapterStats,
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
