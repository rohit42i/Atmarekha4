import { getAdminRole, isAdminRole } from "../auth/adminAuthorizationService.js";
import { getCurrentMembership, supabase } from "../../../supabase";
import { isPdlplMemberPlan, mapPdlplChapter } from "./chapterDomain.js";

export { isPdlplMemberPlan, mapPdlplChapter, published } from "./chapterDomain.js";

export const PDLPL_CHAPTERS = "pal_do_pal_ke_lamhe_chapters";
export const PDLPL_PAGES = "pal_do_pal_ke_lamhe_chapter_pages";
export const PDLPL_ROUTE = "pal-do-pal-ke-lamhe";

export async function buildPdlplChapters() {
  const { data, error } = await supabase
    .from(PDLPL_CHAPTERS)
    .select(
      "id,chapter_number,title,description,cover_path,card_thumbnail_desktop_path,card_thumbnail_mobile_path,status,release_date,created_at,language",
    )
    .order("chapter_number", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapPdlplChapter);
}

let pdlplAccessCache = { key: "", value: null, expiresAt: 0 };
const PDLPL_ACCESS_CACHE_MS = 30 * 1000;

export async function getPdlplMemberAccess() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, member: false, admin: false };
  if (
    pdlplAccessCache.key === user.id &&
    pdlplAccessCache.expiresAt > Date.now() &&
    pdlplAccessCache.value
  )
    return pdlplAccessCache.value;

  const [planId, role] = await Promise.all([
    getCurrentMembership(user.id),
    getAdminRole(user.id),
  ]);

  const result = {
    user,
    planId:
      String(planId || "")
        .trim()
        .toLowerCase() || null,
    member: isPdlplMemberPlan(planId),
    admin: isAdminRole(role),
  };
  pdlplAccessCache = {
    key: user.id,
    value: result,
    expiresAt: Date.now() + PDLPL_ACCESS_CACHE_MS,
  };
  return result;
}

export async function buildPdlplChapterPages(chapterId) {
  if (!chapterId) return [];

  const { data, error } = await supabase
    .from(PDLPL_PAGES)
    .select("id,chapter_id,page_number,image_path")
    .eq("chapter_id", chapterId)
    .order("page_number", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function buildPdlplPageCounts(chapterIds = []) {
  const ids = chapterIds.filter(Boolean);
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from("pdlpl_chapter_engagement_summary")
    .select("chapter_id,pages_count")
    .in("chapter_id", ids);

  if (error) throw error;

  return Object.fromEntries(
    ids.map((id) => [
      id,
      Number(
        (data || []).find((row) => String(row.chapter_id) === String(id))?.pages_count,
      ) || 0,
    ]),
  );
}
