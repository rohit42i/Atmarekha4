import assert from "node:assert/strict";
import test from "node:test";
import {
  SITE_ORIGIN,
  chapterCanonicalUrl,
  chapterLanguageUrl,
  chapterPath,
  findChapterForPath,
  isChapterPath,
  legacyChapterIdFromHash,
} from "./routeService.js";

const chapters = [
  { id: "chapter-two-hi", chapterNumber: 2, language: "hi", title: "Dhoop" },
  { id: "chapter-two-en", chapterNumber: 2, language: "en", title: "Sunlight" },
  { id: "special-12345678", chapterNumber: null, language: "hi", title: "First Dream" },
  { id: "special-en-12345678", chapterNumber: null, language: "en", title: "First Dream" },
];

test("builds stable language-aware chapter URLs", () => {
  assert.equal(chapterPath(chapters[0]), "/chapter/2");
  assert.equal(chapterPath(chapters[1]), "/chapter/2?lang=en");
  assert.equal(
    chapterPath(chapters[2]),
    "/chapter/special/first-dream-special",
  );
});

test("returns a chapters fallback for invalid chapter objects", () => {
  assert.equal(chapterPath(null), "/chapters");
  assert.equal(chapterPath({ id: "x", chapterNumber: "not-a-number" }), "/chapter/special/special-x");
});

test("recognizes only supported chapter route patterns", () => {
  assert.equal(isChapterPath("/chapter/3"), true);
  assert.equal(isChapterPath("/chapter/3.5"), true);
  assert.equal(isChapterPath("/chapter/special/intro"), true);
  assert.equal(isChapterPath("/chapter/nope"), false);
  assert.equal(isChapterPath("/admin"), false);
});

test("resolves numbered chapter by requested language then Hindi fallback", () => {
  assert.equal(findChapterForPath("/chapter/2?lang=en", chapters)?.id, "chapter-two-en");
  assert.equal(findChapterForPath("/chapter/2?lang=unknown", chapters)?.id, "chapter-two-hi");
  assert.equal(findChapterForPath("/chapter/4", chapters), null);
});

test("resolves special chapters using slug and short ID suffix", () => {
  assert.equal(
    findChapterForPath("/chapter/special/first-dream-12345678", chapters)?.id,
    "special-12345678",
  );
  assert.equal(
    findChapterForPath("/chapter/special/first-dream-special-en-12345678?lang=en", chapters)?.id,
    "special-en-12345678",
  );
});

test("builds canonical and alternate language URLs", () => {
  assert.equal(SITE_ORIGIN, "https://www.atmarekha.in");
  assert.equal(chapterCanonicalUrl(chapters[0]), "https://www.atmarekha.in/chapter/2");
  assert.equal(
    chapterLanguageUrl(chapters[0], "en"),
    "https://www.atmarekha.in/chapter/2?lang=en",
  );
  assert.equal(chapterLanguageUrl({}, "en"), "https://www.atmarekha.in/chapters");
});

test("parses supported legacy chapter hashes safely", () => {
  assert.equal(legacyChapterIdFromHash("#read-chapter/abc-123"), "abc-123");
  assert.equal(legacyChapterIdFromHash("#read-chapter/abc%20123"), "abc 123");
  assert.equal(legacyChapterIdFromHash("#home"), null);
});
