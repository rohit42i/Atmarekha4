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

const chapterPath = chapter => {
  const number = chapter.chapter_number;
  if (number !== null && number !== undefined && number !== '') return '/chapter/' + encodeURIComponent(String(number).trim());
  const slug = slugify(chapter.title) || 'special';
  const suffix = shortId(chapter.id);
  return '/chapter/special/' + encodeURIComponent(suffix ? slug + '-' + suffix : slug);
};

async function readExisting() {
  try { return await readFile(OUT, 'utf8'); } catch { return ''; }
}

async function loadPublishedChapters() {
  const base = env('VITE_SUPABASE_URL');
  const key = env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_ANON_KEY');
  if (!base || !key) return null;
  const url = new URL(base.replace(/\/$/, '') + '/rest/v1/chapters');
  url.searchParams.set('select', 'id,chapter_number,title,release_date,created_at,status');
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
    if (!existing) throw new Error('No existing sitemap and Supabase metadata is unavailable.');
    console.warn('Keeping the existing sitemap.');
    return;
  }

  const urls = [];
  const seen = new Set();
  const add = (path, lastmod = null) => {
    const loc = SITE_URL + path;
    if (seen.has(loc)) return;
    seen.add(loc);
    urls.push({ loc, lastmod });
  };

  const today = new Date().toISOString().slice(0, 10);
  add('/', today);
  for (const path of STATIC_PATHS.slice(1)) add(path);
  for (const chapter of chapters) add(chapterPath(chapter), validIsoDate(chapter.release_date || chapter.created_at));

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(({ loc, lastmod }) => [
      '  <url>',
      '    <loc>' + escapeXml(loc) + '</loc>',
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
