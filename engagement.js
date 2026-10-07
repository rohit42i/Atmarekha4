import { supabase } from './supabase';

const VIEWER_KEY_STORAGE = 'atma-rekha-viewer-key-v1';
const ANALYTICS_WORKER_URL = 'https://atma-rekha-analytics.rohitbaswaraj.workers.dev';
const VIEW_RECORDED_STORAGE = 'atma-rekha-view-recorded-v2';

function viewRecordKey(chapterId) {
  return `${VIEW_RECORDED_STORAGE}:${String(chapterId || '')}`;
}

function wasViewRecorded(chapterId) {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(viewRecordKey(chapterId)) === '1'; } catch (_) { return false; }
}

function markViewRecorded(chapterId) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(viewRecordKey(chapterId), '1'); } catch (_) {}
}

async function analyticsRequest(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${ANALYTICS_WORKER_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(body || `Analytics request failed (${response.status}).`);
    }
    return response.json();
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Analytics request timed out. Please try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCloudflareViews(chapterIds = []) {
  const ids = [...new Set((chapterIds || []).filter(Boolean))].slice(0, 100);
  if (!ids.length) return {};
  return analyticsRequest(`/v1/views?chapterIds=${encodeURIComponent(ids.join(','))}`);
}

export async function fetchCloudflareAdminAnalytics(days = 30) {
  const value = Number(days);
  if (![1, 7, 30, 90].includes(value)) throw new Error('Analytics period must be 1, 7, 30 or 90 days.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Admin session required.');
  return analyticsRequest(`/v1/admin/analytics?days=${value}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getViewerKey() {
  if (typeof window === 'undefined') return 'server-viewer-key';
  let key = window.localStorage.getItem(VIEWER_KEY_STORAGE);
  if (!key || key.length < 16 || key.length > 128) {
    key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `1790365175770-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VIEWER_KEY_STORAGE, key);
  }
  return key;
}
export function buildRatingSummary(rows = []) {
  const ratings = rows.map(row => Number(row.rating)).filter(Number.isFinite);
  return { average: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0, count: ratings.length };
}

const emptyChapterStats = () => ({ rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0, pages: 0 });

export async function fetchPublicEngagement(chapterIds) {
  const ids = [...new Set((chapterIds || []).filter(Boolean))].slice(0, 100);
  if (!ids.length) return {};
  const [{ data, error }, cloudflareViews] = await Promise.all([
    supabase
      .from('chapter_engagement_summary')
      .select('chapter_id,views_count,likes_count,ratings_count,ratings_sum,comments_count,pages_count')
      .in('chapter_id', ids),
    fetchCloudflareViews(ids).catch(() => ({})),
  ]);
  if (error) throw error;
  const rows = data || [];
  return Object.fromEntries(ids.map(id => {
    const row = rows.find(item => String(item.chapter_id) === String(id));
    const count = Number(row?.ratings_count) || 0;
    const sum = Number(row?.ratings_sum) || 0;
    return [id, {
      rating: { average: count ? sum / count : 0, count },
      views: Number(cloudflareViews?.[id] ?? row?.views_count ?? 0) || 0,
      likes: Number(row?.likes_count) || 0,
      comments: Number(row?.comments_count) || 0,
      pages: Number(row?.pages_count) || 0,
    }];
  }));
}

export async function fetchChapterEngagement(chapterId) {
  if (!chapterId) return emptyChapterStats();
  const [{ data, error }, cloudflareViews] = await Promise.all([
    supabase
      .from('chapter_engagement_summary')
      .select('chapter_id,views_count,likes_count,ratings_count,ratings_sum,comments_count,pages_count')
      .eq('chapter_id', chapterId)
      .maybeSingle(),
    fetchCloudflareViews([chapterId]).catch(() => ({})),
  ]);
  if (error) throw error;
  const count = Number(data?.ratings_count) || 0;
  const sum = Number(data?.ratings_sum) || 0;
  return {
    rating: { average: count ? sum / count : 0, count },
    views: Number(cloudflareViews?.[chapterId] ?? data?.views_count ?? 0) || 0,
    likes: Number(data?.likes_count) || 0,
    comments: Number(data?.comments_count) || 0,
    pages: Number(data?.pages_count) || 0,
  };
}

export async function fetchChapterComments(chapterId) {
  const { data, error } = await supabase.from('comments')
    .select('id,user_id,chapter_id,announcement_id,author_name,content,created_at,updated_at,parent_comment_id')
    .eq('chapter_id', chapterId).order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchAnnouncementComments(announcementId) {
  const { data, error } = await supabase.from('comments')
    .select('id,user_id,chapter_id,announcement_id,author_name,content,created_at,updated_at,parent_comment_id')
    .eq('announcement_id', announcementId).order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  return data || [];
}

const LIKED_COMMENT_STORAGE = 'atma-rekha-liked-comments-v1';

function getLikedCommentIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    const values = JSON.parse(window.localStorage.getItem(LIKED_COMMENT_STORAGE) || '[]');
    return new Set(Array.isArray(values) ? values.filter(Boolean) : []);
  } catch (_) {
    return new Set();
  }
}

function saveLikedCommentIds(ids) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LIKED_COMMENT_STORAGE, JSON.stringify([...ids].slice(-1000))); } catch (_) {}
}

export async function fetchCommentLikes(commentIds) {
  const ids = [...new Set((commentIds || []).filter(Boolean))].slice(0, 150);
  if (!ids.length) return { counts: {}, liked: {} };

  const { data: countsData, error: countsError } = await supabase
    .from('comment_like_counts')
    .select('comment_id,like_count')
    .in('comment_id', ids);
  if (countsError) throw countsError;

  let ownData = [];
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (userId) {
    const { data, error } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', userId)
      .in('comment_id', ids);
    if (error) throw error;
    ownData = data || [];
  }

  const counts = Object.fromEntries((countsData || []).map(row => [
    row.comment_id,
    Number(row.like_count) || 0,
  ]));
  const liked = Object.fromEntries(ownData.map(row => [row.comment_id, true]));

  // Keep the local set only for legacy compatibility; authenticated state is
  // now read securely from the database and is authoritative.
  const legacyLiked = getLikedCommentIds();
  for (const id of legacyLiked) {
    if (ids.includes(id) && !liked[id]) liked[id] = false;
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

export async function addComment({ chapterId = null, announcementId = null, content, parentCommentId = null }) {
  const user = await requireUser();
  const hasChapter = Boolean(chapterId);
  const hasAnnouncement = Boolean(announcementId);
  if (hasChapter === hasAnnouncement) throw new Error('Choose exactly one comment destination.');
  const cleanContent = String(content || '').trim();
  if (!cleanContent) throw new Error('Write a comment first.');
  if (cleanContent.length > 2000) throw new Error('Comments are limited to 2000 characters.');
  const username = await getAccountUsername(user);
  const { data, error } = await supabase.from('comments').insert({
    user_id: user.id,
    chapter_id: hasChapter ? chapterId : null,
    announcement_id: hasAnnouncement ? announcementId : null,
    author_name: username,
    content: cleanContent,
    parent_comment_id: parentCommentId,
  }).select('id,user_id,chapter_id,announcement_id,author_name,content,created_at,updated_at,parent_comment_id').single();
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
    .select('id,user_id,chapter_id,announcement_id,author_name,content,created_at,updated_at,parent_comment_id').single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const user = await requireUser();
  const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id);
  if (error) throw error;
}

export async function recordChapterShare(chapterId) {
  if (!chapterId) throw new Error('Chapter ID is required.');
  const { error } = await supabase.from('chapter_shares').insert({
    chapter_id: chapterId,
    viewer_key: getViewerKey(),
  });
  if (error) throw error;
  return { recorded: true };
}

export async function recordChapterView(chapterId) {
  if (!chapterId) throw new Error('Chapter ID is required.');
  if (wasViewRecorded(chapterId)) return { recorded: false, duplicate: true };
  const viewerKey = getViewerKey();
  try {
    await analyticsRequest('/v1/view', {
      method: 'POST',
      body: JSON.stringify({ chapterId, viewerKey }),
    });
    markViewRecorded(chapterId);
    return { recorded: true };
  } catch (analyticsError) {
    // Transitional fallback: retain the legacy Supabase write until the
    // migration is completed. After the legacy insert policy is removed,
    // this fails silently in the existing reader error handler.
    const { error } = await supabase.from('chapter_views').insert({
      chapter_id: chapterId,
      viewer_key: viewerKey,
    });
    if (error && error.code !== '23505') throw analyticsError;
    markViewRecorded(chapterId);
    return { recorded: !error, fallback: true };
  }
}

export async function likeChapter(chapterId) {
  const { error } = await supabase.from('chapter_likes').upsert({ chapter_id: chapterId, viewer_key: getViewerKey() }, { onConflict: 'chapter_id,viewer_key', ignoreDuplicates: true });
  if (error) throw error;
}

export async function likeComment(commentId) {
  const user = await requireUser();
  const { error } = await supabase.from('comment_likes').insert({
    comment_id: commentId,
    viewer_key: getViewerKey(),
    user_id: user.id,
  });
  if (error && error.code !== '23505') throw error;
  const likedIds = getLikedCommentIds();
  likedIds.add(String(commentId));
  saveLikedCommentIds(likedIds);
}

export async function unlikeComment(commentId) {
  const user = await requireUser();
  const { error: ownError } = await supabase.from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', user.id);
  if (ownError) throw ownError;
  const { error: legacyError } = await supabase.from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .is('user_id', null)
    .eq('viewer_key', getViewerKey());
  if (legacyError) throw legacyError;
  const likedIds = getLikedCommentIds();
  likedIds.delete(String(commentId));
  saveLikedCommentIds(likedIds);
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

  const { data: existing, error: existingError } = await supabase
    .from('chapter_ratings')
    .select('id,rating,created_at')
    .eq('chapter_id', chapterId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existingError) throw existingError;

  const { data, error } = await supabase.from('chapter_ratings').upsert(
    { chapter_id: chapterId, rating: value, user_id: user.id },
    { onConflict: 'user_id,chapter_id' }
  ).select('id,rating,created_at').single();
  if (error) throw error;
  return { ...data, previousRating: existing?.rating ?? null, alreadyRated: Boolean(existing) };
}
