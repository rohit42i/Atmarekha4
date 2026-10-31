import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SITE_URL = 'https://www.atmarekha.in';
const OUT = resolve('public/sitemap.xml');
const STATIC_PATHS = [
  '/', '/chapters', '/chapters?lang=en',
  '/pal-do-pal-ke-lamhe',
  '/info/about', '/info/terms', '/info/privacy', '/info/contact', '/info/report',
];

const env = key => String(process.env[key] || '').trim();
const escapeXml = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const validDate = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return '';
  return date.toISOString().slice(0, 10);
};
const chapterLastmod = chapter => validDate(chapter.release_date) || validDate(chapter.created_at);
const slugify = value => String(value || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const shortId = id => String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
const language = value => String(value || '').trim().toLowerCase() === 'en' ? 'en' : 'hi';
const isPublished = chapter =>
  String(chapter?.status || '').trim().toLowerCase() === 'published' &&
  !chapter?.deleted_at;
const chapterPath = chapter => {
  const number = chapter.chapter_number;
  const path = number !== null && number !== undefined && String(number).trim() !== ''
    ? '/chapter/' + encodeURIComponent(String(number).trim())
    : '/chapter/special/' + encodeURIComponent((slugify(chapter.title) || 'special') + (shortId(chapter.id) ? '-' + shortId(chapter.id) : ''));
  return language(chapter.language) === 'en' ? path + '?lang=en' : path;
};

async function loadPublishedChapters() {
  const base = env('VITE_SUPABASE_URL');
  const key = env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_ANON_KEY');
  if (!base || !key) throw new Error('Supabase build configuration is missing.');
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(base.replace(/\/$/, '') + '/rest/v1/chapters');
    url.searchParams.set('select', 'id,chapter_number,title,release_date,created_at,status,language,deleted_at');
    url.searchParams.set('status', 'ilike.published');
    url.searchParams.set('deleted_at', 'is.null');
    url.searchParams.set('order', 'chapter_number.asc.nullsfirst,created_at.asc,id.asc');
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(offset));
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Supabase chapter lookup returned HTTP ' + response.status);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Supabase returned an invalid chapter list.');
    rows.push(...page.filter(isPublished));
    if (page.length < pageSize) break;
  }
  return rows;
}

function buildXml(chapters) {
  const entries = new Map();
  const add = (path, lastmod = '') => {
    const loc = SITE_URL + path;
    if (!entries.has(loc)) entries.set(loc, { loc, lastmod, alternates: [] });
    else if (!entries.get(loc).lastmod && lastmod) entries.get(loc).lastmod = lastmod;
  };
  STATIC_PATHS.forEach(path => add(path));
  const groups = new Map();
  for (const chapter of chapters) {
    add(chapterPath(chapter), chapterLastmod(chapter));
    if (chapter.chapter_number === null || chapter.chapter_number === undefined || String(chapter.chapter_number).trim() === '') continue;
    const key = 'number:' + String(chapter.chapter_number).trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(chapter);
  }
  for (const group of groups.values()) {
    const languageLinks = group.map(chapter => ({
      language: language(chapter.language) === 'en' ? 'en-IN' : 'hi-Latn-IN',
      url: SITE_URL + chapterPath(chapter),
    }));
    const links = [...new Map(languageLinks.map(item => [item.language, item])).values()];
    const fallback = group.find(chapter => language(chapter.language) === 'hi') || group[0];
    links.push({ language: 'x-default', url: SITE_URL + chapterPath(fallback) });
    for (const chapter of group) {
      const entry = entries.get(SITE_URL + chapterPath(chapter));
      if (entry) entry.alternates = links;
    }
  }
  for (const chapter of chapters) {
    if (chapter.chapter_number !== null && chapter.chapter_number !== undefined && String(chapter.chapter_number).trim() !== '') continue;
    const url = SITE_URL + chapterPath(chapter);
    const entry = entries.get(url);
    if (!entry) continue;
    const languageCode = language(chapter.language) === 'en' ? 'en-IN' : 'hi-Latn-IN';
    entry.alternates = [
      { language: languageCode, url },
      { language: 'x-default', url },
    ];
  }
  const listAlternates = [
    { language: 'en-IN', url: SITE_URL + '/chapters?lang=en' },
    { language: 'hi-Latn-IN', url: SITE_URL + '/chapters' },
    { language: 'x-default', url: SITE_URL + '/chapters' },
  ];
  for (const path of ['/chapters', '/chapters?lang=en']) entries.get(SITE_URL + path).alternates = listAlternates;

  const rows = [...entries.values()].map(entry => [
    '  <url>',
    '    <loc>' + escapeXml(entry.loc) + '</loc>',
    entry.lastmod ? '    <lastmod>' + entry.lastmod + '</lastmod>' : '',
    ...[...new Map(entry.alternates.map(item => [item.language, item])).values()]
      .map(item => '    <xhtml:link rel="alternate" hreflang="' + escapeXml(item.language) + '" href="' + escapeXml(item.url) + '" />'),
    '  </url>',
  ].filter(Boolean).join('\n'));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...rows,
    '</urlset>',
    '',
  ].join('\n');
}

let chapters = [];
try {
  chapters = await loadPublishedChapters();
} catch (error) {
  console.warn('Sitemap refresh skipped; retaining the last generated sitemap:', error?.message || error);
  try {
    await readFile(OUT, 'utf8');
    process.exit(0);
  } catch (_) {
    console.warn('No previous sitemap exists; generating a static public-route fallback.');
  }
}
const xml = buildXml(chapters);
await writeFile(OUT, xml, 'utf8');
const generatedUrlCount = (xml.match(/<url>/g) || []).length;
console.log('Generated sitemap with ' + generatedUrlCount + ' unique URLs from ' + chapters.length + ' published chapter records.');
