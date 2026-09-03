import './admin-mobile.css';
import { supabase } from './supabase';

const CHAPTERS_TABLE = 'chapters';
const PAGES_TABLE = 'chapter_pages';
const CHAPTER_NUMBER = 'chapter_number';
const TITLE = 'title';
const DESCRIPTION = 'description';
const COVER_URL = 'cover_url';
const STATUS = 'status';
const RELEASE_DATE = 'release_date';
const CREATED_AT = 'created_at';
const PAGE_CHAPTER_ID = 'chapter_id';
const PAGE_NUMBER = 'page_number';
const PAGE_IMAGE_URL = 'image_url';
const PAGE_FETCH_ATTEMPTS = 4;
const PAGE_FETCH_DELAY_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    .order(CHAPTER_NUMBER, { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Supabase chapters error:', error);
    throw error;
  }

  const chapters = (data || []).map((chapter) => ({
    id: chapter.id,
    chapterNumber: chapter[CHAPTER_NUMBER],
    title: chapter[TITLE] || '',
    description: chapter[DESCRIPTION] || '',
    cover: chapter[COVER_URL] || null,
    status: chapter[STATUS] || '',
    releaseDate: chapter[RELEASE_DATE] || null,
    createdAt: chapter[CREATED_AT] || null,
  }));

  installChapterCoverStyles(chapters);
  return chapters;
}

export async function buildChapterPages(chapterId) {
  if (!chapterId) return [];
  let lastError = null;

  for (let attempt = 1; attempt <= PAGE_FETCH_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from(PAGES_TABLE)
      .select('*')
      .eq(PAGE_CHAPTER_ID, chapterId)
      .order(PAGE_NUMBER, { ascending: true });

    if (!error) {
      const pages = (data || [])
        .map((page) => page[PAGE_IMAGE_URL])
        .filter((url) => typeof url === 'string' && url.trim().length > 0);
      if (pages.length > 0 || attempt === PAGE_FETCH_ATTEMPTS) return pages;
    } else {
      lastError = error;
      console.warn(`Supabase chapter pages attempt ${attempt}/${PAGE_FETCH_ATTEMPTS} failed:`, error);
      if (attempt === PAGE_FETCH_ATTEMPTS) throw error;
    }

    await sleep(PAGE_FETCH_DELAY_MS * attempt);
  }

  if (lastError) throw lastError;
  return [];
}
