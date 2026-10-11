import assert from "node:assert/strict";
import test from "node:test";
import {
  clearDraft,
  loadDraft,
  passwordScore,
  passwordStrength,
  rememberDraft,
  validateEmail,
} from "./formUX.js";

const originalWindow = globalThis.window;

function withWindow(windowValue, run) {
  globalThis.window = windowValue;
  try {
    return run();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
}

test("validates email using the shared normalizer", () => {
  assert.deepEqual(validateEmail(""), {
    ok: false,
    message: "Email is required.",
  });
  assert.deepEqual(validateEmail("invalid-email"), {
    ok: false,
    message: "Enter a valid email address.",
  });
  assert.deepEqual(validateEmail("Reader@example.com"), {
    ok: true,
    message: "Email looks good.",
  });
});

test("scores password length and character variety", () => {
  assert.equal(passwordScore("abc"), 1);
  assert.equal(passwordStrength("").label, "Enter a password");
  assert.equal(passwordStrength("abc").label, "Weak");
  assert.equal(passwordStrength("Reader123!Strong").label, "Very strong");
});

test("draft helpers degrade gracefully when browser storage is unavailable", () => {
  assert.equal(
    withWindow(undefined, () => rememberDraft("draft", { text: "hello" })),
    false,
  );
  assert.deepEqual(
    withWindow(undefined, () => loadDraft("draft", { fallback: true })),
    { fallback: true },
  );
  assert.equal(
    withWindow(undefined, () => clearDraft("draft")),
    false,
  );
});

test("round-trips non-sensitive drafts through browser storage", () => {
  const values = new Map();
  const storage = {
    setItem(key, value) {
      values.set(key, String(value));
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
  };

  withWindow({ localStorage: storage }, () => {
    assert.equal(rememberDraft("chapter-note", { text: "line one" }), true);
    assert.deepEqual(loadDraft("chapter-note", null), { text: "line one" });
    assert.equal(clearDraft("chapter-note"), true);
    assert.equal(loadDraft("chapter-note", null), null);
  });
});

test("returns fallback for malformed or primitive stored values", () => {
  const storage = {
    getItem() {
      return "42";
    },
    setItem() {},
    removeItem() {},
  };
  withWindow({ localStorage: storage }, () => {
    assert.equal(loadDraft("draft", "fallback"), "fallback");
  });
});
