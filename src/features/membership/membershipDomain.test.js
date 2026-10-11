import assert from "node:assert/strict";
import test from "node:test";
import { selectEffectiveMemberships } from "./membershipDomain.js";

const now = Date.parse("2026-10-11T00:00:00.000Z");

test("selects the highest active plan when a user has multiple rows", () => {
  const result = selectEffectiveMemberships(
    [
      { user_id: "reader-1", plan_id: "premium", status: "active", current_period_end: "2026-11-01T00:00:00Z" },
      { user_id: "reader-1", plan_id: "mini_member", status: "active", current_period_end: "2027-01-01T00:00:00Z" },
      { user_id: "reader-2", plan_id: "supporter", status: "active", current_period_end: null },
    ],
    now,
  );

  assert.equal(result.get("reader-1"), "premium");
  assert.equal(result.get("reader-2"), "supporter");
});

test("excludes expired, malformed, and unsupported statuses", () => {
  const result = selectEffectiveMemberships(
    [
      { user_id: "expired", plan_id: "premium", status: "active", current_period_end: "2026-01-01T00:00:00Z" },
      { user_id: "invalid", plan_id: "supporter", status: "active", current_period_end: "not-a-date" },
      { user_id: "pending", plan_id: "supporter", status: "pending", current_period_end: "2027-01-01T00:00:00Z" },
    ],
    now,
  );

  assert.equal(result.size, 0);
});

test("preserves cancelled access until the paid period ends", () => {
  const result = selectEffectiveMemberships(
    [
      { user_id: "reader", plan_id: "supporter", status: "cancelled", current_period_end: "2026-12-01T00:00:00Z" },
      { user_id: "former", plan_id: "premium", status: "cancelled", current_period_end: "2026-10-10T00:00:00Z" },
    ],
    now,
  );

  assert.equal(result.get("reader"), "supporter");
  assert.equal(result.has("former"), false);
});

test("is deterministic for duplicate plans and does not mutate input", () => {
  const rows = [
    { user_id: "reader", plan_id: "supporter", status: "cancelled", current_period_end: "2026-12-01T00:00:00Z" },
    { user_id: "reader", plan_id: "supporter", status: "active", current_period_end: "2026-11-01T00:00:00Z" },
  ];
  const snapshot = structuredClone(rows);

  const result = selectEffectiveMemberships(rows, now);

  assert.equal(result.get("reader"), "supporter");
  assert.deepEqual(rows, snapshot);
});

test("ignores records missing identifiers", () => {
  assert.equal(
    selectEffectiveMemberships([{ user_id: "reader" }, { plan_id: "premium" }], now).size,
    0,
  );
});
