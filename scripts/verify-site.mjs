import { readFile } from 'node:fs/promises';

const required = [
  ['UserAuth.jsx', 'Account creation is limited to readers aged 15 and over.'],
  ['UserAuth.jsx', 'I confirm that I am 15 years old or older'],
  ['InfoPage.jsx', "['Accounts', '15+']"],
  ['theme-system.css', ':root[data-theme="dark"]'],
  ['theme-system.css', ':root[data-theme="light"]'],
  ['worker.js', 'https://atma-rekha-analytics.rohitbaswaraj.workers.dev'],
  ['scripts/generate-sitemap.mjs', "chapterGroupKey"],
  ['UserAuth.jsx', "from './src/shared/validation/formUX.js'"],
  ['src/features/chapters/components/ChapterDiscovery.jsx', '<div className="chapter-discovery">'],
  ['index.html', '<link rel="canonical" href="https://www.atmarekha.in/" />'],
  ['index.html', '<script type="application/ld+json" id="atma-rekha-site-schema">'],
  ['index.html', '<meta name="robots" content="index,follow'],
  ['public/robots.txt', 'Sitemap: https://www.atmarekha.in/sitemap.xml'],
  ['routes.js', './src/app/routing/routeService.js'],
  ['src/app/routing/routeService.js', 'window.location.search'],
  ['App.jsx', 'window.history.replaceState'],
  ['scripts/generate-sitemap.mjs', 'isPublished'],
  ['scripts/generate-sitemap.mjs', 'xmlns:image'],
  ['public/_headers', '/profile*'],
  ['public/_headers', 'X-Robots-Tag: noindex, nofollow, noarchive'],
  ['public/_headers', "sha256-5zLsbxu6OpCHh7Nldl3+MyHkpY40u0abU8XOzScRPGU="],
  ['worker.js', "sha256-5zLsbxu6OpCHh7Nldl3+MyHkpY40u0abU8XOzScRPGU="],
  ['App.jsx', '<h2 id="pdlpl-home-title">Pal Do Pal Ke Lamhe</h2>'],
  ['atma-media-worker/index.js', "select: 'user_id,role'"],
  ['pdlpl-media-worker/index.js', "select: 'user_id,role'"],
  ['analytics-worker/worker.js', 'admins?select=user_id,role'],
];

const forbidden = [
  ['UserAuth.jsx', 'nominate a person'],
  ['membership.css', '#d946ef'],
  ['PrivacyCenter.jsx', 'nominate a person'],
  ['App.jsx', 'getOfflineChapter'],
  ['App.jsx', 'offline-save-button'],
  ['src/features/chapters/components/ChapterDiscovery.jsx', 'Most viewed'],
  ['public/robots.txt', 'Disallow: /profile'],
  ['public/robots.txt', 'Disallow: /membership'],
  ['public/robots.txt', 'Disallow: /group-chat'],
  ['public/robots.txt', 'Disallow: /community'],
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

for (const file of ['public/_headers', 'worker.js']) {
  const content = await readFile(file, 'utf8');
  const csp = content.split(/\r?\n/).find(line => line.includes('Content-Security-Policy')) || '';
  const scriptDirective = csp.split(';').find(part => part.includes('script-src')) || '';
  if (!scriptDirective.includes('sha256-5zLsbxu6OpCHh7Nldl3+MyHkpY40u0abU8XOzScRPGU=')) {
    console.error('CHECK FAILED:', file, 'CSP must allow the hashed theme bootstrap.');
    failed = true;
  }
  if (scriptDirective.includes("'unsafe-inline'")) {
    console.error('CHECK FAILED:', file, 'script-src must not enable unsafe-inline.');
    failed = true;
  }
}

for (const file of ['atma-media-worker/index.js', 'pdlpl-media-worker/index.js', 'analytics-worker/worker.js']) {
  const content = await readFile(file, 'utf8');
  if (!content.includes("['owner', 'admin'].includes(String(row?.role || '').trim().toLowerCase())")) {
    console.error('CHECK FAILED:', file, 'must authorize only explicit owner/admin roles.');
    failed = true;
  }
}


if (failed) process.exit(1);
console.log('Atma Rekha production checks passed.');
