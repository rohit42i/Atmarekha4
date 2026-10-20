import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SITE_URL = 'https://www.atmarekha.in';
const OUT = resolve('public/sitemap.xml');
const STATIC_PATHS = [
  '/',
  '/chapters',
  '/chapters?lang=en',
  '/info/about',
  '/info/contact',
  '/info/report',
  '/info/privacy',
  '/info/terms',
  '/pal-do-pal-ke-lamhe',
];

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

const isPublished = chapter => String(chapter?.status || '').trim().toLowerCase() === 'published';

const chapterGroupKey = chapter => chapter.chapter_number !== null && chapter.chapter_number !== undefined && chapter.chapter_number !== ''
  ? 'chapter:' + String(chapter.chapter_number).trim()
  : 'special:' + slugify(chapter.title);

const absoluteAssetUrl = value => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return SITE_URL + '/' + raw.replace(/^\/+/, '');
};

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

  const pageSize = 1000;
  const all = [];
  let offset = 0;

  while (true) {
    const url = new URL(base.replace(/\/$/, '') + '/rest/v1/chapters');
    url.searchParams.set('select', 'id,chapter_number,title,release_date,created_at,status,language,cover_url');
    url.searchParams.set('order', 'chapter_number.asc.nullsfirst,created_at.asc');
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(offset));

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
      if (!Array.isArray(data)) break;
      all.push(...data);
      if (data.length < pageSize) break;
      offset += data.length;
    } finally {
      clearTimeout(timer);
    }
  }

  return all.filter(isPublished);
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

  for (const path of STATIC_PATHS) add(path);
  for (const chapter of chapters) {
    add(chapterPath(chapter), validIsoDate(chapter.release_date || chapter.created_at));
  }

  const chapterGroups = new Map();
  for (const chapter of chapters) {
    const key = chapterGroupKey(chapter);
    if (!chapterGroups.has(key)) chapterGroups.set(key, []);
    chapterGroups.get(key).push(chapter);
  }

  const alternatesFor = loc => {
    if (loc === SITE_URL + '/chapters' || loc === SITE_URL + '/chapters?lang=en') {
      return [
        '    <xhtml:link rel="alternate" hreflang="en-IN" href="' + escapeXml(SITE_URL + '/chapters?lang=en') + '" />',
        '    <xhtml:link rel="alternate" hreflang="hi-Latn-IN" href="' + escapeXml(SITE_URL + '/chapters') + '" />',
        '    <xhtml:link rel="alternate" hreflang="x-default" href="' + escapeXml(SITE_URL + '/chapters') + '" />',
      ];
    }

    const match = chapters.find(chapter => SITE_URL + chapterPath(chapter) === loc);
    if (!match) return [];

    const group = chapterGroups.get(chapterGroupKey(match)) || [];
    const links = group.map(chapter => {
      const language = normalizeLanguage(chapter.language);
      return '    <xhtml:link rel="alternate" hreflang="' + (language === 'en' ? 'en-IN' : 'hi-Latn-IN') + '" href="' + escapeXml(SITE_URL + chapterPath(chapter)) + '" />';
    });

    const fallback = group.find(chapter => normalizeLanguage(chapter.language) === 'hi') || group[0] || match;
    links.push(
      '    <xhtml:link rel="alternate" hreflang="x-default" href="' + escapeXml(SITE_URL + chapterPath(fallback)) + '" />',
    );
    return [...new Set(links)];
  };

  const coverByLoc = new Map();
  for (const chapter of chapters) {
    const cover = absoluteAssetUrl(chapter.cover_url);
    if (cover) coverByLoc.set(SITE_URL + chapterPath(chapter), cover);
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls.map(({ loc, lastmod }) => [
      '  <url>',
      '    <loc>' + escapeXml(loc) + '</loc>',
      ...alternatesFor(loc),
      coverByLoc.has(loc) ? '    <image:image><image:loc>' + escapeXml(coverByLoc.get(loc)) + '</image:loc></image:image>' : null,
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
