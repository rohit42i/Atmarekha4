const SITE_ORIGIN = "https://www.atmarekha.in";
const DEFAULT_SHARE_IMAGE = SITE_ORIGIN + "/og-atmarekha.jpg?v=20261031-share2";
const SUPABASE_URL = "https://pbukwjokgkqacaphlqzm.supabase.co";
const PUBLIC_SUPABASE_KEY = "sb_publishable_g0VUtYwOVwHcfRoY3zD9FA_seUEV61E";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=15552000",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://checkout.razorpay.com 'sha256-5zLsbxu6OpCHh7Nldl3+MyHkpY40u0abU8XOzScRPGU='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://tiny-pond-c959.rohitbaswaraj.workers.dev https://pdlpl-media.rohitbaswaraj.workers.dev https://*.supabase.co https://*.razorpay.com; connect-src 'self' https://pbukwjokgkqacaphlqzm.supabase.co wss://pbukwjokgkqacaphlqzm.supabase.co https://tiny-pond-c959.rohitbaswaraj.workers.dev https://pdlpl-media.rohitbaswaraj.workers.dev https://atma-rekha-analytics.rohitbaswaraj.workers.dev https://api.razorpay.com https://api.pwnedpasswords.com; frame-src 'self' https://checkout.razorpay.com https://*.razorpay.com; font-src 'self' data: https://fonts.gstatic.com; worker-src 'self' blob:; media-src 'self' blob:; manifest-src 'self'",
};

const STATIC_SEO = {
  "/": ["Atma Rekha | Fantasy Adventure Comic", "Explore Atma Rekha, a fantasy adventure comic where missing memories and mysterious powers lead to a larger mystery."],
  "/chapters": ["Atma Rekha | Chapter List", "Browse Atma Rekha chapters in Hindi written in Roman script and English. Read the fantasy adventure comic by Arkesh Kaalvantik."],
  "/info/about": ["Atma Rekha | About the Creator", "Meet Arkesh Kaalvantik, the creator of Atma Rekha, a fantasy adventure comic published in Roman Hindi and English."],
  "/info/contact": ["Atma Rekha | Contact", "Contact the creator of Atma Rekha for reader support, publication enquiries, or website feedback."],
  "/info/report": ["Atma Rekha | Report a Problem", "Report a website issue, content concern, or accessibility problem to the Atma Rekha team."],
  "/info/privacy": ["Atma Rekha | Privacy Policy", "Learn how Atma Rekha handles account, reading, community, membership, email, analytics, security, and payment information."],
  "/info/terms": ["Atma Rekha | Terms of Use", "Read the terms for Atma Rekha accounts, comic access, community features, memberships, payments, and moderation."],
  "/pal-do-pal-ke-lamhe": ["Pal Do Pal Ke Lamhe | Atma Rekha", "Read about Pal Do Pal Ke Lamhe, a separate school-life story from the creator of Atma Rekha."],
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function setMeta(html, attribute, key, value) {
  const replacement = '<meta ' + attribute + '="' + escapeHtml(key) + '" content="' + escapeHtml(value) + '" />';
  const pattern = new RegExp('<meta\\s+[^>]*' + attribute + '="' + key + '"[^>]*>', "i");
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", "  " + replacement + "\n</head>");
}

function setTitle(html, title) {
  const tag = "<title>" + escapeHtml(title) + "</title>";
  return /<title>[\s\S]*?<\/title>/i.test(html) ? html.replace(/<title>[\s\S]*?<\/title>/i, tag) : html.replace("</head>", "  " + tag + "\n</head>");
}

function setCanonical(html, url) {
  const tag = '<link rel="canonical" href="' + escapeHtml(url) + '" />';
  const pattern = /<link[^>]*rel="canonical"[^>]*>/i;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", "  " + tag + "\n</head>");
}

function setAlternates(html, alternates) {
  html = html.replace(/<link[^>]*rel="alternate"[^>]*hreflang="[^"]*"[^>]*\/?>(?:\s*)/gi, "");
  const tags = alternates.map(item => '<link rel="alternate" hreflang="' + escapeHtml(item.language) + '" href="' + escapeHtml(item.url) + '" />').join("\n  ");
  const pattern = /<link[^>]*rel="canonical"[^>]*>/i;
  return pattern.test(html) ? html.replace(pattern, match => match + "\n  " + tags) : html.replace("</head>", "  " + tags + "\n</head>");
}

function privatePath(path) {
  return /^\/(?:admin|profile|membership|group-chat|community|login|signup|bookmarks|account|maintenance|403|430|503)(?:\/|$)/i.test(path) || path === "/privacy-center";
}

function knownPath(path) {
  if (path === "/" || path === "/chapters" || path === "/privacy-center" || path === "/pal-do-pal-ke-lamhe") return true;
  if (/^\/info\/(?:about|contact|report|privacy|terms)$/.test(path)) return true;
  if (/^\/chapter\/\d+(?:\.\d+)?$/.test(path) || /^\/chapter\/special\/[^/]+$/.test(path)) return true;
  return false;
}

function normalizeLanguage(value) {
  return String(value || "").trim().toLowerCase() === "en" ? "en" : "hi";
}

function slugify(value) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function shortId(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
}

function chapterPath(chapter) {
  const number = chapter.chapter_number;
  let path;
  if (number !== null && number !== undefined && String(number).trim() !== "") path = "/chapter/" + encodeURIComponent(String(number).trim());
  else {
    const suffix = shortId(chapter.id);
    const slug = slugify(chapter.title) || "special";
    path = "/chapter/special/" + encodeURIComponent(suffix ? slug + "-" + suffix : slug);
  }
  return normalizeLanguage(chapter.language) === "en" ? path + "?lang=en" : path;
}

async function loadPublishedChapters(env) {
  const base = String(env.SUPABASE_URL || SUPABASE_URL).replace(/\/+$/, "");
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || PUBLIC_SUPABASE_KEY);
  const pageSize = 500;
  const chapters = [];

  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL(base + "/rest/v1/chapters");
    endpoint.searchParams.set("select", "id,chapter_number,title,language,status,cover_url,release_date,created_at,deleted_at");
    endpoint.searchParams.set("status", "ilike.published");
    endpoint.searchParams.set("deleted_at", "is.null");
    endpoint.searchParams.set("order", "chapter_number.asc.nullsfirst,created_at.asc,id.asc");
    endpoint.searchParams.set("limit", String(pageSize));
    endpoint.searchParams.set("offset", String(offset));
    const cacheKey = new Request(endpoint.toString(), { method: "GET" });
    let page = null;

    try {
      const cached = await caches.default.match(cacheKey);
      if (cached) page = await cached.json();
    } catch (_) {}

    if (!Array.isArray(page)) {
      const response = await fetch(endpoint, {
        headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) throw new Error("Published chapter lookup failed.");
      page = await response.json();
      if (!Array.isArray(page)) throw new Error("Invalid published chapter response.");
      try {
        await caches.default.put(cacheKey, new Response(JSON.stringify(page), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } }));
      } catch (_) {}
    }

    chapters.push(...page.filter(row =>
      String(row.status || "").trim().toLowerCase() === "published" && !row.deleted_at
    ));
    if (page.length < pageSize) break;
  }

  return chapters;
}

function findChapter(path, url, chapters) {
  const numbered = path.match(/^\/chapter\/(\d+(?:\.\d+)?)$/);
  const special = path.match(/^\/chapter\/special\/([^/]+)$/);
  const language = normalizeLanguage(url.searchParams.get("lang"));
  let matches = [];
  if (numbered) {
    matches = chapters.filter(item => item.chapter_number != null && String(item.chapter_number).trim() === numbered[1]);
  } else if (special) {
    let requested = special[1];
    try { requested = decodeURIComponent(requested); } catch (_) {}
    matches = chapters.filter(item => {
      const id = String(item.id || "");
      const suffix = shortId(id);
      const expected = (slugify(item.title) || "special") + (suffix ? "-" + suffix : "");
      return requested === expected || requested === id || Boolean(suffix && requested.endsWith("-" + suffix));
    });
  }
  return matches.find(item => normalizeLanguage(item.language) === language)
    || matches.find(item => normalizeLanguage(item.language) === "hi")
    || matches[0]
    || null;
}

function safeCover(value) {
  const fallback = SITE_ORIGIN + "/ishani.png";
  try {
    const image = new URL(String(value || ""), SITE_ORIGIN);
    return image.protocol === "https:" ? image.href : fallback;
  } catch (_) {
    return fallback;
  }
}

function addJsonLd(html, nodes) {
  const pattern = /<script[^>]*id="atma-rekha-site-schema"[^>]*>([\s\S]*?)<\/script>/i;
  const match = html.match(pattern);
  let base = null;
  try { if (match) base = JSON.parse(match[1]); } catch (_) {}
  if (!base) base = { "@context": "https://schema.org", "@type": "WebSite", "@id": SITE_ORIGIN + "/#website", name: "Atma Rekha", url: SITE_ORIGIN + "/", creator: { "@type": "Person", name: "Arkesh Kaalvantik" } };
  const graph = Array.isArray(base["@graph"]) ? base["@graph"] : [base];
  graph.push(...nodes);
  const script = '<script type="application/ld+json" id="atma-rekha-site-schema">' + JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") + "</script>";
  return match ? html.replace(pattern, script) : html.replace("</head>", "  " + script + "\n</head>");
}

function seoTitle(value, fallback) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const safeFallback = String(fallback || "Atma Rekha | Official Comic").trim();
  if (!text) return safeFallback.slice(0, 59);
  if (text.length <= 59) return text;
  const clipped = text.slice(0, 56).replace(/\s+\S*$/, "").trim();
  return (clipped || safeFallback.slice(0, 56)) + "...";
}

function buildNoScriptFallback(path, url, chapters) {
  const rows = Array.isArray(chapters) ? chapters.filter(row => String(row.status || "").toLowerCase() === "published") : [];
  const language = normalizeLanguage(url.searchParams.get("lang"));
  const localized = rows.filter(row => normalizeLanguage(row.language) === language);
  const link = (href, label) => '<li><a href="' + escapeHtml(href) + '">' + escapeHtml(label) + '</a></li>';
  const chapterLinks = (items, limit) => items.slice(-limit).reverse().map(row => {
    const number = row.chapter_number == null || String(row.chapter_number).trim() === "" ? "Special" : "Chapter " + row.chapter_number;
    const label = number + (row.title ? ": " + row.title : "");
    return link(chapterPath(row), label + " (" + (normalizeLanguage(row.language) === "en" ? "English" : "Hindi, Roman script") + ")");
  }).join("");
  const nav = '<nav aria-label="Official Atma Rekha pages"><ul>' +
    link("/", "Atma Rekha homepage") + link("/chapters", "Chapter list") +
    link("/info/about", "About the creator") + link("/info/contact", "Contact") +
    link("/pal-do-pal-ke-lamhe", "Pal Do Pal Ke Lamhe") + '</ul></nav>';
  let body = "";
  if (path === "/") {
    body = '<h1>Atma Rekha</h1>' +
      '<p>Atma Rekha is a fantasy adventure comic created and written by Arkesh Kaalvantik. Its world draws inspiration from Indian culture and traditions. It is published in Hindi written in Roman script and in English.</p>' +
      '<p>The story follows Arnav, an eighteen-year-old student whose missing childhood memories and encounters with unusual powers lead him into a larger mystery. Arnav and Ishani are among the story’s named characters.</p>' +
      '<h2>Published chapters</h2><ul>' + chapterLinks(rows, 6) + '</ul>';
  } else if (path === "/chapters") {
    body = '<h1>Atma Rekha chapter list</h1>' +
      '<p>Browse published chapters in ' + (language === "en" ? "English" : "Hindi written in Roman script") + '. The official comic is created by Arkesh Kaalvantik.</p>' +
      '<ul>' + chapterLinks(localized, localized.length) + '</ul>';
  } else if (path === "/info/about") {
    body = '<h1>About Atma Rekha and its creator</h1>' +
      '<p>Arkesh Kaalvantik is the creator and author of Atma Rekha, a fantasy adventure comic available in Hindi written in Roman script and English.</p>' +
      '<p>The project idea dates to 21 March 2025. Development began on 25 April 2025. The public introduction chapter is dated 7 September 2026, and Chapter 1 was published on 14 September 2026. New chapters are planned for the 14th of each month.</p>' +
      '<p>Contact: <a href="mailto:atmarekhasupport@gmail.com">atmarekhasupport@gmail.com</a>.</p>';
  } else if (/^\/chapter\/(?:\d+(?:\.\d+)?|special\/[^/]+)$/.test(path)) {
    const chapter = findChapter(path, url, rows);
    if (chapter) {
      const title = String(chapter.title || (chapter.chapter_number == null ? "Special chapter" : "Chapter " + chapter.chapter_number));
      const languageName = normalizeLanguage(chapter.language) === "en" ? "English" : "Hindi written in Roman script";
      body = '<h1>' + escapeHtml(title) + ' | Atma Rekha</h1>' +
        '<p>This published Atma Rekha chapter is available in ' + languageName + '. The series is created by Arkesh Kaalvantik.</p>' +
        '<p><a href="' + escapeHtml(chapterPath(chapter)) + '">Open ' + escapeHtml(title) + '</a></p>';
    }
  }
  if (!body) return "";
  return '<noscript><main class="seo-no-script-content">' + body + nav + '</main></noscript>';
}

async function addServerSeo(request, response, env) {
  const url = new URL(request.url);
  const path = url.pathname === "/" ? "/" : "/" + url.pathname.replace(/^\/+|\/+$/g, "");
  const headers = new Headers(response.headers);
  const isPrivate = privatePath(path);
  const isKnown = knownPath(path);
  let chapterResolved = null;

  if (!isKnown && response.status === 200 && (headers.get("Content-Type") || "").toLowerCase().includes("text/html")) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response = new Response(response.body, { status: 404, statusText: "Not Found", headers });
  }
  if (isPrivate) headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  const contentType = headers.get("Content-Type") || "";
  if (request.method !== "GET" || !contentType.toLowerCase().includes("text/html")) {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  let html;
  try { html = await response.text(); } catch (_) { return response; }

  if (isPrivate || !isKnown) {
    html = setMeta(html, "name", "robots", "noindex,nofollow,noarchive");
    html = setAlternates(html, []);
  }

  if (path === "/" || STATIC_SEO[path]) {
    if (STATIC_SEO[path]) {
      html = setTitle(html, STATIC_SEO[path][0]);
      html = setMeta(html, "name", "description", STATIC_SEO[path][1]);
    }
    const canonical = path === "/chapters" && normalizeLanguage(url.searchParams.get("lang")) === "en"
      ? SITE_ORIGIN + "/chapters?lang=en"
      : SITE_ORIGIN + path;
    const chapterListSeo = path === "/chapters" && normalizeLanguage(url.searchParams.get("lang")) === "en"
      ? ["Atma Rekha | English Chapters", "Browse published Atma Rekha chapters in English. Read the fantasy adventure comic by Arkesh Kaalvantik."]
      : STATIC_SEO[path];
    const shareTitle = seoTitle(chapterListSeo?.[0] || "Atma Rekha | Fantasy Adventure Comic", "Atma Rekha | Official Comic");
    const shareDescription = chapterListSeo?.[1] || "Explore Atma Rekha, a fantasy adventure comic where missing memories and mysterious powers lead to a larger mystery.";
    html = setMeta(html, "property", "og:type", "website");
    html = setMeta(html, "property", "og:site_name", "Atma Rekha");
    html = setTitle(html, shareTitle);
    html = setMeta(html, "name", "description", shareDescription);
    html = setMeta(html, "name", "author", "Arkesh Kaalvantik");
    html = setMeta(html, "property", "og:title", shareTitle);
    html = setMeta(html, "property", "og:description", shareDescription);
    html = setMeta(html, "property", "og:url", canonical);
    html = setMeta(html, "property", "og:image", DEFAULT_SHARE_IMAGE);
    html = setMeta(html, "property", "og:image:secure_url", DEFAULT_SHARE_IMAGE);
    html = setMeta(html, "property", "og:image:type", "image/jpeg");
    html = setMeta(html, "property", "og:image:width", "1200");
    html = setMeta(html, "property", "og:image:height", "630");
    html = setMeta(html, "property", "og:image:alt", "Atma Rekha character artwork");
    html = setMeta(html, "name", "twitter:card", "summary_large_image");
    html = setMeta(html, "name", "twitter:title", shareTitle);
    html = setMeta(html, "name", "twitter:description", shareDescription);
    html = setMeta(html, "name", "twitter:image", DEFAULT_SHARE_IMAGE);
    html = setMeta(html, "name", "twitter:image:alt", "Atma Rekha character artwork");
    html = setCanonical(html, canonical);
    if (path === "/chapters") {
      html = setAlternates(html, [
        { language: "en-IN", url: SITE_ORIGIN + "/chapters?lang=en" },
        { language: "hi-Latn-IN", url: SITE_ORIGIN + "/chapters" },
        { language: "x-default", url: SITE_ORIGIN + "/chapters" },
      ]);
    } else if (path === "/") {
      html = setAlternates(html, [
        { language: "en-IN", url: SITE_ORIGIN + "/" },
        { language: "x-default", url: SITE_ORIGIN + "/" },
      ]);
    } else {
      html = setAlternates(html, [
        { language: "en-IN", url: canonical },
        { language: "x-default", url: canonical },
      ]);
    }
  }

  if (/^\/chapter\/(?:\d+(?:\.\d+)?|special\/[^/]+)$/.test(path)) {
    try {
      const chapters = await loadPublishedChapters(env);
      const chapter = findChapter(path, url, chapters);
      chapterResolved = Boolean(chapter);
      if (!chapter) {
        html = setMeta(html, "name", "robots", "noindex,nofollow,noarchive");
        headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      } else {
        const name = String(chapter.title || (chapter.chapter_number == null ? "Special chapter" : "Chapter " + chapter.chapter_number)).trim().slice(0, 180);
        const title = seoTitle("Atma Rekha | " + name, "Atma Rekha | Chapter");
        const languageLabel = normalizeLanguage(chapter.language) === "en" ? "English" : "Hindi written in Roman script";
        const description = ("Read " + name + " of Atma Rekha by Arkesh Kaalvantik in " + languageLabel + ". A fantasy adventure comic.").slice(0, 160);
        const canonical = SITE_ORIGIN + chapterPath(chapter);
        const image = safeCover(chapter.cover_url);
        const language = normalizeLanguage(chapter.language);
        const group = chapters.filter(item => {
          if (chapter.chapter_number != null && String(chapter.chapter_number).trim() !== "") return String(item.chapter_number == null ? "" : item.chapter_number).trim() === String(chapter.chapter_number).trim();
          return String(item.title || "").trim().toLowerCase() === String(chapter.title || "").trim().toLowerCase();
        });
        const alternates = [];
        for (const variant of group) {
          alternates.push({ language: normalizeLanguage(variant.language) === "en" ? "en-IN" : "hi-Latn-IN", url: SITE_ORIGIN + chapterPath(variant) });
        }
        const fallback = group.find(item => normalizeLanguage(item.language) === "hi") || group[0] || chapter;
        alternates.push({ language: "x-default", url: SITE_ORIGIN + chapterPath(fallback) });

        html = setTitle(html, title);
        html = setMeta(html, "name", "description", description);
        html = setMeta(html, "name", "author", "Arkesh Kaalvantik");
        html = setMeta(html, "name", "robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
        html = setMeta(html, "property", "og:type", "article");
        html = setMeta(html, "property", "og:site_name", "Atma Rekha");
        html = setMeta(html, "property", "og:title", title);
        html = setMeta(html, "property", "og:description", description);
        html = setMeta(html, "property", "og:url", canonical);
        html = setMeta(html, "property", "og:image", image);
        html = setMeta(html, "property", "og:image:secure_url", image);
        html = html.replace(/<meta\s+[^>]*property="og:image:type"[^>]*>\s*/i, "");
        html = setMeta(html, "property", "og:image:alt", title);
        html = setMeta(html, "name", "twitter:card", "summary_large_image");
        html = setMeta(html, "name", "twitter:title", title);
        html = setMeta(html, "name", "twitter:description", description);
        html = setMeta(html, "name", "twitter:image", image);
        html = setMeta(html, "name", "twitter:image:alt", title);
        html = setCanonical(html, canonical);
        html = setAlternates(html, Array.from(new Map(alternates.map(item => [item.language, item])).values()));

        const parsedNumber = chapter.chapter_number == null || String(chapter.chapter_number).trim() === "" ? null : Number(chapter.chapter_number);
        const nodes = [
          {
            "@type": "WebPage", "@id": canonical + "#webpage", url: canonical, name: title, description: description,
            inLanguage: language === "en" ? "en-IN" : "hi-Latn-IN", mainEntity: { "@id": canonical }, breadcrumb: { "@id": canonical + "#breadcrumb" }
          },
          {
            "@type": "BreadcrumbList", "@id": canonical + "#breadcrumb",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Atma Rekha", item: SITE_ORIGIN + "/" },
              { "@type": "ListItem", position: 2, name: "Chapters", item: SITE_ORIGIN + "/chapters" },
              { "@type": "ListItem", position: 3, name: name, item: canonical }
            ]
          },
          {
            "@type": "ComicIssue", "@id": canonical, name: name, headline: name, description: description,
            author: { "@type": "Person", name: "Arkesh Kaalvantik" }, image: image, url: canonical, mainEntityOfPage: canonical,
            isPartOf: { "@id": SITE_ORIGIN + "/#series" },
            datePublished: chapter.release_date || chapter.created_at || undefined,
            inLanguage: language === "en" ? "en-IN" : "hi-Latn-IN",
            isAccessibleForFree: parsedNumber == null ? true : parsedNumber <= 8,
            ...(parsedNumber != null ? { position: parsedNumber, issueNumber: String(parsedNumber) } : {})
          }
        ];
        html = addJsonLd(html, nodes);
      }
    } catch (_) {
      // Keep the reader available if the metadata service is temporarily unavailable.
    }
  }

  if (path === "/" || path === "/chapters" || path === "/info/about" || /^\/chapter\/(?:\d+(?:\.\d+)?|special\/[^/]+)$/.test(path)) {
    try {
      const fallbackChapters = await loadPublishedChapters(env);
      const fallbackContent = buildNoScriptFallback(path, url, fallbackChapters);
      if (fallbackContent && !html.includes("seo-no-script-content")) html = html.replace("</body>", fallbackContent + "\n</body>");
      if (chapterResolved === false) headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    } catch (_) {
      const fallbackContent = buildNoScriptFallback(path, url, []);
      if (fallbackContent && !html.includes("seo-no-script-content")) html = html.replace("</body>", fallbackContent + "\n</body>");
    }
  }

  headers.delete("Content-Length");
  headers.delete("content-length");
  headers.delete("Content-Encoding");
  headers.delete("content-encoding");
  if (isPrivate || !isKnown) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.delete("CDN-Cache-Control");
  } else {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    headers.set("CDN-Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  }
  return new Response(html, { status: chapterResolved === false ? 404 : response.status, statusText: chapterResolved === false ? "Not Found" : response.statusText, headers });
}


function escapeXml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function sitemapDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() > Date.now()
    ? ""
    : date.toISOString().slice(0, 10);
}

function chapterSitemapDate(chapter) {
  return sitemapDate(chapter.release_date) || sitemapDate(chapter.created_at);
}

async function loadAllPublishedChapters(env) {
  const base = String(env.SUPABASE_URL || SUPABASE_URL).replace(/\/+$/, "");
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || PUBLIC_SUPABASE_KEY);
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL(base + "/rest/v1/chapters");
    endpoint.searchParams.set("select", "id,chapter_number,title,language,status,release_date,created_at,deleted_at");
    endpoint.searchParams.set("status", "ilike.published");
    endpoint.searchParams.set("deleted_at", "is.null");
    endpoint.searchParams.set("order", "chapter_number.asc.nullsfirst,created_at.asc,id.asc");
    endpoint.searchParams.set("limit", String(pageSize));
    endpoint.searchParams.set("offset", String(offset));
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Published chapter sitemap lookup failed.");
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Invalid chapter sitemap response.");
    rows.push(...page.filter(row =>
      String(row.status || "").trim().toLowerCase() === "published" && !row.deleted_at
    ));
    if (page.length < pageSize) break;
  }
  return rows;
}

function buildSitemapXml(chapters) {
  const staticPaths = [
    "/", "/chapters", "/chapters?lang=en",
    "/pal-do-pal-ke-lamhe", "/info/about", "/info/terms", "/info/privacy", "/info/contact", "/info/report",
  ];
  const entries = new Map();
  const add = (path, lastmod = "") => {
    const loc = SITE_ORIGIN + path;
    if (!entries.has(loc)) entries.set(loc, { loc, lastmod, alternates: [] });
    else if (!entries.get(loc).lastmod && lastmod) entries.get(loc).lastmod = lastmod;
  };
  for (const path of staticPaths) add(path);
  const groups = new Map();
  for (const chapter of chapters) {
    const path = chapterPath(chapter);
    add(path, chapterSitemapDate(chapter));
    if (chapter.chapter_number === null || chapter.chapter_number === undefined || String(chapter.chapter_number).trim() === "") continue;
    const key = "number:" + String(chapter.chapter_number).trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(chapter);
  }
  for (const group of groups.values()) {
    const languageLinks = group.map(chapter => ({
      language: normalizeLanguage(chapter.language) === "en" ? "en-IN" : "hi-Latn-IN",
      url: SITE_ORIGIN + chapterPath(chapter),
    }));
    const links = [...new Map(languageLinks.map(item => [item.language, item])).values()];
    const fallback = group.find(chapter => normalizeLanguage(chapter.language) === "hi") || group[0];
    links.push({ language: "x-default", url: SITE_ORIGIN + chapterPath(fallback) });
    for (const chapter of group) {
      const entry = entries.get(SITE_ORIGIN + chapterPath(chapter));
      if (entry) entry.alternates = links;
    }
  }
  for (const chapter of chapters) {
    if (chapter.chapter_number !== null && chapter.chapter_number !== undefined && String(chapter.chapter_number).trim() !== "") continue;
    const url = SITE_ORIGIN + chapterPath(chapter);
    const entry = entries.get(url);
    if (!entry) continue;
    const languageCode = normalizeLanguage(chapter.language) === "en" ? "en-IN" : "hi-Latn-IN";
    entry.alternates = [
      { language: languageCode, url },
      { language: "x-default", url },
    ];
  }
  const chapterListAlternates = [
    { language: "en-IN", url: SITE_ORIGIN + "/chapters?lang=en" },
    { language: "hi-Latn-IN", url: SITE_ORIGIN + "/chapters" },
    { language: "x-default", url: SITE_ORIGIN + "/chapters" },
  ];
  for (const path of ["/chapters", "/chapters?lang=en"]) {
    const entry = entries.get(SITE_ORIGIN + path);
    if (entry) entry.alternates = chapterListAlternates;
  }
  const urls = [...entries.values()].map(entry => [
    "  <url>",
    "    <loc>" + escapeXml(entry.loc) + "</loc>",
    ...[...new Map(entry.alternates.map(item => [item.language, item])).values()]
      .map(item => '    <xhtml:link rel="alternate" hreflang="' + escapeXml(item.language) + '" href="' + escapeXml(item.url) + '" />'),
    entry.lastmod ? "    <lastmod>" + entry.lastmod + "</lastmod>" : "",
    "  </url>",
  ].filter(Boolean).join("\n"));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

async function serveSitemap(request, env) {
  const cacheKey = new Request(SITE_ORIGIN + "/sitemap.xml", { method: "GET" });
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) return new Response(cached.body, { status: 200, headers: cached.headers });
  } catch (_) {}
  try {
    const chapters = await loadAllPublishedChapters(env);
    const body = buildSitemapXml(chapters);
    const response = new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        "X-Content-Type-Options": "nosniff",
      },
    });
    try { await caches.default.put(cacheKey, response.clone()); } catch (_) {}
    return response;
  } catch (_) {
    const fallback = await env.ASSETS.fetch(new Request(SITE_ORIGIN + "/sitemap.xml"));
    return new Response(fallback.body, {
      status: fallback.status,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === "http:" || url.hostname === "atmarekha.in") {
      if (url.protocol === "http:") url.protocol = "https:";
      if (url.hostname === "atmarekha.in") url.hostname = "www.atmarekha.in";
      return Response.redirect(url.toString(), 301);
    }
    if (request.method === "GET" && url.pathname === "/sitemap.xml") {
      return withSecurityHeaders(await serveSitemap(request, env));
    }
    const response = await env.ASSETS.fetch(request);
    if (request.method === "GET" && (response.headers.get("Content-Type") || "").toLowerCase().includes("text/html")) {
      return withSecurityHeaders(await addServerSeo(request, response, env));
    }
    const headers = new Headers(response.headers);
    if (privatePath(url.pathname)) headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return withSecurityHeaders(new Response(response.body, { status: response.status, statusText: response.statusText, headers }));
  },
};
