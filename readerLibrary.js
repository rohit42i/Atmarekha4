import { supabase } from './supabase';

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

export async function getFavoriteState(chapterId) {
  const user = await getCurrentUser();
  if (!user || !chapterId) return false;
  const { data, error } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('chapter_id', chapterId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function toggleFavorite(chapterId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to add chapters to your favorites.');
  const existing = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('chapter_id', chapterId)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data) {
    const { error } = await supabase.from('bookmarks').delete().eq('id', existing.data.id);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from('bookmarks').insert({ user_id: user.id, chapter_id: chapterId });
  if (error) throw error;
  return true;
}

export async function saveReadingProgress(chapterId, pageNumber) {
  const user = await getCurrentUser();
  if (!user || !chapterId) return;
  const page = Math.max(1, Number(pageNumber) || 1);
  const { error } = await supabase.from('reading_history').upsert(
    { user_id: user.id, chapter_id: chapterId, page_number: page, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,chapter_id' }
  );
  if (error) throw error;
}
