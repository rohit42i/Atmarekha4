import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SITE_ORIGIN = "https://www.atmarekha.in";
const HOST = new URL(SITE_ORIGIN).host;
const KEY = (await readFile("public/8214847b9e39b5498b945d0c807195de.txt", "utf8")).trim();
const SITEMAP = await readFile("public/sitemap.xml", "utf8");

assert.match(KEY, /^[a-f0-9]{32}$/, "IndexNow key file must contain a 32-character hexadecimal key.");

function decodeXml(value) {
  return String(value).replace(/&(amp|lt|gt|quot|apos);/g, entity => ({
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
  })[entity]);
}

const urls = [...SITEMAP.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
  .map(match => decodeXml(match[1].trim()))
  .filter(Boolean);

assert.ok(urls.length > 0, "The production sitemap must contain at least one URL.");
assert.ok(urls.length <= 10000, "IndexNow accepts at most 10,000 URLs per request.");

for (const value of urls) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:", "Only HTTPS URLs may be submitted.");
  assert.equal(url.host, HOST, "Only canonical Atma Rekha host URLs may be submitted.");
  assert.ok(!/^\/(?:admin|profile|membership|group-chat|community|privacy-center|maintenance|403|430|503)(?:\/|$)/i.test(url.pathname),
    "Private and utility routes must never be submitted to IndexNow.");
}

const keyLocation = SITE_ORIGIN + "/" + KEY + ".txt";
const keyResponse = await fetch(keyLocation, { headers: { Accept: "text/plain" } });
assert.equal(keyResponse.status, 200, "The public IndexNow key file must be live before URL submission.");
assert.equal((await keyResponse.text()).trim(), KEY, "The live IndexNow key file must match the submission key.");

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation, urlList: urls }),
});

if (!response.ok) {
  const detail = (await response.text()).slice(0, 1000);
  throw new Error("IndexNow submission failed with HTTP " + response.status + ": " + detail);
}

console.log("IndexNow accepted " + urls.length + " canonical public URLs for " + HOST + ".");
