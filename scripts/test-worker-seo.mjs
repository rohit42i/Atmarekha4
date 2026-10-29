import assert from "node:assert/strict";
import worker from "../worker.js";

const previousFetch = globalThis.fetch;
const previousCaches = globalThis.caches;
const cacheStore = new Map();
const chapterRows = [
  { id: "chapter-hi-1", chapter_number: 1, title: "The Forgotten Dream", language: "hi", status: "published", cover_url: "https://www.atmarekha.in/ishani.png", release_date: "2026-09-14T00:00:00Z" },
  { id: "chapter-en-1", chapter_number: 1, title: "The Forgotten Dream", language: "en", status: "published", cover_url: "https://www.atmarekha.in/ishani.png", release_date: "2026-09-14T00:00:00Z" },
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
globalThis.fetch = async () => new Response(JSON.stringify(chapterRows), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

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
  const home = await worker.fetch(new Request("https://www.atmarekha.in/"), env);
  const homeHtml = await home.text();
  assert.equal(home.status, 200);
  assert.match(homeHtml, /<title>Atma Rekha \\| Indian Fantasy Adventure Manga<\\/title>/);
  assert.ok(homeHtml.includes('name="description" content="Read Atma Rekha, an original Indian fantasy adventure manga by Arkesh Kaalvantik, in Hindi (Roman Hindi) and English."'), "Homepage description is outdated.");
  assert.ok(homeHtml.includes('property="og:title" content="Atma Rekha | Indian Fantasy Adventure Manga"'), "Homepage Open Graph title is outdated.");
  assert.ok(homeHtml.includes('property="og:description" content="Read Atma Rekha, an original Indian fantasy adventure manga by Arkesh Kaalvantik, in Hindi (Roman Hindi) and English."'), "Homepage Open Graph description is outdated.");
  assert.ok(homeHtml.includes('name="twitter:title" content="Atma Rekha | Indian Fantasy Adventure Manga"'), "Homepage Twitter title is outdated.");
  assert.ok(homeHtml.includes('property="og:image" content="https://www.atmarekha.in/ishani.png?v=20261029"'), "Homepage share image URL is missing the cache-busting version.");
  assert.ok(homeHtml.includes('name="author" content="Arkesh Kaalvantik"'), "Homepage creator metadata is inconsistent.");

  const about = await worker.fetch(new Request("https://www.atmarekha.in/info/about"), env);
  const aboutHtml = await about.text();
  assert.equal(about.status, 200);
  assert.match(aboutHtml, /<title>About Atma Rekha \| Indian Fantasy Manga and Creator<\/title>/);
  assert.ok(aboutHtml.includes("Learn about Atma Rekha, an original Indian fantasy adventure manga by Arkesh Kaalvantik, published in Hindi (Roman Hindi) and English."), "About description is missing or incorrect.");
  assert.match(aboutHtml, /rel="canonical" href="https:\/\/www\.atmarekha\.in\/info\/about"/);
  assert.match(aboutHtml, /property="og:image" content="https:\/\/www\.atmarekha\.in\/ishani\.png\?v=20261029"/);
  assert.match(aboutHtml, /property="og:image:secure_url" content="https:\/\/www\.atmarekha\.in\/ishani\.png\?v=20261029"/);
  assert.match(aboutHtml, /property="og:image:type" content="image\/png"/);
  assert.match(aboutHtml, /name="twitter:card" content="summary_large_image"/);
  assert.match(aboutHtml, /property="og:title" content="About Atma Rekha \| Indian Fantasy Manga and Creator"/);
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

  const unknown = await worker.fetch(new Request("https://www.atmarekha.in/not-a-real-route"), env);
  const unknownHtml = await unknown.text();
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.match(unknownHtml, /name="robots" content="noindex,nofollow,noarchive"/);

  const chapterHindi = await worker.fetch(new Request("https://www.atmarekha.in/chapter/1"), env);
  const chapterHindiHtml = await chapterHindi.text();
  assert.match(chapterHindiHtml, /<title>The Forgotten Dream \| Atma Rekha<\/title>/);
  assert.match(chapterHindiHtml, /property="og:title" content="The Forgotten Dream \| Atma Rekha"/);
  assert.match(chapterHindiHtml, /property="og:image" content="https:\/\/www\.atmarekha\.in\/ishani\.png"/);
  assert.match(chapterHindiHtml, /property="og:image:secure_url" content="https:\/\/www\.atmarekha\.in\/ishani\.png"/);
  assert.doesNotMatch(chapterHindiHtml, /property="og:image:type"/);
  assert.match(chapterHindiHtml, /name="twitter:image" content="https:\/\/www\.atmarekha\.in\/ishani\.png"/);
  assert.match(chapterHindiHtml, /rel="canonical" href="https:\/\/www\.atmarekha\.in\/chapter\/1"/);
  assert.match(chapterHindiHtml, /"@type":"ComicStory"/);
  assert.match(chapterHindiHtml, /"@type":"BreadcrumbList"/);
  assert.match(chapterHindiHtml, /hreflang="en-IN"/);

  const chapterEnglish = await worker.fetch(new Request("https://www.atmarekha.in/chapter/1?lang=en"), env);
  const chapterEnglishHtml = await chapterEnglish.text();
  assert.match(chapterEnglishHtml, /rel="canonical" href="https:\/\/www\.atmarekha\.in\/chapter\/1\?lang=en"/);

  const redirect = await worker.fetch(new Request("http://atmarekha.in/chapters?lang=en"), env);
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), "https://www.atmarekha.in/chapters?lang=en");

  console.log("Worker SEO/security route tests passed.");
} finally {
  globalThis.fetch = previousFetch;
  if (previousCaches === undefined) delete globalThis.caches;
  else globalThis.caches = previousCaches;
}
