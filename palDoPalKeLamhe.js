import { supabase } from './supabase';
import { getAdminRole, isAdminRole } from './adminAuth';

export const PDLPL_CHAPTERS = 'pal_do_pal_ke_lamhe_chapters';
export const PDLPL_PAGES = 'pal_do_pal_ke_lamhe_chapter_pages';
export const PDLPL_BUCKET = 'pdlpl-content';
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
  const [planResult, roleResult] = await Promise.all([
    supabase.from('user_subscriptions').select('plan_id,status,current_period_end').eq('user_id', user.id).in('status', ['active', 'cancelled']).order('created_at', { ascending: false }).limit(10),
    getAdminRole(user.id),
  ]);
  if (planResult.error) throw planResult.error;
  const now = Date.now();
  const member = (planResult.data || []).some(row =>
    row.plan_id !== 'free' &&
    (
      (row.status === 'active' && (!row.current_period_end || new Date(row.current_period_end).getTime() > now)) ||
      (row.status === 'cancelled' && row.current_period_end && new Date(row.current_period_end).getTime() > now)
    )
  );
  return { user, member, admin: isAdminRole(roleResult) };
}

export async function buildPdlplChapterPages(chapterId) {
  if (!chapterId) return [];
  const { data, error } = await supabase
    .from(PDLPL_PAGES)
    .select('id,page_number,image_path')
    .eq('chapter_id', chapterId)
    .order('page_number', { ascending: true });
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];
  const signed = await Promise.all(rows.map(async row => {
    const { data: signedData, error: signError } = await supabase.storage
      .from(PDLPL_BUCKET)
      .createSignedUrl(row.image_path, 15 * 60);
    if (signError) throw signError;
    return { ...row, url: signedData?.signedUrl || '' };
  }));
  return signed.filter(page => page.url);
}

export async function uploadPdlplFile(file, path) {
  const { error } = await supabase.storage.from(PDLPL_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
    cacheControl: '3600',
  });
  if (error) throw error;
  return path;
}

export async function removePdlplFiles(paths = []) {
  const clean = paths.filter(Boolean);
  if (!clean.length) return;
  const { error } = await supabase.storage.from(PDLPL_BUCKET).remove(clean);
  if (error) throw error;
}

export async function replacePdlplPages(chapterId, rows) {
  const { error } = await supabase.rpc('pdlpl_replace_chapter_pages', {
    p_chapter_id: chapterId,
    p_pages: rows.map(row => ({ page_number: row.page_number, image_path: row.image_path })),
  });
  if (error) throw error;
}
