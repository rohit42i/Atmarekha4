import { getAdminRole, isAdminRole } from './adminAuth';
import { getCurrentMembership, supabase } from './supabase';
import { getPdlplMediaUrl } from './pdlplR2';

export const PDLPL_CHAPTERS = 'pal_do_pal_ke_lamhe_chapters';
export const PDLPL_PAGES = 'pal_do_pal_ke_lamhe_chapter_pages';
export const PDLPL_ROUTE = 'pal-do-pal-ke-lamhe';

export function published(chapter) {
  return String(chapter?.status || '').trim().toLowerCase() === 'published';
}

export function mapChapter(row) {
  return {
    id: row.id,
    chapterNumber: row.chapter_number,
    title: row.title || '',
    description: row.description || '',
    coverPath: row.cover_path || null,
    cover: row.cover_path ? getPdlplMediaUrl(row.cover_path) : null,
    cardThumbnailDesktopPath: row.card_thumbnail_desktop_path || null,
    cardThumbnailMobilePath: row.card_thumbnail_mobile_path || null,
    chapterListThumbnailDesktopPath: row.chapter_list_thumbnail_desktop_path || null,
    chapterListThumbnailMobilePath: row.chapter_list_thumbnail_mobile_path || null,
    chapterListThumbnailDesktop: row.chapter_list_thumbnail_desktop_path ? getPdlplMediaUrl(row.chapter_list_thumbnail_desktop_path) : null,
    chapterListThumbnailMobile: row.chapter_list_thumbnail_mobile_path ? getPdlplMediaUrl(row.chapter_list_thumbnail_mobile_path) : null,
    cardThumbnailDesktop: row.card_thumbnail_desktop_path ? getPdlplMediaUrl(row.card_thumbnail_desktop_path) : null,
    cardThumbnailMobile: row.card_thumbnail_mobile_path ? getPdlplMediaUrl(row.card_thumbnail_mobile_path) : null,
    language: String(row.language || 'hi').toLowerCase() === 'en' ? 'en' : 'hi',
    status: row.status || '',
    releaseDate: row.release_date || null,
    createdAt: row.created_at || null,
  };
}

export async function buildPdlplChapters() {
  const { data, error } = await supabase
    .from(PDLPL_CHAPTERS)
    .select('id,chapter_number,title,description,cover_path,card_thumbnail_desktop_path,card_thumbnail_mobile_path,chapter_list_thumbnail_desktop_path,chapter_list_thumbnail_mobile_path,status,release_date,created_at,language')
    .order('chapter_number', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapChapter);
}

let pdlplAccessCache = { key: '', value: null, expiresAt: 0 };
const PDLPL_ACCESS_CACHE_MS = 30 * 1000;

export async function getPdlplMemberAccess() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, member: false, admin: false };
  if (pdlplAccessCache.key === user.id && pdlplAccessCache.expiresAt > Date.now() && pdlplAccessCache.value) return pdlplAccessCache.value;

  const [planId, role] = await Promise.all([
    getCurrentMembership(user.id),
    getAdminRole(user.id),
  ]);

  const result = {
    user,
    planId: String(planId || '').trim().toLowerCase() || null,
    member: ['supporter', 'premium'].includes(String(planId || '').trim().toLowerCase()),
    admin: isAdminRole(role),
  };
  pdlplAccessCache = { key: user.id, value: result, expiresAt: Date.now() + PDLPL_ACCESS_CACHE_MS };
  return result;
}

export async function buildPdlplChapterPages(chapterId) {
  if (!chapterId) return [];

  const { data, error } = await supabase
    .from(PDLPL_PAGES)
    .select('id,chapter_id,page_number,image_path')
    .eq('chapter_id', chapterId)
    .order('page_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function buildPdlplPageCounts(chapterIds = []) {
  const ids = chapterIds.filter(Boolean);
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from('pdlpl_chapter_engagement_summary')
    .select('chapter_id,pages_count')
    .in('chapter_id', ids);

  if (error) throw error;

  return Object.fromEntries(
    ids.map(id => [id, Number((data || []).find(row => String(row.chapter_id) === String(id))?.pages_count) || 0]),
  );
}
