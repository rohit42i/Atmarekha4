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

function shortChapterId(id) {
  return String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
}

export function chapterPath(chapter) {
  if (!chapter?.id) return '/chapters';

  const rawNumber = chapter.chapterNumber;
  const number = rawNumber === null || rawNumber === undefined || rawNumber === '' ? null : Number(rawNumber);

  if (number !== null && Number.isFinite(number)) {
    return '/chapter/' + encodeURIComponent(String(rawNumber).trim());
  }

  const slug = slugify(chapter.title) || 'special';
  const idSuffix = shortChapterId(chapter.id);
  return '/chapter/special/' + encodeURIComponent(idSuffix ? slug + '-' + idSuffix : slug);
}

export function isChapterPath(pathname) {
  const path = cleanPathname(pathname);
  return /^\/chapter\/\d+(?:\.\d+)?$/.test(path) || /^\/chapter\/special\/[^/]+$/.test(path);
}

export function findChapterForPath(pathname, chapters = []) {
  const path = cleanPathname(pathname);
  if (!isChapterPath(path)) return null;

  const parts = path.split('/').filter(Boolean);
  if (parts[1] === 'special') {
    const slug = safeDecode(parts[2] || '');
    return (chapters || []).find(chapter => {
      const titleSlug = slugify(chapter?.title) || 'special';
      const suffix = shortChapterId(chapter?.id);
      return slug === (suffix ? titleSlug + '-' + suffix : titleSlug)
        || slug === String(chapter?.id || '');
    }) || null;
  }

  const number = safeDecode(parts[1] || '');
  return (chapters || []).find(chapter => {
    const raw = chapter?.chapterNumber;
    if (raw === null || raw === undefined || raw === '') return false;
    return String(raw).trim() === number || String(Number(raw)) === number;
  }) || null;
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
  if (isChapterPath(pathname)) return pathname.slice(1);
  return window.location.hash.replace(/^#/, '') || 'home';
}

export function getChapterIdFromLocation(chapters = []) {
  if (typeof window === 'undefined') return null;

  const pathChapter = findChapterForPath(window.location.pathname, chapters);
  if (pathChapter?.id) return String(pathChapter.id);

  const rendered = getRenderedChapterId();
  if (rendered) return rendered;

  return legacyChapterIdFromHash(window.location.hash);
}

export function chapterCanonicalUrl(chapter) {
  return SITE_ORIGIN + chapterPath(chapter);
}

export { SITE_ORIGIN };
