import assert from "node:assert/strict";
import test from "node:test";
import { InputValidationError, normalizeEmail, normalizePlainText } from "./input.js";

test("normalizes Unicode and line endings while removing null bytes", () => {
  assert.equal(normalizePlainText("  Ａtma\r\nRekha\u0000  "), "Atma\nRekha");
});

test("can normalize single-line values", () => {
  assert.equal(
    normalizePlainText("  first\n\tsecond  ", { allowNewlines: false }),
    "first second",
  );
});

test("does not silently truncate oversized input", () => {
  assert.throws(
    () => normalizePlainText("12345", { maxLength: 4, label: "Comment" }),
    (error) =>
      error instanceof InputValidationError &&
      error.message === "Comment is limited to 4 characters.",
  );
});

test("rejects required blank input", () => {
  assert.throws(
    () => normalizePlainText(" \n ", { required: true }),
    /Text is required\./,
  );
});

test("normalizes valid email addresses", () => {
  assert.equal(normalizeEmail("  Reader@Example.COM "), "reader@example.com");
});

test("rejects malformed email addresses", () => {
  assert.throws(() => normalizeEmail("reader.example.com"), /valid email/);
  assert.throws(() => normalizeEmail("reader@example.com\nadmin"), /valid email/);
});
