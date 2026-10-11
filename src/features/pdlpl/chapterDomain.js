import { getPdlplMediaUrl } from "../../infrastructure/media/pdlplMediaDomain.js";

/**
 * @typedef {{
 *   id: string | number,
 *   chapter_number?: string | number | null,
 *   title?: string | null,
 *   description?: string | null,
 *   cover_path?: string | null,
 *   card_thumbnail_desktop_path?: string | null,
 *   card_thumbnail_mobile_path?: string | null,
 *   language?: string | null,
 *   status?: string | null,
 *   release_date?: string | null,
 *   created_at?: string | null
 * }} PdlplChapterRow
 */

/**
 * PdPL chapter mapping is deliberately separate from queries and session state.
 * This lets tests cover the fields consumed by the reader and admin UI.
 */

/** @param {{ status?: unknown } | null | undefined} chapter */
export function published(chapter) {
  return (
    String(chapter?.status || "")
      .trim()
      .toLowerCase() === "published"
  );
}

/** @param {PdlplChapterRow} row */
export function mapPdlplChapter(row) {
  return {
    id: row.id,
    chapterNumber: row.chapter_number,
    title: row.title || "",
    description: row.description || "",
    coverPath: row.cover_path || null,
    cover: row.cover_path ? getPdlplMediaUrl(row.cover_path) : null,
    cardThumbnailDesktopPath: row.card_thumbnail_desktop_path || null,
    cardThumbnailMobilePath: row.card_thumbnail_mobile_path || null,
    cardThumbnailDesktop: row.card_thumbnail_desktop_path
      ? getPdlplMediaUrl(row.card_thumbnail_desktop_path)
      : null,
    cardThumbnailMobile: row.card_thumbnail_mobile_path
      ? getPdlplMediaUrl(row.card_thumbnail_mobile_path)
      : null,
    language: String(row.language || "hi").toLowerCase() === "en" ? "en" : "hi",
    status: row.status || "",
    releaseDate: row.release_date || null,
    createdAt: row.created_at || null,
  };
}

/** @param {unknown} planId */
export function isPdlplMemberPlan(planId) {
  return ["supporter", "premium"].includes(
    String(planId ?? "")
      .trim()
      .toLowerCase(),
  );
}
