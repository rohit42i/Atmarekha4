import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SITE_URL = 'https://www.atmarekha.in';
const OUT = resolve('public/sitemap.xml');
const STATIC_PATHS = ['/', '/chapters', '/info/about', '/info/contact', '/info/report', '/info/privacy', '/info/terms', '/pal-do-pal-ke-lamhe'];

const env = key => String(process.env[key] || '').trim();
const escapeXml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const validIsoDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const slugify = value => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const shortId = id => String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();

const normalizeLanguage = language => String(language || '').trim().toLowerCase() === 'en' ? 'en' : 'hi';

const chapterPath = chapter => {
  const number = chapter.chapter_number;
  const base = number !== null && number !== undefined && number !== ''
    ? '/chapter/' + encodeURIComponent(String(number).trim())
    : '/chapter/special/' + encodeURIComponent((() => {
        const slug = slugify(chapter.title) || 'special';
        const suffix = shortId(chapter.id);
        return suffix ? slug + '-' + suffix : slug;
      })());
  return normalizeLanguage(chapter.language) === 'en' ? base + '?lang=en' : base;
};

async function readExisting() {
  try { return await readFile(OUT, 'utf8'); } catch { return ''; }
}

async function loadPublishedChapters() {
  const base = env('VITE_SUPABASE_URL');
  const key = env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_ANON_KEY');
  if (!base || !key) return null;
  const url = new URL(base.replace(/\/$/, '') + '/rest/v1/chapters');
  url.searchParams.set('select', 'id,chapter_number,title,release_date,created_at,status,language');
  url.searchParams.set('status', 'eq.published');
  url.searchParams.set('order', 'chapter_number.asc.nullsfirst,created_at.asc');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Supabase returned HTTP ' + response.status);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const existing = await readExisting();
  let chapters = null;
  try {
    chapters = await loadPublishedChapters();
  } catch (error) {
    console.warn('Sitemap refresh skipped:', error?.message || error);
  }

  if (chapters === null) {
    if (existing) {
      console.warn('Keeping the existing sitemap.');
      return;
    }
    // A clean checkout must remain buildable even when Supabase metadata is unavailable.
    // Generate the static public routes; a later build with Supabase metadata can add chapters.
    chapters = [];
    console.warn('Supabase metadata unavailable; generating static-route sitemap only.');
  }

  const urls = [];
  const seen = new Set();
  const add = (path, lastmod = null) => {
    const loc = SITE_URL + path;
    if (seen.has(loc)) return;
    seen.add(loc);
    urls.push({ loc, lastmod });
  };

  add('/');
  for (const path of STATIC_PATHS.slice(1)) add(path);
  for (const chapter of chapters) add(chapterPath(chapter), validIsoDate(chapter.release_date || chapter.created_at));

  const chapterGroups = new Map();
  for (const chapter of chapters) {
    const key = chapter.chapter_number !== null && chapter.chapter_number !== undefined && chapter.chapter_number !== ''
      ? 'chapter:' + String(chapter.chapter_number).trim()
      : 'special:' + slugify(chapter.title);
    if (!chapterGroups.has(key)) chapterGroups.set(key, []);
    chapterGroups.get(key).push(chapter);
  }

  const alternatesFor = loc => {
    const match = chapters.find(chapter => SITE_URL + chapterPath(chapter) === loc);
    if (!match) return [];
    const key = match.chapter_number !== null && match.chapter_number !== undefined && match.chapter_number !== ''
      ? 'chapter:' + String(match.chapter_number).trim()
      : 'special:' + slugify(match.title);
    return (chapterGroups.get(key) || []).map(chapter => {
      const language = normalizeLanguage(chapter.language);
      return '    <xhtml:link rel="alternate" hreflang="' + (language === 'en' ? 'en-IN' : 'hi-Latn-IN') + '" href="' + escapeXml(SITE_URL + chapterPath(chapter)) + '" />';
    });
  };

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls.map(({ loc, lastmod }) => [
      '  <url>',
      '    <loc>' + escapeXml(loc) + '</loc>',
      ...alternatesFor(loc),
      lastmod ? '    <lastmod>' + lastmod + '</lastmod>' : null,
      '  </url>',
    ].filter(Boolean).join('\n')),
    '</urlset>',
    '',
  ].join('\n');

  await writeFile(OUT, body, 'utf8');
  console.log('Sitemap generated with ' + urls.length + ' URLs.');
}

await main();
