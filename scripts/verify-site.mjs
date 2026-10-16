import { readFile } from 'node:fs/promises';

const required = [
  ['supabase.js', 'export function isSupportedImageFile(file)'],
  ['supabase.js', 'body: file'],
  ['atma-media-worker/index.js', 'const communityAttachment ='],
  ['atma-media-worker/index.js', 'const announcementImage'],
  ['atma-media-worker/index.js', 'Unsupported image format. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.'],
  ['UserAuth.jsx', 'Account creation is limited to readers aged 15 and over.'],
  ['UserAuth.jsx', 'I confirm that I am 15 years old or older'],
  ['InfoPage.jsx', "['Accounts', '15+']"],
  ['theme-system.css', ':root[data-theme="dark"]'],
  ['theme-system.css', ':root[data-theme="light"]'],
  ['worker.js', 'https://atma-rekha-analytics.rohitbaswaraj.workers.dev'],
  ['scripts/generate-sitemap.mjs', "chapterGroupKey"],
  ['UserAuth.jsx', "from './formUX.js'"],
  ['ChapterDiscovery.jsx', '<div className="chapter-discovery">'],
  ['index.html', '<link rel="canonical" href="https://www.atmarekha.in/" />'],
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
  ['supabase.js', 'async function decodeImage('],
  ['supabase.js', 'async function compressImage('],
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



const adminPanel = await readFile('AdminPanel.jsx', 'utf8');
const controlRoom = await readFile('AdminControlRoom.jsx', 'utf8');
const chapterManager = await readFile('AdminChapterManager.jsx', 'utf8');
const adminStyles = await readFile('admin-command-center-system.css', 'utf8');

for (const [name, content, phrase] of [
  ['AdminPanel.jsx', adminPanel, "import './admin-command-center-system.css';"],
  ['AdminControlRoom.jsx', controlRoom, "import './admin-control-room.css';"],
  ['AdminControlRoom.jsx', controlRoom, 'const loadSequence = useRef(0);'],
  ['AdminControlRoom.jsx', controlRoom, 'const exportVisibleMetrics = () => exportMetricRows(visibleMetrics'],
  ['AdminControlRoom.jsx', controlRoom, 'onClick={exportVisibleMetrics}'],
  ['AdminChapterManager.jsx', chapterManager, 'admin-chapter-card-grid'],
  ['admin-command-center-system.css', adminStyles, ':focus-visible'],
  ['admin-command-center-system.css', adminStyles, 'prefers-reduced-motion'],
]) {
  if (!content.includes(phrase)) {
    console.error('CHECK FAILED:', name, 'missing admin control-room safeguard:', phrase);
    failed = true;
  }
}

const metricStart = controlRoom.indexOf('const metricGroups = useMemo');
const metricEnd = controlRoom.indexOf('const metricCategories', metricStart);
const metricSource = metricStart >= 0 && metricEnd > metricStart ? controlRoom.slice(metricStart, metricEnd) : '';
const metricCount = [...metricSource.matchAll(/\\bm\\('/g)].length;
if (metricCount < 100) {
  console.error('CHECK FAILED: admin control room must define at least 100 analytics metrics; found:', metricCount);
  failed = true;
} else {
  console.log('Admin control-room metric definitions:', metricCount);
}

if (failed) process.exit(1);
console.log('Atma Rekha production checks passed.');
