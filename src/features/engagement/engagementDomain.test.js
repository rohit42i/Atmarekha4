import assert from "node:assert/strict";
import test from "node:test";
import { buildRatingSummary } from "./engagementDomain.js";

test("returns an empty summary when no ratings exist", () => {
  assert.deepEqual(buildRatingSummary(), { average: 0, count: 0 });
  assert.deepEqual(buildRatingSummary(null), { average: 0, count: 0 });
});

test("averages numeric and numeric-string ratings", () => {
  assert.deepEqual(
    buildRatingSummary([{ rating: 8 }, { rating: "6" }, { rating: 10 }]),
    { average: 8, count: 3 },
  );
});

test("ignores non-finite ratings without corrupting the average", () => {
  assert.deepEqual(
    buildRatingSummary([
      { rating: 8 },
      { rating: Number.NaN },
      { rating: Number.POSITIVE_INFINITY },
      { rating: "not a rating" },
      {},
    ]),
    { average: 8, count: 1 },
  );
});

test("does not mutate the provided rows", () => {
  const rows = [{ rating: 7 }, { rating: 9 }];
  const snapshot = structuredClone(rows);

  buildRatingSummary(rows);

  assert.deepEqual(rows, snapshot);
});
