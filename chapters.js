import './admin-mobile.css';
import { supabase } from './supabase';

const CHAPTERS_TABLE = 'chapters';
const PAGES_TABLE = 'chapter_pages';
const PAGE_FETCH_ATTEMPTS = 4;
const PAGE_FETCH_DELAY_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Canonical display label for a chapter number. Never returns "null"/"undefined"/"NaN". */
export function formatChapterLabel(chapterNumber, options = {}) {
  const { short = false, title = '' } = options;
  const n = chapterNumber === null || chapterNumber === undefined || chapterNumber === ''
    ? null
    : Number(chapterNumber);
  if (n !== null && Number.isFinite(n) && !Number.isNaN(n)) {
    return `Chapter ${n}`;
  }
  const cleanTitle = String(title || '').trim();
  if (short && cleanTitle) return cleanTitle;
  return 'Special';
}

/** Eyebrow-style label used in reader/headers. */
export function formatChapterEyebrow(chapterNumber, title = '') {
  const n = chapterNumber === null || chapterNumber === undefined || chapterNumber === ''
    ? null
    : Number(chapterNumber);
  if (n !== null && Number.isFinite(n) && !Number.isNaN(n)) return `CHAPTER ${n}`;
  const cleanTitle = String(title || '').trim();
  if (cleanTitle) return cleanTitle.toUpperCase().slice(0, 40);
  return 'SPECIAL';
}

/** Deterministic sort: numeric ascending, then NULL/special by createdAt then id. */
export function sortChapters(chapters) {
  return [...(chapters || [])].sort((a, b) => {
    const an = a?.chapterNumber;
    const bn = b?.chapterNumber;
    const aNum = an === null || an === undefined || an === '' ? null : Number(an);
    const bNum = bn === null || bn === undefined || bn === '' ? null : Number(bn);
    const aFinite = aNum !== null && Number.isFinite(aNum);
    const bFinite = bNum !== null && Number.isFinite(bNum);
    if (aFinite && bFinite) return aNum - bNum;
    if (aFinite && !bFinite) return -1;
    if (!aFinite && bFinite) return 1;
    const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

function installChapterCoverStyles(chapters) {
  if (typeof document === 'undefined') return;
  const id = 'atma-rekha-chapter-cover-styles';
  document.getElementById(id)?.remove();
  const rules = chapters.filter((chapter) => chapter.cover).map((chapter) => {
    const href = `#read-chapter/${encodeURIComponent(chapter.id)}`;
    const cover = JSON.stringify(String(chapter.cover));
    return `.chapter-row-main[href="${href}"]::before{background-image:url(${cover});}`;
  }).join('');
  if (!rules) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = rules;
  document.head.appendChild(style);
}

export async function buildChapters() {
  const { data, error } = await supabase
    .from(CHAPTERS_TABLE)
    .select('*')
    .order('chapter_number', { ascending: true, nullsFirst: false });
  if (error) {
    console.error('Supabase chapters error:', error);
    throw error;
  }
  const chapters = (data || []).map((chapter) => ({
    id: chapter.id,
    chapterNumber: chapter.chapter_number,
    title: chapter.title || '',
    description: chapter.description || '',
    cover: chapter.cover_url || null,
    status: chapter.status || '',
    releaseDate: chapter.release_date || null,
    createdAt: chapter.created_at || null,
  }));
  installChapterCoverStyles(chapters);
  return sortChapters(chapters);
}

/**
 * Load pages ordered by page_number ASC.
 * Empty array = no valid URLs after retries.
 * Throws on persistent Supabase errors.
 */
export async function buildChapterPages(chapterId) {
  if (!chapterId) return [];
  let lastError = null;
  for (let attempt = 1; attempt <= PAGE_FETCH_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from(PAGES_TABLE)
      .select('page_number,image_url')
      .eq('chapter_id', chapterId)
      .order('page_number', { ascending: true });
    if (!error) {
      const pages = (data || [])
        .map((page) => page.image_url)
        .filter((url) => typeof url === 'string' && url.trim().length > 0);
      if (pages.length || attempt === PAGE_FETCH_ATTEMPTS) return pages;
    } else {
      lastError = error;
      if (attempt === PAGE_FETCH_ATTEMPTS) throw error;
    }
    await sleep(PAGE_FETCH_DELAY_MS * attempt);
  }
  if (lastError) throw lastError;
  return [];
}
