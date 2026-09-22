import { getAdminRole, isAdminRole } from './adminAuth';
import { getCurrentMembership, supabase } from './supabase';

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
    status: row.status || '',
    releaseDate: row.release_date || null,
    createdAt: row.created_at || null,
  };
}

export async function buildPdlplChapters() {
  const { data, error } = await supabase
    .from(PDLPL_CHAPTERS)
    .select('id,chapter_number,title,description,cover_path,status,release_date,created_at')
    .order('chapter_number', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapChapter);
}

export async function getPdlplMemberAccess() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, member: false, admin: false };

  const [planId, role] = await Promise.all([
    getCurrentMembership(user.id),
    getAdminRole(user.id),
  ]);

  return {
    user,
    member: Boolean(planId && String(planId).toLowerCase() !== 'free'),
    admin: isAdminRole(role),
  };
}

/**
 * Page metadata is protected by PDLPL RLS.
 * Image bytes are fetched separately through the dedicated Cloudflare Worker,
 * which repeats the membership/admin check before reading from R2.
 */
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
