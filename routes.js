const SITE_ORIGIN = 'https://www.atmarekha.in';

function cleanPathname(pathname = '/') {
  const value = String(pathname || '/').replace(/\\+/g, '/');
  if (value === '/') return '/';
  return '/' + value.replace(/^\/+|\/+$/g, '');
}

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeLanguage(language) { return String(language || '').trim().toLowerCase() === 'en' ? 'en' : 'hi'; }

function languageFromSearch(search = '') {
  try { return normalizeLanguage(new URLSearchParams(search).get('lang')); } catch { return 'hi'; }
}

function shortChapterId(id) {
  return String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
}

export function chapterPath(chapter) {
  if (!chapter?.id) return '/chapters';

  const rawNumber = chapter.chapterNumber;
  const number = rawNumber === null || rawNumber === undefined || rawNumber === '' ? null : Number(rawNumber);

  if (number !== null && Number.isFinite(number)) {
    const base = '/chapter/' + encodeURIComponent(String(rawNumber).trim());
    return normalizeLanguage(chapter.language) === 'en' ? base + '?lang=en' : base;
  }

  const slug = slugify(chapter.title) || 'special';
  const idSuffix = shortChapterId(chapter.id);
  const base = '/chapter/special/' + encodeURIComponent(idSuffix ? slug + '-' + idSuffix : slug);
  return normalizeLanguage(chapter.language) === 'en' ? base + '?lang=en' : base;
}

export function isChapterPath(pathname) {
  const path = cleanPathname(pathname);
  return /^\/chapter\/\d+(?:\.\d+)?$/.test(path) || /^\/chapter\/special\/[^/]+$/.test(path);
}

export function findChapterForPath(pathname, chapters = []) {
  const rawLocation = String(pathname || '/');
  const [pathnameOnly, inlineSearch = ''] = rawLocation.split('?');
  const path = cleanPathname(pathnameOnly);
  if (!isChapterPath(path)) return null;
  const wantedLanguage = languageFromSearch(inlineSearch ? '?' + inlineSearch : '');
  const parts = path.split('/').filter(Boolean);
  if (parts[1] === 'special') {
    const slug = safeDecode(parts[2] || '');
    const matches = (chapters || []).filter(chapter => {
      const titleSlug = slugify(chapter?.title) || 'special';
      const suffix = shortChapterId(chapter?.id);
      return slug === (suffix ? titleSlug + '-' + suffix : titleSlug)
        || slug === String(chapter?.id || '');
    });
    return matches.find(chapter => normalizeLanguage(chapter?.language) === wantedLanguage)
      || matches.find(chapter => normalizeLanguage(chapter?.language) === 'hi')
      || matches[0]
      || null;
  }

  const number = safeDecode(parts[1] || '');
  const matches = (chapters || []).filter(chapter => {
    const raw = chapter?.chapterNumber;
    if (raw === null || raw === undefined || raw === '') return false;
    return String(raw).trim() === number || String(Number(raw)) === number;
  });
  return matches.find(chapter => normalizeLanguage(chapter?.language) === wantedLanguage)
    || matches.find(chapter => normalizeLanguage(chapter?.language) === 'hi')
    || matches[0]
    || null;
}

export function legacyChapterIdFromHash(hash = '') {
  const value = String(hash || '');
  if (!value.startsWith('#read-chapter/')) return null;
  return safeDecode(value.slice('#read-chapter/'.length).split(/[?#]/, 1)[0]) || null;
}

export function getRenderedChapterId() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.reader-page[data-chapter-id]')?.getAttribute('data-chapter-id') || null;
}

export function getSiteRoute() {
  if (typeof window === 'undefined') return 'home';
  const pathname = cleanPathname(window.location.pathname);
  const hashRoute = window.location.hash.replace(/^#/, '');
  if (pathname === '/' && !hashRoute) return 'home';
  // Legacy hash routes are still used for site-level pages. When a chapter
  // URL has a hash such as /chapter/1#chapters, the hash must take priority
  // so Back/close controls can actually leave the reader.
  if (hashRoute) return hashRoute;
  if (isChapterPath(pathname)) return pathname.slice(1) + (window.location.search || '');
  const publicPath = /^\/(admin|chapters|info\/(?:about|contact|report|privacy|terms)|pal-do-pal-ke-lamhe|privacy-center|maintenance|403|503)$/.test(pathname);
  if (publicPath) return pathname.slice(1);
  return 'not-found';
}

export function getChapterIdFromLocation(chapters = []) {
  if (typeof window === 'undefined') return null;

  const pathChapter = findChapterForPath(window.location.pathname + (window.location.search || ''), chapters);
  if (pathChapter?.id) return String(pathChapter.id);

  const rendered = getRenderedChapterId();
  if (rendered) return rendered;

  return legacyChapterIdFromHash(window.location.hash);
}

export function chapterCanonicalUrl(chapter) {
  return SITE_ORIGIN + chapterPath(chapter);
}

export function chapterLanguageUrl(chapter, language) {
  if (!chapter?.id) return SITE_ORIGIN + '/chapters';
  return SITE_ORIGIN + chapterPath({ ...chapter, language });
}

export { SITE_ORIGIN };