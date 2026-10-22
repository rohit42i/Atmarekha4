import assert from "node:assert/strict";

const ROOT = "https://www.atmarekha.in/";
const SITE_HOST = new URL(ROOT).host;
const TIMEOUT_MS = 12000;
const RETRIES = 4;

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status >= 500 && attempt < RETRIES) {
        await response.arrayBuffer().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1200 * attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await new Promise(resolve => setTimeout(resolve, 1200 * attempt));
    }
  }
  throw new Error("Request failed after retries: " + url + " (" + (lastError?.message || "unknown error") + ")");
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function assertOk(url, label) {
  const response = await fetchWithRetry(url, { redirect: "follow" });
  assert.ok(response.status >= 200 && response.status < 400, label + " returned HTTP " + response.status + ": " + url);
  return response;
}

// The public hostname must be HTTPS-only and serve the deployed application.
const http = await fetchWithRetry("http://www.atmarekha.in/", { redirect: "manual" });
assert.ok(http.status >= 300 && http.status < 400, "HTTP homepage must redirect to HTTPS; got " + http.status);
const redirectLocation = http.headers.get("location");
assert.ok(redirectLocation, "HTTP homepage redirect must include Location.");
assert.equal(new URL(redirectLocation, "http://www.atmarekha.in/").protocol, "https:", "HTTP homepage redirect must be HTTPS.");

const homepage = await assertOk(ROOT, "HTTPS homepage");
assert.equal(homepage.status, 200, "HTTPS homepage must return 200.");
assert.match(homepage.headers.get("content-type") || "", /text\/html/i, "Homepage must return HTML.");
assert.equal(homepage.headers.get("strict-transport-security"), "max-age=15552000", "Homepage HSTS header mismatch.");
assert.equal(homepage.headers.get("x-content-type-options"), "nosniff", "Homepage nosniff header missing.");
const html = await homepage.text();

// Validate the same-origin script/style/image targets in the HTML shell.
const assetRefs = new Set();
for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
  const raw = match[1].trim();
  if (!raw || raw.startsWith("#") || /^(?:data:|blob:|mailto:|tel:|javascript:)/i.test(raw)) continue;
  let url;
  try { url = new URL(raw, ROOT); } catch { continue; }
  if (url.host === SITE_HOST && /\.(?:js|mjs|css|png|jpe?g|svg|webp|ico|woff2?)(?:$|[?#])/i.test(url.pathname + url.search + url.hash)) {
    assetRefs.add(url.href);
  }
}
for (const asset of assetRefs) await assertOk(asset, "Same-origin page asset");

const sitemapResponse = await assertOk(new URL("/sitemap.xml", ROOT).href, "Sitemap");
assert.match(sitemapResponse.headers.get("content-type") || "", /xml|text\/plain/i, "Sitemap response must be XML or plain text.");
const sitemap = await sitemapResponse.text();
assert.match(sitemap, /<urlset\b/i, "Sitemap is missing the urlset root.");
const listedUrls = [...sitemap.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
  .map(match => decodeXml(match[1].trim()))
  .filter(Boolean);
assert.ok(listedUrls.length > 0, "Sitemap contains no URLs.");
assert.ok(listedUrls.length <= 1000, "Sitemap contains an unexpected number of URLs; review pagination.");

const urlsToCheck = [...new Set(listedUrls.map(value => new URL(value, ROOT).href))];
for (const url of urlsToCheck) {
  assert.equal(new URL(url).host, SITE_HOST, "Sitemap URL uses an unexpected hostname: " + url);
}

let cursor = 0;
const failures = [];
const concurrency = Math.min(6, urlsToCheck.length);
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < urlsToCheck.length) {
    const index = cursor++;
    const url = urlsToCheck[index];
    try {
      const response = await fetchWithRetry(url, { redirect: "follow" });
      if (response.status < 200 || response.status >= 400) {
        failures.push(url + " returned HTTP " + response.status);
      }
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      failures.push(url + " failed: " + (error?.message || "unknown error"));
    }
  }
}));
assert.deepEqual(failures, [], "One or more sitemap URLs failed:\n" + failures.join("\n"));
console.log("Live site smoke test passed: HTTPS redirect, homepage security headers, " +
  urlsToCheck.length + " sitemap URLs, and " + assetRefs.size + " same-origin assets.");
