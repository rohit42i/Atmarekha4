'use strict';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PUBLIC_CHAPTERS = 250;

/**
 * Catalyst ZCQL results wrap each row in its table name:
 * { chapters: { id, chapter_number, source_status, ... } }.
 * Accept the plain row form as well so this mapper is easy to test.
 */
function unwrapChapterRow(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const row = record.chapters;
  return row && typeof row === 'object' && !Array.isArray(row) ? row : record;
}

/**
 * Translate only the explicitly approved public columns and reverse the
 * aliases in CATALYST-SCHEMA-MAP.csv. Never spread target rows into responses.
 */
function toPublicChapter(record) {
  const row = unwrapChapterRow(record);
  if (!row) return null;

  if (String(row.source_status ?? row.status ?? '').toLowerCase() !== 'published') return null;
  if (row.deleted_at !== null && row.deleted_at !== undefined && row.deleted_at !== '') return null;

  const id = String(row.id ?? '');
  const chapterNumber = Number(row.chapter_number);
  if (!UUID_RE.test(id) || !Number.isFinite(chapterNumber)) return null;

  return {
    id,
    chapter_number: chapterNumber,
    title: String(row.title ?? ''),
    description: row.description == null ? null : String(row.description),
    cover_url: row.cover_url == null ? null : String(row.cover_url),
    status: 'published',
    release_date: row.release_date == null ? null : String(row.release_date),
    manga_id: row.manga_id == null ? null : String(row.manga_id),
    language: String(row.lang_code ?? row.language ?? 'hi').toLowerCase() === 'en' ? 'en' : 'hi',
    card_thumbnail_desktop_url: row.card_thumbnail_desktop_url == null ? null : String(row.card_thumbnail_desktop_url),
    card_thumbnail_mobile_url: row.card_thumbnail_mobile_url == null ? null : String(row.card_thumbnail_mobile_url),
    chapter_list_thumbnail_desktop_url: row.chapter_list_thumb_desktop_url == null ? null : String(row.chapter_list_thumb_desktop_url),
    chapter_list_thumbnail_mobile_url: row.chapter_list_thumb_mobile_url == null ? null : String(row.chapter_list_thumb_mobile_url),
  };
}

function toPublicChapters(records) {
  if (!Array.isArray(records)) return [];
  return records
    .map(toPublicChapter)
    .filter(Boolean)
    .sort((a, b) => a.chapter_number - b.chapter_number)
    .slice(0, MAX_PUBLIC_CHAPTERS);
}

module.exports = { UUID_RE, MAX_PUBLIC_CHAPTERS, unwrapChapterRow, toPublicChapter, toPublicChapters };
