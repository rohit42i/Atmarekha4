'use strict';

const express = require('express');
const { zcAuth } = require('@zcatalyst/auth');
const { Datastore } = require('@zcatalyst/datastore');
const { toPublicChapters } = require('./lib/public-chapters');

const app = express();
const ALLOWED_ORIGINS = new Set([
  'https://www.atmarekha.in',
  'https://atmarekha.in',
  'http://localhost:5173',
]);
const PUBLIC_CHAPTERS_QUERY = [
  'SELECT id, chapter_number, title, description, cover_url, source_status,',
  'release_date, manga_id, lang_code, card_thumbnail_desktop_url,',
  'card_thumbnail_mobile_url, chapter_list_thumb_desktop_url,',
  'chapter_list_thumb_mobile_url, deleted_at',
  'FROM chapters',
  "WHERE source_status = 'published' AND deleted_at IS NULL",
  'ORDER BY chapter_number ASC LIMIT 250',
].join(' ');

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb', strict: true }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  return next();
});

app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    service: 'atma-rekha-catalyst-api',
    status: 'ok',
    environment: 'development',
    readiness: 'chapters-read-only-endpoint-not-yet-cut-over',
  });
});

/**
 * First compatibility slice: a read-only, allowlisted public chapter index.
 *
 * It deliberately runs a fixed query with server-side Admin scope because the
 * current Catalyst App User table permissions are deny-all. No client-supplied
 * table name, SQL, column list, filter, or mutation is accepted. Publication
 * and deletion checks are repeated in the response mapper (fail-closed).
 */
app.get('/v1/chapters', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

  try {
    const catalystApp = await zcAuth.init(req, { scope: 'admin' });
    const datastore = new Datastore(catalystApp);
    const result = await datastore.executeZCQLQuery(PUBLIC_CHAPTERS_QUERY);
    const rows = Array.isArray(result)
      ? result
      : Array.isArray(result?.content)
        ? result.content
        : [];
    return res.status(200).json({ data: toPublicChapters(rows) });
  } catch (_error) {
    // Do not expose SQL, table metadata, credentials, or internal error detail.
    console.error('[atma-rekha-catalyst-api] public chapter read failed');
    return res.status(503).json({ error: 'Chapter service is temporarily unavailable.' });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

module.exports = app;
