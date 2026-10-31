import assert from "node:assert/strict";
import worker from "../worker.js";

const previousFetch = globalThis.fetch;
const previousCaches = globalThis.caches;
const chapterLookupRequests = [];
const cacheStore = new Map();
const chapterRows = [
  { id: "chapter-hi-1", chapter_number: 1, title: "The Forgotten Dream", language: "hi", status: "Published", cover_url: "https://www.atmarekha.in/ishani.png", release_date: "2026-09-14T00:00:00Z" },
  { id: "chapter-en-1", chapter_number: 1, title: "The Forgotten Dream", language: "en", status: "Published", cover_url: "https://tiny-pond-c959.rohitbaswaraj.workers.dev/storage/v1/object/public/covers/chapters/private-cover.png", release_date: "2026-09-14T00:00:00Z" },
  { id: "chapter-hi-2", chapter_number: 2, title: "But what", language: "hi", status: "Published", release_date: "2026-10-14T04:45:00Z" },
  { id: "282d54fd-c4c1-4bb6-976c-156921e16071", chapter_number: null, title: "Intro", language: "hi", status: "Published", release_date: "2026-09-07T00:00:00Z" },
  { id: "draft-2", chapter_number: 2, title: "Unreleased", language: "hi", status: "draft", release_date: "2026-10-01T00:00:00Z" },
];
globalThis.caches = {
  default: {
    async match(request) {
      const hit = cacheStore.get(request.url);
      return hit ? hit.clone() : undefined;
    },
    async put(request, response) {
      cacheStore.set(request.url, response.clone());
    },
  },
};
globalThis.fetch = async request => {
  chapterLookupRequests.push(new URL(request.url || request));
  return new Response(JSON.stringify(chapterRows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const shell = `<!doctype html><html lang="en"><head>
  <title>Atma Rekha</title>
  <meta name="description" content="Old description" />
  <meta property="og:title" content="Old title" />
  <link rel="canonical" href="https://www.atmarekha.in/" />
  <link rel="alternate" hreflang="en-IN" href="https://www.atmarekha.in/" />
  <script type="application/ld+json" id="atma-rekha-site-schema">{"@context":"https://schema.org","@type":"WebSite","name":"Atma Rekha"}</script>
</head><body><div id="root"></div></body></html>`;
const env = {
  ASSETS: {
    async fetch() {
      return new Response(shell, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    },
  },
};

try {
  const sitemapResponse = await worker.fetch(new Request("https://www.atmarekha.in/sitemap.xml"), env);
  const sitemapXml = await sitemapResponse.text();
  assert.equal(sitemapResponse.status, 200);
  assert.ok((sitemapResponse.headers.get("content-type") || "").includes("application/xml"));
  for (const path of ["/", "/chapters", "/chapters?lang=en", "/chapter/1", "/chapter/1?lang=en", "/chapter/2", "/chapter/special/intro-282d54fd", "/pal-do-pal-ke-lamhe", "/info/about", "/info/terms", "/info/privacy", "/info/contact", "/info/report"]) {
    assert.ok(sitemapXml.includes("<loc>https://www.atmarekha.in" + path + "</loc>"), "Sitemap is missing public URL: " + path);
  }
  assert.ok(sitemapXml.includes('hreflang="en-IN"') && sitemapXml.includes('hreflang="hi-Latn-IN"'), "Published chapter language alternates are missing.");
  assert.ok(!sitemapXml.includes("Unreleased") && !sitemapXml.includes("draft-2"), "Unpublished chapters must not appear in the sitemap.");
  assert.ok(!sitemapXml.includes("storage/") && !sitemapXml.includes("<image:image>"), "Sitemap must not expose storage or image URLs.");
  assert.ok(!sitemapXml.includes("\\\\n"), "Sitemap XML must use real line breaks rather than escaped backslash sequences.");
  assert.match(sitemapResponse.headers.get("cache-control") || "", /max-age=300/);
  assert.ok(chapterLookupRequests.length > 0, "Sitemap lookup should fetch chapter records.");
  assert.equal(chapterLookupRequests[0].searchParams.get("status"), "ilike.published", "Published chapter lookup must be case-insensitive for the stored Published status.");

  const home = await worker.fetch(new Request("https://www.atmarekha.in/"), env);
  const homeHtml = await home.text();
  assert.equal(home.status, 200);
  assert.ok(homeHtml.includes('<title>Atma Rekha | Original Indian Fantasy Adventure Manga</title>'), "Homepage HTML title is outdated.");
  assert.ok(homeHtml.includes('name="description" content="Atma Rekha is an original Indian fantasy adventure manga by Arkesh Kaalvantik, available in Roman Hindi and English."'), "Homepage description is outdated.");
  assert.ok(homeHtml.includes('property="og:title" content="Atma Rekha | Original Indian Fantasy Adventure Manga"'), "Homepage Open Graph title is outdated.");
  assert.ok(homeHtml.includes('property="og:description" content="Atma Rekha is an original Indian fantasy adventure manga by Arkesh Kaalvantik, available in Roman Hindi and English."'), "Homepage Open Graph description is outdated.");
  assert.ok(homeHtml.includes('name="twitter:title" content="Atma Rekha | Original Indian Fantasy Adventure Manga"'), "Homepage Twitter title is outdated.");
  assert.ok(homeHtml.includes('property="og:image" content="https://www.atmarekha.in/og-atmarekha.jpg?v=20261031-share2"'), "Homepage share image URL is missing the optimized cache-busted JPEG.");
  assert.ok(homeHtml.includes('name="author" content="Arkesh Kaalvantik"'), "Homepage creator metadata is inconsistent.");

  assert.match(homeHtml, /<noscript><main class="seo-no-script-content">/);
  assert.ok(homeHtml.includes("Arnav") && homeHtml.includes("Ishani"), "No-script homepage content should include the confirmed story characters.");
  assert.ok(homeHtml.includes("href=\"/chapter/1\""), "No-script homepage should expose a crawlable published chapter link.");
  assert.match(homeHtml, /<meta property="og:url" content="https:\/\/www\.atmarekha\.in\/" \/>/);

  const chapterList = await worker.fetch(new Request("https://www.atmarekha.in/chapters"), env);
  const chapterListHtml = await chapterList.text();
  assert.match(chapterListHtml, /<title>Atma Rekha \| Chapter List<\/title>/);
  assert.ok(chapterListHtml.includes("href=\"/chapter/1\"") && chapterListHtml.includes("href=\"/chapter/2\"") && chapterListHtml.includes("href=\"/chapter/special/intro-282d54fd\""), "No-script chapter list should expose published chapter links.");
  assert.ok(!chapterListHtml.includes("Unreleased"), "No-script chapter list must not expose unpublished chapter titles.");

  const chapterTwo = await worker.fetch(new Request("https://www.atmarekha.in/chapter/2"), env);
  const chapterTwoHtml = await chapterTwo.text();
  assert.equal(chapterTwo.status, 200);
  assert.match(chapterTwoHtml, /<title>Atma Rekha \| But what<\/title>/);

  const intro = await worker.fetch(new Request("https://www.atmarekha.in/chapter/special/intro-282d54fd"), env);
  const introHtml = await intro.text();
  assert.equal(intro.status, 200);
  assert.match(introHtml, /"@type":"ComicIssue"/);
  assert.match(introHtml, /inLanguage":"hi-Latn-IN"/);
  assert.match(introHtml, /rel="canonical" href="https:\/\/www\.atmarekha\.in\/chapter\/special\/intro-282d54fd"/);

  const about = await worker.fetch(new Request("https://www.atmarekha.in/info/about"), env);
  const aboutHtml = await about.text();
  assert.equal(about.status, 200);
  assert.match(aboutHtml, /<title>Atma Rekha \| About the Creator<\/title>/);
  assert.ok(aboutHtml.includes("Meet Arkesh Kaalvantik, the independent creator of Atma Rekha, an original fantasy adventure manga published in Roman Hindi and English."), "About description is missing or incorrect.");
  assert.match(aboutHtml, /rel="canonical" href="https:\/\/www\.atmarekha\.in\/info\/about"/);
  assert.ok(aboutHtml.includes('property="og:image" content="https://www.atmarekha.in/og-atmarekha.jpg?v=20261031-share2"'), "About page does not use the optimized JPEG share image.");
  assert.ok(aboutHtml.includes('property="og:image:secure_url" content="https://www.atmarekha.in/og-atmarekha.jpg?v=20261031-share2"'), "About page secure share image URL is incorrect.");
  assert.match(aboutHtml, /property="og:image:type" content="image\/jpeg"/);
  assert.match(aboutHtml, /property="og:image:width" content="1200"/);
  assert.match(aboutHtml, /property="og:image:height" content="630"/);
  assert.match(aboutHtml, /name="twitter:card" content="summary_large_image"/);
  assert.match(aboutHtml, /property="og:title" content="Atma Rekha \\| About the Creator"/);
  assert.equal(about.headers.get("x-content-type-options"), "nosniff");
  assert.equal(about.headers.get("strict-transport-security"), "max-age=15552000");

  const chaptersEnglish = await worker.fetch(new Request("https://www.atmarekha.in/chapters?lang=en"), env);
  const chaptersEnglishHtml = await chaptersEnglish.text();
  assert.match(chaptersEnglishHtml, /rel="canonical" href="https:\/\/www\.atmarekha\.in\/chapters\?lang=en"/);
  assert.match(chaptersEnglishHtml, /hreflang="hi-Latn-IN"/);
  assert.match(chaptersEnglishHtml, /hreflang="en-IN"/);

  const privatePage = await worker.fetch(new Request("https://www.atmarekha.in/membership"), env);
  const privateHtml = await privatePage.text();
  assert.match(privateHtml, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.equal(privatePage.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(privatePage.headers.get("cdn-cache-control"), null);

  for (const path of ["/admin", "/login", "/signup", "/profile", "/bookmarks", "/membership", "/community", "/group-chat", "/privacy-center"]) {
    const response = await worker.fetch(new Request("https://www.atmarekha.in" + path), env);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive", "Private route must be noindex: " + path);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0", "Private route must not be publicly cached: " + path);
  }

  const unknown = await worker.fetch(new Request("https://www.atmarekha.in/not-a-real-route"), env);
  const unknownHtml = await unknown.text();
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.match(unknownHtml, /name="robots" content="noindex,nofollow,noarchive"/);

  const chapterHindi = await worker.fetch(new Request("https://www.atmarekha.in/chapter/1"), env);
  const chapterHindiHtml = await chapterHindi.text();
  assert.match(chapterHindiHtml, /<title>Atma Rekha \| The Forgotten Dream<\/title>/);
  assert.match(chapterHindiHtml, /property="og:title" content="Atma Rekha \| The Forgotten Dream"/);
  assert.match(chapterHindiHtml, /property="og:image" content="https:\/\/www\.atmarekha\.in\/ishani\.png"/);
  assert.match(chapterHindiHtml, /property="og:image:secure_url" content="https:\/\/www\.atmarekha\.in\/ishani\.png"/);
  assert.doesNotMatch(chapterHindiHtml, /property="og:image:type"/);
  assert.match(chapterHindiHtml, /name="twitter:image" content="https:\/\/www\.atmarekha\.in\/ishani\.png"/);
  assert.match(chapterHindiHtml, /rel="canonical" href="https:\/\/www\.atmarekha\.in\/chapter\/1"/);
  assert.match(chapterHindiHtml, /"@type":"ComicIssue"/);
  assert.match(chapterHindiHtml, /"@type":"BreadcrumbList"/);
  assert.match(chapterHindiHtml, /hreflang="en-IN"/);
  assert.ok(chapterLookupRequests.every(request => request.searchParams.get("status") === "ilike.published"), "Every chapter lookup must use the case-insensitive published status filter.");

  const chapterEnglish = await worker.fetch(new Request("https://www.atmarekha.in/chapter/1?lang=en"), env);
  const chapterEnglishHtml = await chapterEnglish.text();
  assert.match(chapterEnglishHtml, /rel="canonical" href="https:\/\/www\.atmarekha\.in\/chapter\/1\?lang=en"/);

  const largeChapterRows = Array.from({ length: 501 }, (_, index) => ({
    id: "pagination-" + (index + 1),
    chapter_number: index + 1,
    title: "Paginated chapter " + (index + 1),
    language: "hi",
    status: "published",
    release_date: "2026-09-14T00:00:00Z",
  }));
  const paginationOffsets = [];
  cacheStore.clear();
  globalThis.fetch = async request => {
    const endpoint = new URL(request.url || request);
    const offset = Number(endpoint.searchParams.get("offset") || 0);
    const limit = Number(endpoint.searchParams.get("limit") || 500);
    paginationOffsets.push(offset);
    return new Response(JSON.stringify(largeChapterRows.slice(offset, offset + limit)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const paginatedSitemapResponse = await worker.fetch(new Request("https://www.atmarekha.in/sitemap.xml"), env);
  const paginatedSitemapXml = await paginatedSitemapResponse.text();
  assert.equal(paginatedSitemapResponse.status, 200);
  assert.ok(paginatedSitemapXml.includes("<loc>https://www.atmarekha.in/chapter/501</loc>"), "Sitemap must include chapters after the first 500 records.");
  assert.deepEqual(paginationOffsets, [0, 500], "Worker must fetch published chapters in 500-record pages.");

  const redirect = await worker.fetch(new Request("http://atmarekha.in/chapters?lang=en"), env);
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), "https://www.atmarekha.in/chapters?lang=en");

  console.log("Worker SEO/security route tests passed.");
} finally {
  globalThis.fetch = previousFetch;
  if (previousCaches === undefined) delete globalThis.caches;
  else globalThis.caches = previousCaches;
}
