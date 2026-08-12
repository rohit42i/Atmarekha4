import { supabase } from './supabase';

export async function getReaderSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function syncReadingProgress(chapterId, pageNumber, completed = false) {
  const session = await getReaderSession();
  if (!session?.user?.id || !chapterId) return;
  const { data: existing } = await supabase.from('reading_history').select('id').eq('user_id', session.user.id).eq('chapter_id', chapterId).maybeSingle();
  const payload = { user_id: session.user.id, chapter_id: chapterId, page_number: pageNumber, updated_at: new Date().toISOString() };
  if (existing?.id) await supabase.from('reading_history').update(payload).eq('id', existing.id);
  else await supabase.from('reading_history').insert(payload);
  if (completed) window.localStorage.setItem(`atma-completed:${chapterId}`, 'true');
}

export async function getBookmark(chapterId) {
  const session = await getReaderSession();
  if (!session?.user?.id || !chapterId) return false;
  const { data } = await supabase.from('bookmarks').select('id').eq('user_id', session.user.id).eq('chapter_id', chapterId).maybeSingle();
  return Boolean(data);
}

export async function toggleReaderBookmark(chapterId) {
  const session = await getReaderSession();
  if (!session?.user?.id || !chapterId) return { signedIn: false, bookmarked: false };
  const { data: existing } = await supabase.from('bookmarks').select('id').eq('user_id', session.user.id).eq('chapter_id', chapterId).maybeSingle();
  if (existing?.id) { await supabase.from('bookmarks').delete().eq('id', existing.id); return { signedIn: true, bookmarked: false }; }
  const { error } = await supabase.from('bookmarks').insert({ user_id: session.user.id, chapter_id: chapterId });
  if (error) throw error;
  return { signedIn: true, bookmarked: true };
}
