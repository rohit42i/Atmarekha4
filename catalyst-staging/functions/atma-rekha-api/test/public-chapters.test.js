'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toPublicChapter, toPublicChapters } = require('../lib/public-chapters');

const published = {
  chapters: {
    id: '9b2f2d4a-4b8b-4c9a-9d91-000000000114',
    chapter_number: '1',
    title: 'First chapter',
    description: null,
    cover_url: 'https://example.invalid/cover.webp',
    source_status: 'published',
    release_date: '2026-10-14T00:00:00.000Z',
    manga_id: null,
    lang_code: 'hi',
    card_thumbnail_desktop_url: null,
    card_thumbnail_mobile_url: null,
    chapter_list_thumb_desktop_url: 'https://example.invalid/thumbnail.webp',
    chapter_list_thumb_mobile_url: null,
    deleted_at: null,
    private_note: 'must never escape the public mapper',
  },
};

test('maps target aliases back to the public chapter contract without leaking columns', () => {
  const actual = toPublicChapter(published);
  assert.equal(actual.status, 'published');
  assert.equal(actual.language, 'hi');
  assert.equal(actual.chapter_list_thumbnail_desktop_url, 'https://example.invalid/thumbnail.webp');
  assert.equal(actual.chapter_number, 1);
  assert.equal(Object.hasOwn(actual, 'private_note'), false);
  assert.equal(Object.hasOwn(actual, 'source_status'), false);
  assert.equal(Object.hasOwn(actual, 'deleted_at'), false);
});

test('does not expose drafts, deleted rows, or invalid application IDs', () => {
  assert.equal(toPublicChapter({ chapters: { ...published.chapters, source_status: 'draft' } }), null);
  assert.equal(toPublicChapter({ chapters: { ...published.chapters, deleted_at: '2026-10-15T00:00:00Z' } }), null);
  assert.equal(toPublicChapter({ chapters: { ...published.chapters, id: 'target-row-id-only' } }), null);
  assert.equal(toPublicChapter({ chapters: { ...published.chapters, chapter_number: 'not-a-number' } }), null);
});

test('sorts, filters and bounds the list in application code as a second guard', () => {
  const draft = { chapters: { ...published.chapters, id: '9b2f2d4a-4b8b-4c9a-9d91-000000000115', chapter_number: 2, source_status: 'draft' } };
  const second = { chapters: { ...published.chapters, id: '9b2f2d4a-4b8b-4c9a-9d91-000000000116', chapter_number: 3, title: 'Third' } };
  const result = toPublicChapters([second, draft, published]);
  assert.deepEqual(result.map(row => row.chapter_number), [1, 3]);
  assert.equal(toPublicChapters(null).length, 0);
});
