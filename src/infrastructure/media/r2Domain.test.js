import assert from "node:assert/strict";
import test from "node:test";
import { encodePath, normalizeAtmaR2Path } from "./r2Domain.js";

const chapterId = "12345678-1234-1234-1234-123456789abc";

test("encodes each object path segment independently", () => {
  assert.equal(encodePath("chapter pages/page 1.webp"), "chapter%20pages/page%201.webp");
});

test("normalizes legacy chapter-page upload paths into canonical keys", () => {
  assert.equal(
    normalizeAtmaR2Path(
      "chapter-pages",
      `chapters/${chapterId}/pages/chapter-3/page 1.webp`,
    ),
    `chapter-pages/${chapterId}/3/page%201.webp`.replace(/%20/g, " "),
  );
});

test("removes an optional bucket prefix for other media buckets", () => {
  assert.equal(normalizeAtmaR2Path("covers", "/covers/cover.webp"), "cover.webp");
  assert.equal(normalizeAtmaR2Path("community", "community/avatar.png"), "avatar.png");
});

test("leaves unrecognized legacy keys stable instead of guessing", () => {
  const key = `chapters/${chapterId}/pages/cover/page.webp`;
  assert.equal(normalizeAtmaR2Path("chapter-pages", key), key);
});

test("does not normalize chapter paths as non-chapter buckets", () => {
  const key = `chapters/${chapterId}/pages/chapter-3/page.webp`;
  assert.equal(normalizeAtmaR2Path("covers", key), key);
});
