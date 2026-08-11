import { supabase } from './supabase';

const CHAPTERS_TABLE = 'chapters';
const PAGES_TABLE = 'chapter_pages';

// Current Supabase schema uses stable snake_case identifiers.
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

export async function buildChapters() {
  const { data, error } = await supabase
    .from(CHAPTERS_TABLE)
    .select('*')
    .order(CHAPTER_NUMBER, { ascending: true });

  if (error) {
    console.error('Supabase chapters error:', error);
    throw error;
  }

  return (data || []).map((chapter) => ({
    id: chapter.id,
    chapterNumber: chapter[CHAPTER_NUMBER],
    title: chapter[TITLE] || '',
    description: chapter[DESCRIPTION] || '',
    cover: chapter[COVER_URL] || null,
    status: chapter[STATUS] || '',
    releaseDate: chapter[RELEASE_DATE] || null,
    createdAt: chapter[CREATED_AT] || null,
  }));
}

export async function buildChapterPages(chapterId) {
  if (!chapterId) return [];

  const { data, error } = await supabase
    .from(PAGES_TABLE)
    .select('*')
    .eq(PAGE_CHAPTER_ID, chapterId)
    .order(PAGE_NUMBER, { ascending: true });

  if (error) {
    console.error('Supabase chapter pages error:', error);
    throw error;
  }

  return (data || [])
    .map((page) => page[PAGE_IMAGE_URL])
    .filter((url) => typeof url === 'string' && url.trim().length > 0);
}
