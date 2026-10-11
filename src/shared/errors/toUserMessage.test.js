import assert from "node:assert/strict";
import test from "node:test";
import { toUserMessage } from "./toUserMessage.js";

test("keeps concise validation messages", () => {
  assert.equal(
    toUserMessage(new Error("Write a comment first.")),
    "Write a comment first.",
  );
});

test("maps known authentication error codes", () => {
  assert.equal(
    toUserMessage({ code: "AUTH_REQUIRED", message: "internal details" }),
    "Please sign in to continue.",
  );
});

test("hides infrastructure details", () => {
  assert.equal(
    toUserMessage(new Error("SQLSTATE 42501 at https://internal.example")),
    "Something went wrong. Please try again.",
  );
});

test("gives a friendly timeout message", () => {
  assert.equal(
    toUserMessage({ name: "TimeoutError" }),
    "The request timed out. Please try again.",
  );
});
