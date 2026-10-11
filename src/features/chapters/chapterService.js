import { supabase } from "../../../supabase";
import { publicEnv } from "../../config/publicEnv.js";
import { chapterPath } from "../../app/routing/routeService.js";
import { normalizeChapterLanguage, sortChapters } from "./chapterDomain.js";

export {
  CHAPTER_LANGUAGES,
  chapterLanguageLabel,
  formatChapterEyebrow,
  formatChapterLabel,
  normalizeChapterLanguage,
  sortChapters,
} from "./chapterDomain.js";

const CHAPTERS_TABLE = "chapters";
const PAGES_TABLE = "chapter_pages";
const PAGE_FETCH_ATTEMPTS = 2;
const PAGE_FETCH_DELAY_MS = 150;

/** @param {number} milliseconds */
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Kept here for compatibility because chapter cards currently receive their
 * cover image through this stylesheet hook. Extract it into the UI layer only
 * after every chapter-list entry point uses the same presentation component.
 */
/**
 * @param {Array<{id?: string | number | null, mangaId?: string | null, chapterNumber?: string | number | null, language?: string | null, cover?: string | null, title?: string | null, createdAt?: string | number | Date | null}>} chapters
 */
function installChapterCoverStyles(chapters) {
  if (typeof document === "undefined") return;

  const styleId = "atma-rekha-chapter-cover-styles";
  document.getElementById(styleId)?.remove();

  const rules = chapters
    .filter((chapter) => chapter.cover)
    .map((chapter) => {
      const href = chapterPath(chapter);
      const cover = JSON.stringify(String(chapter.cover));
      return (
        '.chapter-row-main[href="' +
        href +
        '"]::before{background-image:url(' +
        cover +
        ");}"
      );
    })
    .join("");

  if (!rules) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = rules;
  document.head.appendChild(style);
}

export async function buildChapters() {
  const { data, error } = await supabase
    .from(CHAPTERS_TABLE)
    .select(
      "id,manga_id,language,chapter_number,title,description,cover_url,card_thumbnail_desktop_url,card_thumbnail_mobile_url,status,release_date,created_at",
    )
    .order("chapter_number", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Supabase chapters error:", error);
    throw error;
  }

  const chapters = /** @type {Array<Record<string, any>>} */ (data || []).map(
    (chapter) => ({
      id: chapter.id,
      mangaId: chapter.manga_id || null,
      language: normalizeChapterLanguage(chapter.language),
      chapterNumber: chapter.chapter_number,
      title: chapter.title || "",
      description: chapter.description || "",
      cover: chapter.cover_url || null,
      cardThumbnailDesktop: chapter.card_thumbnail_desktop_url || null,
      cardThumbnailMobile: chapter.card_thumbnail_mobile_url || null,
      status: chapter.status || "",
      releaseDate: chapter.release_date || null,
      createdAt: chapter.created_at || null,
    }),
  );

  installChapterCoverStyles(chapters);
  return sortChapters(chapters);
}

/** @param {string | null | undefined} url */
function normalizeReaderPageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  const workerOrigin = publicEnv.mediaWorkerUrl;
  const publicPrefix = "/storage/v1/object/public/";
  const signedPrefix = "/storage/v1/object/sign/";
  const authenticatedPrefix = "/storage/v1/object/authenticated/";

  try {
    const parsed = new URL(value, window.location.origin);
    let key = "";

    for (const prefix of [publicPrefix, signedPrefix, authenticatedPrefix]) {
      const index = parsed.pathname.indexOf(prefix);
      if (index >= 0) {
        key = decodeURIComponent(parsed.pathname.slice(index + prefix.length));
        break;
      }
    }

    // Support older rows that store an R2 key instead of a complete URL.
    if (!key && !parsed.protocol.startsWith("http")) {
      key = value.replace(/^\/+/, "");
    }
    if (!key) return value;

    if (key.startsWith("chapter-pages/")) {
      const legacy = key.match(
        /^chapter-pages\/chapters\/([0-9a-f-]{36})\/pages\/(?:[^/]+-)?(\d+)\/(.+)$/i,
      );
      if (legacy) {
        key = "chapter-pages/" + legacy[1] + "/" + legacy[2] + "/" + legacy[3];
      }

      const legacyPages = key.match(
        /^chapter-pages\/chapters\/([0-9a-f-]{36})\/pages\/(\d+)\/(.+)$/i,
      );
      if (legacyPages) {
        key =
          "chapter-pages/" +
          legacyPages[1] +
          "/" +
          legacyPages[2] +
          "/" +
          legacyPages[3];
      }

      const uuidPages = key.match(
        /^chapter-pages\/([0-9a-f-]{36})\/pages\/(\d+)\/(.+)$/i,
      );
      if (uuidPages) {
        key = "chapter-pages/" + uuidPages[1] + "/" + uuidPages[2] + "/" + uuidPages[3];
      }

      parsed.protocol = "https:";
      parsed.host = new URL(workerOrigin).host;
      parsed.pathname = publicPrefix + key.split("/").map(encodeURIComponent).join("/");
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    }
  } catch (_error) {
    // Preserve the original URL if an old row cannot be normalized.
  }

  return value;
}

/** @param {string | null | undefined} chapterId */
export async function buildChapterPages(chapterId) {
  if (!chapterId) return [];

  let lastError = null;

  for (let attempt = 1; attempt <= PAGE_FETCH_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from(PAGES_TABLE)
      .select("page_number,image_url")
      .eq("chapter_id", chapterId)
      .order("page_number", { ascending: true });

    if (!error) {
      const rows =
        /** @type {{page_number?: number | string | null, image_url?: string | null}[]} */ (
          Array.isArray(data) ? [...data] : []
        );
      rows.sort(
        (left, right) => Number(left?.page_number) - Number(right?.page_number),
      );

      let pages = rows
        .map((page) => normalizeReaderPageUrl(page?.image_url))
        .filter(Boolean);

      // Recover page URLs from the media Worker when metadata rows are absent.
      if (!pages.length) {
        try {
          const workerUrl = publicEnv.mediaWorkerUrl;
          const response = await fetch(
            workerUrl +
              "/storage/v1/object/list/chapter-pages/" +
              encodeURIComponent(chapterId),
            {
              headers: { Accept: "application/json" },
              credentials: "omit",
            },
          );

          if (response.ok) {
            const payload = await response.json();
            const rawKeys = /** @type {unknown[]} */ (
              Array.isArray(payload?.keys) ? payload.keys : []
            );
            const keys = rawKeys.filter((key) => typeof key === "string");
            pages = keys
              .sort((left, right) =>
                String(left).localeCompare(String(right), undefined, {
                  numeric: true,
                }),
              )
              .map(
                (key) =>
                  workerUrl +
                  "/storage/v1/object/public/" +
                  String(key).split("/").map(encodeURIComponent).join("/"),
              );
          }
        } catch (fallbackError) {
          console.warn("R2 chapter page fallback skipped:", fallbackError);
        }
      }

      if (pages.length || attempt === PAGE_FETCH_ATTEMPTS) return pages;
    } else {
      lastError = error;
      if (attempt === PAGE_FETCH_ATTEMPTS) throw error;
    }

    await sleep(PAGE_FETCH_DELAY_MS * attempt);
  }

  if (lastError) throw lastError;
  return [];
}
