import assert from "node:assert/strict";
import test from "node:test";
import { PDLPL_MEDIA_WORKER_URL, getPdlplMediaUrl } from "./pdlplMediaDomain.js";

test("uses the dedicated configured Worker URL", () => {
  assert.equal(PDLPL_MEDIA_WORKER_URL, "https://pdlpl-media.rohitbaswaraj.workers.dev");
});

test("returns empty for missing paths", () => {
  assert.equal(getPdlplMediaUrl(""), "");
  assert.equal(getPdlplMediaUrl(null), "");
  assert.equal(getPdlplMediaUrl(" /// "), "");
});

test("encodes object path segments without flattening directories", () => {
  assert.equal(
    getPdlplMediaUrl("/chapter pages/cover one.webp", "https://media.example/"),
    "https://media.example/media/chapter%20pages/cover%20one.webp",
  );
});

test("rejects a missing Worker endpoint when explicitly overridden", () => {
  assert.throws(() => getPdlplMediaUrl("cover.webp", ""), /not configured/);
});
