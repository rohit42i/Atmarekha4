import assert from "node:assert/strict";
import test from "node:test";
import {
  chapterLanguageLabel,
  formatChapterEyebrow,
  formatChapterLabel,
  normalizeChapterLanguage,
  sortChapters,
} from "./chapterDomain.js";

test("normalizes supported languages and safely defaults to Hindi", () => {
  assert.equal(normalizeChapterLanguage(" EN "), "en");
  assert.equal(normalizeChapterLanguage("hi"), "hi");
  assert.equal(normalizeChapterLanguage(null), "hi");
  assert.equal(chapterLanguageLabel("en"), "English");
  assert.equal(chapterLanguageLabel("unknown"), "Hindi");
});

test("formats numbered chapters and special chapters", () => {
  assert.equal(formatChapterLabel("3"), "Chapter 3");
  assert.equal(formatChapterLabel(null), "Special");
  assert.equal(formatChapterLabel(null, { short: true, title: "  Intro  " }), "Intro");
  assert.equal(formatChapterLabel(null, { short: false, title: "Intro" }), "Special");
});

test("formats accessible chapter labels and bounds special titles", () => {
  assert.equal(formatChapterEyebrow(8), "CHAPTER 8");
  assert.equal(formatChapterEyebrow(null), "SPECIAL");
  assert.equal(formatChapterEyebrow(null, "  quiet beginning "), "QUIET BEGINNING");
  assert.equal(formatChapterEyebrow(null, "a".repeat(50)).length, 40);
});

test("sorts chapter numbers numerically ahead of special chapters", () => {
  const chapters = [
    { id: "special", createdAt: "2024-01-01T00:00:00Z", chapterNumber: null },
    { id: "chapter-10", chapterNumber: 10 },
    { id: "chapter-2", chapterNumber: 2 },
  ];

  assert.deepEqual(
    sortChapters(chapters).map((chapter) => chapter.id),
    ["chapter-2", "chapter-10", "special"],
  );
});

test("sorts special chapters chronologically with a stable ID tie-breaker", () => {
  const chapters = [
    { id: "z", chapterNumber: null, createdAt: "2025-01-01T00:00:00Z" },
    { id: "b", chapterNumber: null, createdAt: "2024-01-01T00:00:00Z" },
    { id: "a", chapterNumber: null, createdAt: "2024-01-01T00:00:00Z" },
  ];

  assert.deepEqual(
    sortChapters(chapters).map((chapter) => chapter.id),
    ["a", "b", "z"],
  );
});

test("sorts without mutating the caller's array", () => {
  const chapters = [
    { id: "2", chapterNumber: 2 },
    { id: "1", chapterNumber: 1 },
  ];
  const original = [...chapters];

  sortChapters(chapters);

  assert.deepEqual(chapters, original);
});
