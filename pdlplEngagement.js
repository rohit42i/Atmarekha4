import { supabase } from './supabase';
import { getViewerKey } from './engagement';

const SUMMARY = 'pdlpl_chapter_engagement_summary';
const COMMENTS = 'pdlpl_comments';
const COMMENT_LIKES = 'pdlpl_comment_likes';
const COMMENT_LIKE_COUNTS = 'pdlpl_comment_like_counts';

const publicSummary = row => {
  const ratings = Number(row?.ratings_count) || 0;
  return {
    rating: { average: ratings ? (Number(row?.ratings_sum) || 0) / ratings : 0, count: ratings },
    views: Number(row?.views_count) || 0,
    likes: Number(row?.likes_count) || 0,
    comments: Number(row?.comments_count) || 0,
    pages: Number(row?.pages_count) || 0,
    shares: Number(row?.shares_count) || 0,
  };
};

export async function fetchPdlplPublicEngagement(chapterIds = []) {
  const ids = [...new Set((chapterIds || []).filter(Boolean))].slice(0, 100);
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from(SUMMARY)
    .select('chapter_id,views_count,likes_count,ratings_count,ratings_sum,comments_count,pages_count,shares_count')
    .in('chapter_id', ids);
  if (error) throw error;
  const byId = new Map((data || []).map(row => [String(row.chapter_id), publicSummary(row)]));
  return Object.fromEntries(ids.map(id => [id, byId.get(String(id)) || {
    rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0, pages: 0, shares: 0,
  }]));
}

export async function fetchPdlplChapterEngagement(chapterId) {
  const [result] = Object.values(await fetchPdlplPublicEngagement([chapterId]));
  return result || { rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0, pages: 0, shares: 0 };
}

export async function recordPdlplChapterView(chapterId) {
  if (!chapterId) throw new Error('Chapter ID is required.');
  const { error } = await supabase.from('pdlpl_chapter_views').insert({
    chapter_id: chapterId,
    viewer_key: getViewerKey(),
  });
  if (error && error.code !== '23505') throw error;
  return { recorded: !error };
}

export async function likePdlplChapter(chapterId) {
  const { error } = await supabase.from('pdlpl_chapter_likes').insert({
    chapter_id: chapterId,
    viewer_key: getViewerKey(),
  });
  if (error && error.code !== '23505') throw error;
}

export async function unlikePdlplChapter(chapterId) {
  const { error } = await supabase.from('pdlpl_chapter_likes').delete()
    .eq('chapter_id', chapterId)
    .eq('viewer_key', getViewerKey());
  if (error) throw error;
}

export async function recordPdlplChapterShare(chapterId) {
  if (!chapterId) throw new Error('Chapter ID is required.');
  const { error } = await supabase.from('pdlpl_chapter_shares').insert({
    chapter_id: chapterId,
    viewer_key: getViewerKey(),
  });
  if (error && error.code !== '23505') throw error;
}

export async function fetchPdlplCommentLikes(commentIds = []) {
  const ids = [...new Set((commentIds || []).filter(Boolean))].slice(0, 150);
  if (!ids.length) return { counts: {}, liked: {} };
  const { data: counts, error: countsError } = await supabase
    .from(COMMENT_LIKE_COUNTS)
    .select('comment_id,like_count')
    .in('comment_id', ids);
  if (countsError) throw countsError;
  const { data: own, error: ownError } = await supabase
    .from(COMMENT_LIKES)
    .select('comment_id')
    .in('comment_id', ids);
  if (ownError) {
    const { data: authData } = await supabase.auth.getSession();
    if (!authData?.session?.user) return { counts: Object.fromEntries((counts || []).map(r => [r.comment_id, Number(r.like_count) || 0])), liked: {} };
    throw ownError;
  }
  return {
    counts: Object.fromEntries((counts || []).map(r => [r.comment_id, Number(r.like_count) || 0])),
    liked: Object.fromEntries((own || []).map(r => [r.comment_id, true])),
  };
}

export async function likePdlplComment(commentId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw Object.assign(new Error('Please sign in to continue.'), { code: 'AUTH_REQUIRED' });
  const { error } = await supabase.from(COMMENT_LIKES).insert({
    comment_id: commentId,
    user_id: userId,
    viewer_key: getViewerKey(),
  });
  if (error && error.code !== '23505') throw error;
}

export async function unlikePdlplComment(commentId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw Object.assign(new Error('Please sign in to continue.'), { code: 'AUTH_REQUIRED' });
  const { error } = await supabase.from(COMMENT_LIKES).delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function reportPdlplComment(commentId, reason = 'Reported by reader') {
  const { error } = await supabase.from('pdlpl_comment_reports').insert({
    comment_id: commentId,
    viewer_key: getViewerKey(),
    reason: String(reason).trim().slice(0, 500),
  });
  if (error && error.code !== '23505') throw error;
}

export async function fetchPdlplChapterComments(chapterId) {
  const { data, error } = await supabase.from(COMMENTS)
    .select('id,user_id,chapter_id,author_name,content,created_at,updated_at,parent_comment_id')
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function addPdlplComment({ chapterId, content, parentCommentId = null }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) throw Object.assign(new Error('Please sign in to continue.'), { code: 'AUTH_REQUIRED' });
  const clean = String(content || '').trim();
  if (!clean) throw new Error('Write a comment first.');
  if (clean.length > 2000) throw new Error('Comments are limited to 2000 characters.');
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('username').eq('id', user.id).maybeSingle();
  if (profileError) throw profileError;
  const authorName = String(profile?.username || 'reader').replace(/^@+/, '').slice(0, 80) || 'reader';
  const { data, error } = await supabase.from(COMMENTS).insert({
    chapter_id: chapterId,
    user_id: user.id,
    author_name: authorName,
    content: clean,
    parent_comment_id: parentCommentId,
  }).select('id,user_id,chapter_id,author_name,content,created_at,updated_at,parent_comment_id').single();
  if (error) throw error;
  return data;
}

export async function getPdlplRating(chapterId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase.from('pdlpl_chapter_ratings')
    .select('id,rating,created_at')
    .eq('chapter_id', chapterId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function submitPdlplRating(chapterId, rating) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw Object.assign(new Error('Please sign in to continue.'), { code: 'AUTH_REQUIRED' });
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error('Choose a rating from 1 to 10.');
  const { data: existing, error: existingError } = await supabase.from('pdlpl_chapter_ratings')
    .select('id,rating,created_at')
    .eq('chapter_id', chapterId).eq('user_id', userId).maybeSingle();
  if (existingError) throw existingError;
  const { data, error } = await supabase.from('pdlpl_chapter_ratings')
    .upsert({ chapter_id: chapterId, rating: value, user_id: userId }, { onConflict: 'user_id,chapter_id' })
    .select('id,rating,created_at').single();
  if (error) throw error;
  return { ...data, previousRating: existing?.rating ?? null, alreadyRated: Boolean(existing) };
}

export async function getPdlplBookmark(chapterId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return false;
  const { data, error } = await supabase.from('pdlpl_bookmarks').select('id')
    .eq('user_id', userId).eq('chapter_id', chapterId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function togglePdlplBookmark(chapterId, saved) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw Object.assign(new Error('Please sign in to continue.'), { code: 'AUTH_REQUIRED' });
  if (saved) {
    const { error } = await supabase.from('pdlpl_bookmarks').delete().eq('user_id', userId).eq('chapter_id', chapterId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('pdlpl_bookmarks').insert({ user_id: userId, chapter_id: chapterId });
    if (error && error.code !== '23505') throw error;
  }
}

export async function getPdlplReadingProgress(chapterId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase.from('pdlpl_reading_history').select('page_number')
    .eq('user_id', userId).eq('chapter_id', chapterId).maybeSingle();
  if (error) throw error;
  return Number(data?.page_number) || null;
}

export async function savePdlplReadingProgress(chapterId, pageNumber) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return;
  const value = Math.max(1, Math.floor(Number(pageNumber) || 1));
  const { error } = await supabase.from('pdlpl_reading_history')
    .upsert({ user_id: userId, chapter_id: chapterId, page_number: value }, { onConflict: 'user_id,chapter_id' });
  if (error) throw error;
}
