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
  const ids = [...new Set((chapterIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const [ratings, views, likes, comments] = await Promise.all([
    supabase.from('chapter_ratings').select('chapter_id,rating').in('chapter_id', ids),
    supabase.from('chapter_views').select('chapter_id').in('chapter_id', ids),
    supabase.from('chapter_likes').select('chapter_id').in('chapter_id', ids),
    supabase.from('comments').select('id,chapter_id').in('chapter_id', ids),
  ]);
  for (const result of [ratings, views, likes, comments]) if (result.error) throw result.error;
  return Object.fromEntries(ids.map(id => [id, {
    rating: buildRatingSummary((ratings.data || []).filter(row => row.chapter_id === id)),
    views: (views.data || []).filter(row => row.chapter_id === id).length,
    likes: (likes.data || []).filter(row => row.chapter_id === id).length,
    comments: (comments.data || []).filter(row => row.chapter_id === id).length,
  }]));
}

export async function fetchChapterEngagement(chapterId) {
  const [ratings, views, likes, comments] = await Promise.all([
    supabase.from('chapter_ratings').select('id,rating,created_at').eq('chapter_id', chapterId),
    supabase.from('chapter_views').select('id').eq('chapter_id', chapterId),
    supabase.from('chapter_likes').select('id').eq('chapter_id', chapterId),
    supabase.from('comments').select('id').eq('chapter_id', chapterId),
  ]);
  for (const result of [ratings, views, likes, comments]) if (result.error) throw result.error;
  return { rating: buildRatingSummary(ratings.data || []), views: (views.data || []).length, likes: (likes.data || []).length, comments: (comments.data || []).length };
}

export async function fetchChapterComments(chapterId) {
  const { data, error } = await supabase.from('comments').select('id,user_id,chapter_id,author_name,content,created_at,updated_at,parent_comment_id').eq('chapter_id', chapterId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchCommentLikes(commentIds) {
  const ids = [...new Set((commentIds || []).filter(Boolean))];
  if (!ids.length) return { counts: {}, liked: {} };
  const viewerKey = getViewerKey();
  const [all, own] = await Promise.all([
    supabase.from('comment_likes').select('comment_id').in('comment_id', ids),
    supabase.from('comment_likes').select('comment_id').in('comment_id', ids).eq('viewer_key', viewerKey),
  ]);
  if (all.error) throw all.error;
  if (own.error) throw own.error;
  const counts = {};
  for (const row of all.data || []) counts[row.comment_id] = (counts[row.comment_id] || 0) + 1;
  return { counts, liked: Object.fromEntries((own.data || []).map(row => [row.comment_id, true])) };
}

async function requireUser(message = 'Please sign in to continue.') {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  let user = sessionResult.data?.session?.user || null;
  if (!user) {
    const userResult = await supabase.auth.getUser();
    if (userResult.error && userResult.error.name !== 'AuthSessionMissingError') throw userResult.error;
    user = userResult.data?.user || null;
  }
  if (!user) {
    const err = new Error(message);
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
  const { data, error } = await supabase.from('comments').insert({ user_id: user.id, chapter_id: chapterId, author_name: username, content: cleanContent, parent_comment_id: parentCommentId }).select('id,user_id,chapter_id,author_name,content,created_at,updated_at,parent_comment_id').single();
  if (error) throw error;
  return data;
}

export async function updateComment(commentId, content) {
  const user = await requireUser();
  const clean = String(content || '').trim();
  if (!clean) throw new Error('Write a comment first.');
  if (clean.length > 2000) throw new Error('Comments are limited to 2000 characters.');
  const { data, error } = await supabase.from('comments').update({ content: clean, updated_at: new Date().toISOString() }).eq('id', commentId).eq('user_id', user.id).select('id,user_id,chapter_id,author_name,content,created_at,updated_at,parent_comment_id').single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const user = await requireUser();
  const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id);
  if (error) throw error;
}

export async function recordChapterView(chapterId) { const { error } = await supabase.from('chapter_views').upsert({ chapter_id: chapterId, viewer_key: getViewerKey() }, { onConflict: 'chapter_id,viewer_key', ignoreDuplicates: true }); if (error) throw error; }
export async function likeChapter(chapterId) { const { error } = await supabase.from('chapter_likes').upsert({ chapter_id: chapterId, viewer_key: getViewerKey() }, { onConflict: 'chapter_id,viewer_key', ignoreDuplicates: true }); if (error) throw error; }
export async function likeComment(commentId) { const { error } = await supabase.from('comment_likes').upsert({ comment_id: commentId, viewer_key: getViewerKey() }, { onConflict: 'comment_id,viewer_key', ignoreDuplicates: true }); if (error) throw error; }
export async function unlikeComment(commentId) { const { error } = await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('viewer_key', getViewerKey()); if (error) throw error; }
export async function reportComment(commentId, reason = 'Reported by reader') {
  const viewerKey = getViewerKey();
  const { error } = await supabase.from('comment_reports').insert({ comment_id: commentId, viewer_key: viewerKey, reason: String(reason).trim().slice(0, 500) });
  if (error && error.code !== '23505') throw error;
}

export async function getMyRating(chapterId) {
  const user = await requireUser();
  const { data, error } = await supabase.from('chapter_ratings').select('id,rating,created_at').eq('chapter_id', chapterId).eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function submitRating(chapterId, rating) {
  const user = await requireUser('Sign in to rate this chapter.');
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error('Choose a rating from 1 to 10.');
  const { data, error } = await supabase.from('chapter_ratings').upsert({ chapter_id: chapterId, rating: value, user_id: user.id }, { onConflict: 'user_id,chapter_id' }).select('id,rating,created_at').single();
  if (error) throw error;
  return data;
}