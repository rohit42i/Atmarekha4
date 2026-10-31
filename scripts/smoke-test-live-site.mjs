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
  "/chapter/2",
  "/chapter/special/intro-282d54fd",
];

function siteUrl(input) {
  const candidate = new URL(String(input), ROOT);
  // The only intentional HTTP request verifies the apex www host's redirect.
  if (candidate.href === "http://www.atmarekha.in/") return candidate.href;
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

const XML_ENTITIES = Object.freeze({
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
});

function decodeXml(value) {
  // Decode exactly one XML entity layer. A single regex pass prevents an
  // input such as "&amp;lt;" from being decoded twice into "<".
  return String(value).replace(/&(amp|lt|gt|quot|apos);/g, entity => XML_ENTITIES[entity]);
}

function readJpegDimensions(bytes) {
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Open Graph image is not a valid JPEG stream.");
  }

  let offset = 2;
  while (offset < bytes.length - 4) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;

    // Standalone markers have no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 1 >= bytes.length) break;

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw new Error("Open Graph JPEG contains a malformed segment.");
    }
    if (sofMarkers.has(marker)) {
      if (segmentLength < 7) throw new Error("Open Graph JPEG SOF segment is malformed.");
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error("Unable to read Open Graph JPEG dimensions.");
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
assert.equal(homepage.headers.get("strict-transport-security"), "max-age=15552000", "Homepage HSTS header must match the six-month Worker policy.");
assert.equal(homepage.headers.get("x-content-type-options"), "nosniff", "Homepage nosniff header missing.");
const html = await homepage.text();

// Verify the actual social preview image is publicly retrievable, lightweight,
// JPEG encoded, and exactly 1200 x 630. Metadata alone does not prove it works.
const shareImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
assert.ok(shareImageMatch, "Homepage is missing its Open Graph share image.");
assert.equal(shareImageMatch[1], "https://www.atmarekha.in/og-atmarekha.jpg?v=20261031-share2", "Homepage must declare the current cache-busted social preview.");
const shareImage = await assertOk(shareImageMatch[1], "Open Graph share image");
assert.match(shareImage.headers.get("content-type") || "", /^image\/jpeg(?:;|$)/i, "Open Graph image must return image/jpeg.");
const shareImageBytes = Buffer.from(await shareImage.arrayBuffer());
assert.ok(shareImageBytes.byteLength > 0, "Open Graph share image is empty.");
assert.ok(shareImageBytes.byteLength <= 600 * 1024, "Open Graph share image exceeds the 600 KiB preview target.");
assert.deepEqual(readJpegDimensions(shareImageBytes), { width: 1200, height: 630 }, "Open Graph JPEG must be 1200 x 630 pixels.");

// Count same-origin shell assets and reject absolute resource URLs pointing
// away from the production host. Assets are not fetched based on response data.
const assetRefs = new Set();
for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
  const raw = match[1].trim();
  if (!raw || raw.startsWith("#") || /^(?:data:|blob:|mailto:|tel:|javascript:)/i.test(raw)) continue;
  let url;
  try { url = new URL(raw, ROOT); } catch { continue; }
  if (/^(?:https?:)?\/\//i.test(raw)) {
    // Google Fonts is an intentional stylesheet/font dependency. Other page-shell
    // resources and absolute links must stay on the canonical site origin.
    const allowedStaticOrigins = new Set([
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ]);
    assert.ok(
      url.origin === ROOT_URL.origin || allowedStaticOrigins.has(url.origin),
      "Page shell contains an unapproved cross-origin link or asset: " + raw,
    );
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
assert.ok(sitemapPaths.has("/chapter/1"), "Published Chapter 1 must be present in the sitemap.");
assert.ok(sitemapPaths.has("/chapter/2"), "Published Chapter 2 must be present in the sitemap.");

console.log("Live site smoke test passed: HTTPS redirect, homepage security headers, " +
  PUBLIC_ROUTES.length + " fixed public routes, " + sitemapPaths.size +
  " HTTPS same-origin sitemap URLs, and " + assetRefs.size + " same-origin shell assets.");
