import assert from "node:assert/strict";
import test from "node:test";
import { encodePath, normalizeAtmaR2Path } from "./r2Domain.js";

const chapterId = "12345678-1234-1234-1234-123456789abc";

test("encodes each object path segment independently", () => {
  assert.equal(
    encodePath("chapter pages/page 1.webp"),
    "chapter%20pages/page%201.webp",
  );
});

test("normalizes legacy chapter-page upload paths into canonical keys", () => {
  const legacy = \`chapters/\${chapterId}/pages/en-1700000000/page 1.webp\`;
  const expected = \`chapter-pages/\${chapterId}/1700000000/page 1.webp\`;
  const canonical = normalizeAtmaR2Path("chapter-pages", legacy);

  assert.equal(canonical, expected);
  assert.equal(normalizeAtmaR2Path("chapter-pages", canonical), expected);
  assert.equal(normalizeAtmaR2Path("chapter-pages", \`\${chapterId}/1700000000/page 1.webp\`), expected);
  assert.equal(
    normalizeAtmaR2Path("chapter-pages", \`chapter-pages/\${legacy}\`),
    expected,
  );
});

test("retains bucket namespaces for cover and community media", () => {
  assert.equal(
    normalizeAtmaR2Path("covers", "/covers/chapters/cover.webp"),
    "covers/chapters/cover.webp",
  );
  assert.equal(
    normalizeAtmaR2Path("covers", "chapters/cover.webp"),
    "covers/chapters/cover.webp",
  );
  assert.equal(
    normalizeAtmaR2Path("community", "community/avatar.png"),
    "community/avatar.png",
  );
  assert.equal(
    normalizeAtmaR2Path("community", "avatar.png"),
    "community/avatar.png",
  );
});

test("leaves unrecognized legacy keys stable instead of guessing", () => {
  const key = \`chapters/\${chapterId}/pages/cover/page.webp\`;
  assert.equal(normalizeAtmaR2Path("chapter-pages", key), key);
});

test("keeps legacy replacement objects outside the chapter-pages namespace", () => {
  const key = \`\${chapterId}/replacements/page.webp\`;
  assert.equal(normalizeAtmaR2Path("chapter-pages", key), key);
});

test("prefixes the correct namespace without rewriting another bucket's path", () => {
  const key = \`chapters/\${chapterId}/pages/chapter-3/page.webp\`;
  assert.equal(
    normalizeAtmaR2Path("covers", key),
    \`covers/\${key}\`,
  );
});
