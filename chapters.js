import { supabase } from './supabase';

const CHAPTERS_TABLE = 'chapters';
const PAGES_TABLE = 'chapter_pages';

// The database uses legacy column names containing spaces. PostgREST
// normalizes explicit select lists and turns names such as "Chapter Number"
// into ChapterNumber, so use * and read the returned object keys directly.

export async function buildChapters() {
  const { data, error } = await supabase
    .from(CHAPTERS_TABLE)
    .select('*')
    .order('Chapter Number', { ascending: true });

  if (error) {
    console.error('Supabase chapters error:', error);
    throw error;
  }

  return (data || []).map((chapter) => ({
    id: chapter.id,
    chapterNumber: chapter['Chapter Number'],
    title: chapter.Title || '',
    description: chapter.Description || '',
    cover: chapter['Cover url'] || null,
    status: chapter.status || '',
    releaseDate: chapter['Release date'] || null,
    createdAt: chapter['Created at'] || null,
  }));
}

export async function buildChapterPages(chapterId) {
  if (!chapterId) return [];

  const { data, error } = await supabase
    .from(PAGES_TABLE)
    .select('*')
    .eq('Chapter id', chapterId)
    .order('Page number', { ascending: true });

  if (error) {
    console.error('Supabase chapter pages error:', error);
    throw error;
  }

  return (data || [])
    .map((page) => page['Image url'])
    .filter((url) => typeof url === 'string' && url.trim().length > 0);
}
