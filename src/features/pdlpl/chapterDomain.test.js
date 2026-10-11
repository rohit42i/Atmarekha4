import assert from "node:assert/strict";
import test from "node:test";
import {
  isPdlplMemberPlan,
  mapPdlplChapter,
  published,
} from "./chapterDomain.js";

test("recognizes published chapters case-insensitively", () => {
  assert.equal(published({ status: "published" }), true);
  assert.equal(published({ status: " Published " }), true);
  assert.equal(published({ status: "draft" }), false);
  assert.equal(published(null), false);
});

test("maps database rows into stable reader view models", () => {
  const chapter = mapPdlplChapter({
    id: "chapter-id",
    chapter_number: 3,
    title: "A quiet moment",
    description: null,
    cover_path: "covers/chapters/cover one.webp",
    card_thumbnail_desktop_path: "covers/desktop.webp",
    card_thumbnail_mobile_path: null,
    language: "EN",
    status: "published",
    release_date: "2026-10-01",
    created_at: "2026-09-01",
  });

  assert.equal(chapter.id, "chapter-id");
  assert.equal(chapter.chapterNumber, 3);
  assert.equal(chapter.description, "");
  assert.equal(chapter.language, "en");
  assert.equal(chapter.status, "published");
  assert.equal(chapter.coverPath, "covers/chapters/cover one.webp");
  assert.equal(chapter.cover.includes("cover%20one.webp"), true);
  assert.equal(chapter.cardThumbnailDesktop.includes("desktop.webp"), true);
  assert.equal(chapter.cardThumbnailMobile, null);
});

test("defaults unsupported chapter languages to Hindi", () => {
  assert.equal(mapPdlplChapter({ id: "x", language: "fr" }).language, "hi");
  assert.equal(mapPdlplChapter({ id: "x" }).language, "hi");
});

test("PdPL access requires a supporter or premium plan", () => {
  assert.equal(isPdlplMemberPlan("supporter"), true);
  assert.equal(isPdlplMemberPlan(" PREMIUM "), true);
  assert.equal(isPdlplMemberPlan("mini_member"), false);
  assert.equal(isPdlplMemberPlan("free"), false);
  assert.equal(isPdlplMemberPlan(null), false);
});
