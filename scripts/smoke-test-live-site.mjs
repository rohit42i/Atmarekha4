import assert from "node:assert/strict";

const ROOT = "https://www.atmarekha.in/";
const ROOT_URL = new URL(ROOT);
const SITE_HOST = ROOT_URL.host;
const TIMEOUT_MS = 12000;
const RETRIES = 4;

// These routes are reviewed constants. Never request a destination taken from
// website response content; remote page data is treated as untrusted.
const PUBLIC_ROUTES = [
  "/",
  "/chapters",
  "/chapters?lang=en",
  "/info/about",
  "/info/contact",
  "/info/report",
  "/info/privacy",
  "/info/terms",
  "/pal-do-pal-ke-lamhe",
  "/privacy-center",
  "/chapter/1",
];

function siteUrl(input) {
  const candidate = new URL(String(input), ROOT);
  if (candidate.origin !== ROOT_URL.origin) {
    throw new Error("Refusing to request a URL outside the Atma Rekha site origin.");
  }
  // Reconstruct the request from the fixed production origin and validated path.
  return new URL(candidate.pathname + candidate.search, ROOT).href;
}

async function fetchWithRetry(input, options = {}) {
  const url = siteUrl(input);
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

// Count same-origin shell assets and reject absolute resource URLs pointing
// away from the production host. Assets are not fetched based on response data.
const assetRefs = new Set();
for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
  const raw = match[1].trim();
  if (!raw || raw.startsWith("#") || /^(?:data:|blob:|mailto:|tel:|javascript:)/i.test(raw)) continue;
  let url;
  try { url = new URL(raw, ROOT); } catch { continue; }
  if (/^(?:https?:)?\/\//i.test(raw)) {
    assert.equal(url.origin, ROOT_URL.origin, "Page shell contains a cross-origin absolute link or asset: " + raw);
  }
  if (url.origin === ROOT_URL.origin && /\.(?:js|mjs|css|png|jpe?g|svg|webp|ico|woff2?)(?:$|[?#])/i.test(url.pathname + url.search + url.hash)) {
    assetRefs.add(url.pathname + url.search);
  }
}
assert.ok(assetRefs.size > 0, "No same-origin script/style/image assets were found in the homepage shell.");

for (const route of PUBLIC_ROUTES) {
  const response = await assertOk(new URL(route, ROOT).href, "Public route " + route);
  assert.equal(response.status, 200, "Public route must return HTTP 200: " + route);
  assert.match(response.headers.get("content-type") || "", /text\/html/i, "Public route must return HTML: " + route);
  await response.body?.cancel().catch(() => {});
}

const sitemapResponse = await assertOk(new URL("/sitemap.xml", ROOT).href, "Sitemap");
assert.match(sitemapResponse.headers.get("content-type") || "", /xml|text\/plain/i, "Sitemap response must be XML or plain text.");
const sitemap = await sitemapResponse.text();
assert.match(sitemap, /<urlset\b/i, "Sitemap is missing the urlset root.");
const listedUrls = [...sitemap.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
  .map(match => decodeXml(match[1].trim()))
  .filter(Boolean);
assert.ok(listedUrls.length > 0, "Sitemap contains no URLs.");
assert.ok(listedUrls.length <= 1000, "Sitemap contains an unexpected number of URLs; review pagination.");

const sitemapPaths = new Set();
for (const value of listedUrls) {
  const url = new URL(value, ROOT);
  assert.equal(url.protocol, "https:", "Sitemap URL must use HTTPS: " + value);
  assert.equal(url.origin, ROOT_URL.origin, "Sitemap URL uses an unexpected hostname: " + value);
  assert.equal(url.username, "", "Sitemap URL must not contain user credentials: " + value);
  assert.equal(url.password, "", "Sitemap URL must not contain user credentials: " + value);
  sitemapPaths.add(url.pathname + url.search);
}

console.log("Live site smoke test passed: HTTPS redirect, homepage security headers, " +
  PUBLIC_ROUTES.length + " fixed public routes, " + sitemapPaths.size +
  " HTTPS same-origin sitemap URLs, and " + assetRefs.size + " same-origin shell assets.");
