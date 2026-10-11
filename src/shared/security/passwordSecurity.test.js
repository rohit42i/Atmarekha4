import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  findPasswordBreachCount,
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
} from "./passwordSecurity.js";

test("requires a minimum password length before any network request", async () => {
  await assert.rejects(validateNewPassword("short"), /at least 8 characters/);
});

test("parses breach counts from the k-anonymity range body", () => {
  assert.equal(findPasswordBreachCount("ABC:1\nDEF:12", "ABC".padEnd(35, "A")), 0);
  const suffix = "A".repeat(35);
  assert.equal(findPasswordBreachCount(`OTHER:1\n${suffix}:4\nEND:2`, suffix), 4);
  assert.equal(findPasswordBreachCount(`${suffix}:0`, suffix), 0);
  assert.equal(findPasswordBreachCount(`${suffix}:nope`, suffix), 0);
  assert.equal(findPasswordBreachCount(`${suffix}:4`, "invalid"), 0);
});

test("sends only the five-character digest prefix and rejects breached passwords", async () => {
  const password = "UniqueTestPassword#2026";
  const digest = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = async (input, options) => {
    requestedUrl = String(input);
    assert.equal(options.method, "GET");
    assert.equal(options.cache, "no-store");
    assert.equal(options.referrerPolicy, "no-referrer");
    return new Response(`${suffix}:3\nOTHER:1`, { status: 200 });
  };

  try {
    await assert.rejects(validateNewPassword(password), /appeared in known data breaches/);
    assert.equal(requestedUrl, `https://api.pwnedpasswords.com/range/${prefix}`);
    assert.equal(requestedUrl.includes(password), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("fails closed when the breach-check service is unavailable", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("private endpoint details");
  };

  try {
    await assert.rejects(
      validateNewPassword("ThisIsANewPassword#2026"),
      /could not complete the password security check/,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("returns success when the range response does not contain the suffix", async () => {
  const password = "AnotherNewPassword#2026";
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("DEADBEEF:1", { status: 200 });
  try {
    assert.deepEqual(await validateNewPassword(password), { compromised: false });
  } finally {
    globalThis.fetch = previousFetch;
  }
});
