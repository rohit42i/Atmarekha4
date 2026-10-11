import assert from "node:assert/strict";
import test from "node:test";
import { normalizePdlplPublicSummary } from "./engagementDomain.js";

test("normalizes an empty aggregate without NaN values", () => {
  assert.deepEqual(normalizePdlplPublicSummary(), {
    rating: { average: 0, count: 0 },
    views: 0,
    likes: 0,
    comments: 0,
    pages: 0,
    shares: 0,
  });
});

test("maps aggregate counters and calculates average rating", () => {
  assert.deepEqual(
    normalizePdlplPublicSummary({
      ratings_count: "4",
      ratings_sum: "32",
      views_count: "120",
      likes_count: 9,
      comments_count: 7,
      pages_count: 24,
      shares_count: 3,
    }),
    {
      rating: { average: 8, count: 4 },
      views: 120,
      likes: 9,
      comments: 7,
      pages: 24,
      shares: 3,
    },
  );
});

test("defaults invalid counters to zero", () => {
  const summary = normalizePdlplPublicSummary({
    ratings_count: "many",
    ratings_sum: "unknown",
    views_count: Number.NaN,
  });
  assert.equal(summary.rating.average, 0);
  assert.equal(summary.rating.count, 0);
  assert.equal(summary.views, 0);
});
