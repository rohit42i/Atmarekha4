const SITE_ORIGIN = "https://www.atmarekha.in";
const SUPABASE_URL = "https://pbukwjokgkqacaphlqzm.supabase.co";
const PUBLIC_SUPABASE_KEY = "sb_publishable_g0VUtYwOVwHcfRoY3zD9FA_seUEV61E";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://checkout.razorpay.com 'sha256-5zLsbxu6OpCHh7Nldl3+MyHkpY40u0abU8XOzScRPGU='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiny-pond-c959.rohitbaswaraj.workers.dev https://pdlpl-media.rohitbaswaraj.workers.dev https://*.supabase.co https://*.razorpay.com; connect-src 'self' https://pbukwjokgkqacaphlqzm.supabase.co wss://pbukwjokgkqacaphlqzm.supabase.co https://tiny-pond-c959.rohitbaswaraj.workers.dev https://pdlpl-media.rohitbaswaraj.workers.dev https://atma-rekha-analytics.rohitbaswaraj.workers.dev https://api.razorpay.com https://api.pwnedpasswords.com; frame-src 'self' https://checkout.razorpay.com https://*.razorpay.com; font-src 'self' data:; worker-src 'self' blob:; media-src 'self' blob:; manifest-src 'self'",
};

const STATIC_SEO = {
  "/chapters": ["Chapters | Atma Rekha", "Browse published chapters of Atma Rekha, an original Indian fantasy adventure manga by Arkesh."],
  "/info/about": ["About Atma Rekha | Indian Fantasy Manga", "Discover Atma Rekha, an original Indian fantasy adventure manga created by Arkesh."],
  "/info/contact": ["Contact Atma Rekha", "Contact the Atma Rekha team for reader questions, support, and website feedback."],
  "/info/report": ["Report a Problem | Atma Rekha", "Report a website issue, content concern, or accessibility problem to Atma Rekha."],
  "/info/privacy": ["Privacy Policy | Atma Rekha", "Read how Atma Rekha handles account information, site activity, and privacy requests."],
  "/info/terms": ["Terms & Privacy | Atma Rekha", "Read Atma Rekha's terms of use and privacy policy, including account data, memberships, and reader features."],
  "/pal-do-pal-ke-lamhe": ["Pal Do Pal Ke Lamhe | Atma Rekha", "Discover Pal Do Pal Ke Lamhe, a separate original story from the creator of Atma Rekha."],
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
  return /^\/(?:admin|profile|membership|group-chat|community|maintenance|403|430|503)(?:\/|$)/i.test(path) || path === "/privacy-center";
}

function knownPath(path) {
  if (path === "/" || path === "/chapters" || path === "/admin" || path === "/profile" || path === "/membership" || path === "/group-chat" || path === "/community" || path === "/privacy-center" || path === "/maintenance" || path === "/403" || path === "/430" || path === "/503" || path === "/pal-do-pal-ke-lamhe") return true;
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
  const endpoint = new URL(base + "/rest/v1/chapters");
  endpoint.searchParams.set("select", "id,chapter_number,title,language,status,cover_url,release_date,created_at");
  endpoint.searchParams.set("status", "eq.published");
  endpoint.searchParams.set("order", "chapter_number.asc.nullsfirst,created_at.asc");
  endpoint.searchParams.set("limit", "1000");
  const cacheKey = new Request(endpoint.toString(), { method: "GET" });
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) return await cached.json();
  } catch (_) {}
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error("Published chapter lookup failed.");
  const rows = await response.json();
  try {
    await caches.default.put(cacheKey, new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } }));
  } catch (_) {}
  return Array.isArray(rows) ? rows : [];
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
  if (!base) base = { "@context": "https://schema.org", "@type": "WebSite", "@id": SITE_ORIGIN + "/#website", name: "Atma Rekha", url: SITE_ORIGIN + "/", creator: { "@type": "Person", name: "Arkesh" } };
  const graph = Array.isArray(base["@graph"]) ? base["@graph"] : [base];
  graph.push(...nodes);
  const script = '<script type="application/ld+json" id="atma-rekha-site-schema">' + JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") + "</script>";
  return match ? html.replace(pattern, script) : html.replace("</head>", "  " + script + "\n</head>");
}

async function addServerSeo(request, response, env) {
  const url = new URL(request.url);
  const path = url.pathname === "/" ? "/" : "/" + url.pathname.replace(/^\/+|\/+$/g, "");
  const headers = new Headers(response.headers);
  const isPrivate = privatePath(path);
  const isKnown = knownPath(path);

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
      if (!chapter) {
        html = setMeta(html, "name", "robots", "noindex,nofollow,noarchive");
        headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      } else {
        const name = String(chapter.title || (chapter.chapter_number == null ? "Special chapter" : "Chapter " + chapter.chapter_number)).trim().slice(0, 180);
        const title = name + " | Atma Rekha";
        const description = ("Read " + name + " of Atma Rekha, an original Indian fantasy adventure manga by Arkesh.").slice(0, 160);
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
        html = setMeta(html, "name", "author", "Arkesh");
        html = setMeta(html, "name", "robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
        html = setMeta(html, "property", "og:type", "article");
        html = setMeta(html, "property", "og:site_name", "Atma Rekha");
        html = setMeta(html, "property", "og:title", title);
        html = setMeta(html, "property", "og:description", description);
        html = setMeta(html, "property", "og:url", canonical);
        html = setMeta(html, "property", "og:image", image);
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
            "@type": "ComicStory", "@id": canonical, name: name, headline: name, description: description,
            author: { "@type": "Person", name: "Arkesh" }, image: image, url: canonical, mainEntityOfPage: canonical,
            isPartOf: { "@id": SITE_ORIGIN + "/#atma-rekha" },
            datePublished: chapter.release_date || chapter.created_at || undefined,
            inLanguage: language === "en" ? "en-IN" : "hi-Latn-IN",
            isAccessibleForFree: parsedNumber == null ? true : parsedNumber <= 8,
            ...(parsedNumber != null ? { position: parsedNumber } : {})
          }
        ];
        html = addJsonLd(html, nodes);
      }
    } catch (_) {
      // Keep the reader available if the metadata service is temporarily unavailable.
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
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === "http:" || url.hostname === "atmarekha.in") {
      if (url.protocol === "http:") url.protocol = "https:";
      if (url.hostname === "atmarekha.in") url.hostname = "www.atmarekha.in";
      return Response.redirect(url.toString(), 301);
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
