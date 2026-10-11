import assert from "node:assert/strict";
import test from "node:test";
import {
  extractUtmParameters,
  mergeAttribution,
} from "./attributionDomain.js";

test("persists only recognized bounded UTM values", () => {
  const params = new URLSearchParams(
    "utm_source=newsletter&utm_campaign=launch&utm_secret=ignored&utm_term=" + "a".repeat(240),
  );
  const result = extractUtmParameters(params);

  assert.deepEqual(Object.keys(result).sort(), ["utm_campaign", "utm_source", "utm_term"]);
  assert.equal(result.utm_source, "newsletter");
  assert.equal(result.utm_campaign, "launch");
  assert.equal(result.utm_term.length, 200);
  assert.equal("utm_secret" in result, false);
});

test("keeps original first-touch data and updates last touch", () => {
  const previous = {
    first_touch: { utm_source: "first" },
    last_touch: { utm_source: "old-last" },
    captured_at: "2026-01-01T00:00:00.000Z",
  };
  const result = mergeAttribution(previous, { utm_source: "new" }, new Date("2026-10-01T00:00:00Z"));

  assert.deepEqual(result.first_touch, { utm_source: "first" });
  assert.deepEqual(result.last_touch, { utm_source: "new" });
  assert.equal(result.captured_at, "2026-01-01T00:00:00.000Z");
});

test("sets first and last touch and timestamp for the first visit", () => {
  const result = mergeAttribution({}, { utm_medium: "social" }, new Date("2026-10-01T00:00:00Z"));

  assert.deepEqual(result.first_touch, { utm_medium: "social" });
  assert.deepEqual(result.last_touch, { utm_medium: "social" });
  assert.equal(result.captured_at, "2026-10-01T00:00:00.000Z");
});

test("ignores malformed previous first-touch data", () => {
  const result = mergeAttribution(
    { first_touch: ["invalid"], captured_at: 42 },
    { utm_source: "campaign" },
    new Date("2026-10-01T00:00:00Z"),
  );

  assert.deepEqual(result.first_touch, { utm_source: "campaign" });
  assert.equal(result.captured_at, "2026-10-01T00:00:00.000Z");
});
