import { supabase } from './supabase';

const VIEWER_KEY_STORAGE = 'atma-rekha-viewer-key-v1';

export function getViewerKey() {
  if (typeof window === 'undefined') return 'server-viewer-key';
  let key = window.localStorage.getItem(VIEWER_KEY_STORAGE);
  if (!key) {
    key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VIEWER_KEY_STORAGE, key);
  }
  return key;
}

export function buildRatingSummary(rows = []) {
  const ratings = rows.map(row => Number(row.rating)).filter(Number.isFinite);
  return { average: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0, count: ratings.length };
}

export async function fetchPublicEngagement(chapterIds) {
  const ids = [...new Set((chapterIds || []).filter(Boolean))].slice(0, 100);
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc('get_public_chapter_stats', { p_chapter_ids: ids });
  if (error) throw error;
  const payload = data && typeof data === 'object' ? data : {};
  const empty = { rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0, pages: 0 };
  return Object.fromEntries(ids.map(id => [id, payload[id] || empty]));
}

export async function fetchChapterEngagement(chapterId) {
  if (!chapterId) return { rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0, pages: 0 };
  const { data, error } = await supabase.rpc('get_public_chapter_stats', { p_chapter_ids: [chapterId] });
  if (error) throw error;
  return data?.[chapterId] || { rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0, pages: 0 };
}

export async function fetchChapterComments(chapterId) {
  const { data, error } = await supabase.from('comments')
    .select('id,user_id,chapter_id,author_name,content,created_at,updated_at,parent_comment_id')
    .eq('chapter_id', chapterId).order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchCommentLikes(commentIds) {
  const ids = [...new Set((commentIds || []).filter(Boolean))];
  if (!ids.length) return { counts: {}, liked: {} };
  const viewerKey = getViewerKey();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150));
  const results = await Promise.all(chunks.map(chunk =>
    supabase.rpc('get_public_comment_like_summary', {
      p_comment_ids: chunk,
      p_viewer_key: viewerKey,
    })
  ));
  for (const result of results) if (result.error) throw result.error;
  const counts = {};
  const liked = {};
  for (const result of results) {
    const payload = result.data && typeof result.data === 'object' ? result.data : {};
    for (const id of Object.keys(payload)) {
      counts[id] = Number(payload[id]?.count) || 0;
      liked[id] = payload[id]?.liked === true;
    }
  }
  return { counts, liked };
}

async function requireUser() {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  let user = sessionResult.data?.session?.user || null;
  if (!user) {
    const userResult = await supabase.auth.getUser();
    if (userResult.error && userResult.error.name !== 'AuthSessionMissingError') throw userResult.error;
    user = userResult.data?.user || null;
  }
  if (!user) {
    const err = new Error('Please sign in to continue.');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }
  return user;
}

export { requireUser };

async function getAccountUsername(user) {
  const { data, error } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
  if (error) throw error;
  const username = String(data?.username || '').trim().replace(/^@+/, '').slice(0, 24);
  return username || 'reader';
}

export async function addComment({ chapterId, content, parentCommentId = null }) {
  const user = await requireUser();
  const cleanContent = String(content || '').trim();
  if (!cleanContent) throw new Error('Write a comment first.');
  if (cleanContent.length > 2000) throw new Error('Comments are limited to 2000 characters.');
  const username = await getAccountUsername(user);
  const { data, error } = await supabase.from('comments').insert({
    user_id: user.id, chapter_id: chapterId, author_name: username, content: cleanContent, parent_comment_id: parentCommentId,
  }).select('id,user_id,chapter_id,author_name,content,created_at,updated_at,parent_comment_id').single();
  if (error) throw error;
  return data;
}

export async function updateComment(commentId, content) {
  const user = await requireUser();
  const clean = String(content || '').trim();
  if (!clean) throw new Error('Write a comment first.');
  if (clean.length > 2000) throw new Error('Comments are limited to 2000 characters.');
  const { data, error } = await supabase.from('comments').update({ content: clean, updated_at: new Date().toISOString() })
    .eq('id', commentId).eq('user_id', user.id)
    .select('id,user_id,chapter_id,author_name,content,created_at,updated_at,parent_comment_id').single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const user = await requireUser();
  const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id);
  if (error) throw error;
}

export async function recordChapterView(chapterId) {
  const { error } = await supabase.from('chapter_views').upsert({ chapter_id: chapterId, viewer_key: getViewerKey() }, { onConflict: 'chapter_id,viewer_key', ignoreDuplicates: true });
  if (error) throw error;
}

export async function likeChapter(chapterId) {
  const { error } = await supabase.from('chapter_likes').upsert({ chapter_id: chapterId, viewer_key: getViewerKey() }, { onConflict: 'chapter_id,viewer_key', ignoreDuplicates: true });
  if (error) throw error;
}

export async function likeComment(commentId) {
  const { error } = await supabase.from('comment_likes').upsert({ comment_id: commentId, viewer_key: getViewerKey() }, { onConflict: 'comment_id,viewer_key', ignoreDuplicates: true });
  if (error) throw error;
}

export async function unlikeComment(commentId) {
  const { error } = await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('viewer_key', getViewerKey());
  if (error) throw error;
}

export async function reportComment(commentId, reason = 'Reported by reader') {
  const { error } = await supabase.from('comment_reports').upsert({ comment_id: commentId, viewer_key: getViewerKey(), reason: String(reason).trim().slice(0, 500) }, { onConflict: 'comment_id,viewer_key', ignoreDuplicates: true });
  if (error) throw error;
}

export async function getMyRating(chapterId) {
  const user = await requireUser();
  const { data, error } = await supabase.from('chapter_ratings').select('id,rating,created_at').eq('chapter_id', chapterId).eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function submitRating(chapterId, rating) {
  const user = await requireUser();
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error('Choose a rating from 1 to 10.');
  const { data, error } = await supabase.from('chapter_ratings').upsert(
    { chapter_id: chapterId, rating: value, user_id: user.id },
    { onConflict: 'user_id,chapter_id' }
  ).select('id,rating,created_at').single();
  if (error) throw error;
  return data;
}
