import { getPdlplMediaUrl } from "../../infrastructure/media/pdlplMediaDomain.js";

/**
 * PdPL chapter mapping is deliberately separate from queries and session state.
 * This lets tests cover the fields consumed by the reader and admin UI.
 */

export function published(chapter) {
  return String(chapter?.status || '').trim().toLowerCase() === 'published';
}

export function mapPdlplChapter(row) {
  return {
    id: row.id,
    chapterNumber: row.chapter_number,
    title: row.title || '',
    description: row.description || '',
    coverPath: row.cover_path || null,
    cover: row.cover_path ? getPdlplMediaUrl(row.cover_path) : null,
    cardThumbnailDesktopPath: row.card_thumbnail_desktop_path || null,
    cardThumbnailMobilePath: row.card_thumbnail_mobile_path || null,
    cardThumbnailDesktop: row.card_thumbnail_desktop_path ? getPdlplMediaUrl(row.card_thumbnail_desktop_path) : null,
    cardThumbnailMobile: row.card_thumbnail_mobile_path ? getPdlplMediaUrl(row.card_thumbnail_mobile_path) : null,
    language: String(row.language || 'hi').toLowerCase() === 'en' ? 'en' : 'hi',
    status: row.status || '',
    releaseDate: row.release_date || null,
    createdAt: row.created_at || null,
  };
}


export function isPdlplMemberPlan(planId) {
  return ["supporter", "premium"].includes(
    String(planId ?? "").trim().toLowerCase(),
  );
}
