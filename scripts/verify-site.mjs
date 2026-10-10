import { readFile } from 'node:fs/promises';

const required = [
  ['UserAuth.jsx', 'Account creation is limited to readers aged 15 and over.'],
  ['UserAuth.jsx', 'I confirm that I am 15 years old or older'],
  ['InfoPage.jsx', "['Minimum account age', '15+']"],
  ['theme-system.css', ':root[data-theme="dark"]'],
  ['theme-system.css', ':root[data-theme="light"]'],
  ['worker.js', 'https://atma-rekha-analytics.rohitbaswaraj.workers.dev'],
  ['scripts/generate-sitemap.mjs', "chapterGroupKey"],
  ['UserAuth.jsx', "from './formUX.js'"],
  ['ChapterDiscovery.jsx', '<div className="chapter-discovery">'],
  ['index.html', '<link rel="canonical" href="https://www.atmarekha.in/" />'],
  ['index.html', '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />'],
  ['public/favicon.svg', 'stroke="#fff"'],
  ['App.jsx', "description: 'Arnav searches for answers after years of missing memories, uncovering ancient traditions and hidden powers.'"],
  ['ExperienceEnhancements.jsx', 'return null;'],
  ['InfoPage.jsx', 'Minimum account age'],
  ['InfoPage.jsx', "title: 'Terms & Conditions'"],
  ['PrivacyCenter.jsx', 'Privacy notice version'],
  ['Footer.jsx', 'href="#info/privacy"'],
  ['Footer.jsx', 'href="#info/terms"'],
  ['index.html', '<script type="application/ld+json" id="atma-rekha-site-schema">'],
  ['index.html', '<meta name="robots" content="index,follow'],
  ['public/robots.txt', 'Sitemap: https://www.atmarekha.in/sitemap.xml'],
  ['routes.js', 'window.location.search'],
  ['App.jsx', 'window.history.replaceState'],
  ['scripts/generate-sitemap.mjs', 'isPublished'],
  ['scripts/generate-sitemap.mjs', 'xmlns:image'],
  ['public/_headers', '/profile*'],
  ['public/_headers', 'X-Robots-Tag: noindex, nofollow, noarchive'],
];

const forbidden = [
  ['UserAuth.jsx', 'nominate a person'],
  ['membership.css', '#d946ef'],
  ['PrivacyCenter.jsx', 'nominate a person'],
  ['App.jsx', 'getOfflineChapter'],
  ['App.jsx', 'offline-save-button'],
  ['ChapterDiscovery.jsx', 'Most viewed'],
  ['public/robots.txt', 'Disallow: /profile'],
  ['public/robots.txt', 'Disallow: /membership'],
  ['public/robots.txt', 'Disallow: /group-chat'],
  ['public/robots.txt', 'Disallow: /community'],
  ['ExperienceEnhancements.jsx', 'pointermove'],
  ['ExperienceEnhancements.jsx', 'ScrollTrigger'],
  ['ExperienceEnhancements.jsx', 'gsap.to'],
  ['Footer.jsx', '🇮🇳'],
  ['Membership.jsx', "icon:'🆓'"],
  ['Membership.jsx', "icon:'🌱'"],
  ['Membership.jsx', "icon:'🌸'"],
  ['Membership.jsx', "icon:'🦚'"],
  ['SubscriberBadge.jsx', "emoji: '🧸'"],
  ['SubscriberBadge.jsx', "emoji: '🌸'"],
  ['SubscriberBadge.jsx', "emoji: '🦚'"],
  ['ChapterAccessGuard.jsx', '🔒'],
  ['ChapterAccessGuard.jsx', '🦚'],
  ['PalDoPalKeLamhe.jsx', '🦚'],
];

let failed = false;

for (const [file, phrase] of required) {
  const content = await readFile(file, 'utf8');
  if (!content.includes(phrase)) {
    console.error('CHECK FAILED:', file, 'missing:', phrase);
    failed = true;
  }
}

for (const [file, phrase] of forbidden) {
  try {
    const content = await readFile(file, 'utf8');
    if (content.toLowerCase().includes(phrase.toLowerCase())) {
      console.error('CHECK FAILED:', file, 'forbidden:', phrase);
      failed = true;
    }
  } catch {}
}

const theme = await readFile('theme-system.css', 'utf8');
if (theme.includes('html{color-scheme:light!important}')) {
  console.error('CHECK FAILED: legacy hard-coded light color-scheme remains.');
  failed = true;
}

const oldMembership = await import('node:fs/promises').then(fs => fs.access('Membership.css').then(() => true).catch(() => false));
if (oldMembership) {
  console.error('CHECK FAILED: unused Membership.css still exists.');
  failed = true;
}


const sitemap = await readFile('public/sitemap.xml', 'utf8');
for (const phrase of [
  '<urlset ',
  '<loc>https://www.atmarekha.in/chapters</loc>',
  '<loc>https://www.atmarekha.in/chapters?lang=en</loc>',
  'hreflang="en-IN"',
  'hreflang="hi-Latn-IN"',
]) {
  if (!sitemap.includes(phrase)) {
    console.error('CHECK FAILED: public/sitemap.xml missing:', phrase);
    failed = true;
  }
}


if (failed) process.exit(1);
console.log('Atma Rekha production checks passed.');
