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

export async function buildChapters() {
  try {
    const { data, error } = await supabase
      .from(CHAPTERS_TABLE)
      .select('*')
      .order(CN, { ascending: true });

    if (error) {
      console.error('Supabase chapters error:', error);
      return [];
    }

    return (data || []).map((chapter) => ({
      id: chapter.id,
      chapterNumber: chapter[CN],
      title: chapter[TITLE] || '',
      description: chapter[DESC] || '',
      cover: chapter[COVER] || null,
      createdAt:
        chapter.created_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to fetch chapters:', error);
    return [];
  }
}

export async function buildChapterPages(chapterId) {
  if (!chapterId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from(PAGES_TABLE)
      .select('*')
      .eq(PAGE_CHAPTER, chapterId)
      .order(PAGE_NUMBER, { ascending: true });

    if (error) {
      console.error('Supabase chapter pages error:', error);
      return [];
    }

    return (data || [])
      .map((page) => page[PAGE_IMAGE])
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch chapter pages:', error);
    return [];
  }
}
