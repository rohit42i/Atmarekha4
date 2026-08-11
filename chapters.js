import { supabase } from './supabase';

const CHAPTERS_TABLE = 'chapters';
const PAGES_TABLE = 'chapter_pages';
const CN = 'Chapter Number';
const TITLE = 'Title';
const DESC = 'Description';
const COVER = 'Cover url';
const PAGE_CHAPTER = 'Chapter id';
const PAGE_NUMBER = 'Page number';
const PAGE_IMAGE = 'Image url';

export const buildChapters = async () => {
  const { data, error } = await supabase
    .from(CHAPTERS_TABLE)
    .select('*')
    .order(CN, { ascending: true });

  if (error) {
    console.error('Error fetching chapters:', error);
    return [];
  }

  return (data || []).map((chapter) => ({
    id: chapter.id,
    chapterNumber: chapter[CN],
    title: chapter[TITLE],
    description: chapter[DESC] || '',
    cover: chapter[COVER] || null,
    createdAt: chapter.created_at || null,
  }));
};

export const buildChapterPages = async (chapterId) => {
  if (!chapterId) return [];

  const { data, error } = await supabase
    .from(PAGES_TABLE)
    .select('*')
    .eq(PAGE_CHAPTER, chapterId)
    .order(PAGE_NUMBER, { ascending: true });

  if (error) {
    console.error('Error fetching chapter pages:', error);
    return [];
  }

  return (data || []).map((page) => page[PAGE_IMAGE]).filter(Boolean);
};
