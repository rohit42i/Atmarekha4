/**
 * Domain-only chapter helpers stay independent from HTTP, Supabase, and UI
 * rendering so ordering and labels can be tested without a browser session.
 *
 * @typedef {{
 *   id?: string | number | null,
 *   chapterNumber?: string | number | null,
 *   createdAt?: string | number | Date | null
 * }} ChapterLike
 */

export const CHAPTER_LANGUAGES = [
  { value: "en", label: "English", locale: "en-IN" },
  { value: "hi", label: "Hindi", locale: "hi-Latn-IN" },
];

/** @param {unknown} language */
export function normalizeChapterLanguage(language) {
  return String(language ?? "")
    .trim()
    .toLowerCase() === "en"
    ? "en"
    : "hi";
}

/** @param {unknown} language */
export function chapterLanguageLabel(language) {
  return normalizeChapterLanguage(language) === "en" ? "English" : "Hindi";
}

/**
 * @param {unknown} chapterNumber
 * @param {{ short?: boolean, title?: unknown }} [options]
 */
export function formatChapterLabel(chapterNumber, options = {}) {
  const { short = false, title = "" } = options;
  const number =
    chapterNumber === null || chapterNumber === undefined || chapterNumber === ""
      ? null
      : Number(chapterNumber);

  if (number !== null && Number.isFinite(number)) {
    return `Chapter ${number}`;
  }

  const cleanTitle = String(title ?? "").trim();
  if (short && cleanTitle) return cleanTitle;
  return "Special";
}

/**
 * @param {unknown} chapterNumber
 * @param {unknown} [title]
 */
export function formatChapterEyebrow(chapterNumber, title = "") {
  const number =
    chapterNumber === null || chapterNumber === undefined || chapterNumber === ""
      ? null
      : Number(chapterNumber);

  if (number !== null && Number.isFinite(number)) {
    return `CHAPTER ${number}`;
  }

  const cleanTitle = String(title ?? "").trim();
  if (cleanTitle) return cleanTitle.toUpperCase().slice(0, 40);
  return "SPECIAL";
}

/**
 * Numeric chapters sort first. Special chapters retain chronological order;
 * IDs provide a stable tie-breaker so list order does not flicker between loads.
 *
 * @param {ChapterLike[] | null | undefined} chapters
 * @returns {ChapterLike[]}
 */
export function sortChapters(chapters) {
  const list = Array.isArray(chapters) ? chapters : [];

  return [...list].sort((left, right) => {
    const leftRaw = left?.chapterNumber;
    const rightRaw = right?.chapterNumber;
    const leftNumber =
      leftRaw === null || leftRaw === undefined || leftRaw === ""
        ? null
        : Number(leftRaw);
    const rightNumber =
      rightRaw === null || rightRaw === undefined || rightRaw === ""
        ? null
        : Number(rightRaw);
    const leftIsNumber = leftNumber !== null && Number.isFinite(leftNumber);
    const rightIsNumber = rightNumber !== null && Number.isFinite(rightNumber);

    if (leftIsNumber && rightIsNumber) return leftNumber - rightNumber;
    if (leftIsNumber && !rightIsNumber) return -1;
    if (!leftIsNumber && rightIsNumber) return 1;

    const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
    if (leftTime !== rightTime) return leftTime - rightTime;

    return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
  });
}
