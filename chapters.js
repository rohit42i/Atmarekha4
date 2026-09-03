import './admin-mobile.css';
import { supabase } from './supabase';

const CHAPTERS_TABLE = 'chapters';
const PAGES_TABLE = 'chapter_pages';
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
  return chapters;
}

export async function buildChapterPages(chapterId) {
  if (!chapterId) return [];
  for (let attempt = 1; attempt <= PAGE_FETCH_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from(PAGES_TABLE)
      .select('*')
      .eq('chapter_id', chapterId)
      .order('page_number', { ascending: true });
    if (!error) {
      const pages = (data || [])
        .map((page) => page.image_url)
        .filter((url) => typeof url === 'string' && url.trim().length > 0);
      if (pages.length || attempt === PAGE_FETCH_ATTEMPTS) return pages;
    } else if (attempt === PAGE_FETCH_ATTEMPTS) {
      throw error;
    }
    await sleep(PAGE_FETCH_DELAY_MS * attempt);
  }
  return [];
}
