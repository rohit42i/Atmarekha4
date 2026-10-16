import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

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
  ['public/llms.txt', 'An original Indian fantasy adventure manga by Arkesh.'],
  ['public/.well-known/security.txt', 'Contact: mailto:atmarekhasupport@gmail.com'],
  ['public/.well-known/security.txt', 'Canonical: https://www.atmarekha.in/.well-known/security.txt'],
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

const feedbackSourceRegression = await readFile('FeedbackForm.jsx', 'utf8');
if (/\\bflushQueue\\s*\\(/.test(feedbackSourceRegression) && !/\\b(?:function|const|let|var)\\s+flushQueue\\b/.test(feedbackSourceRegression)) {
  console.error('CHECK FAILED: FeedbackForm references flushQueue without an implementation.');
  failed = true;
}

const readerSourceRegression = await readFile('App.jsx', 'utf8');
if (readerSourceRegression.includes('if (!pages.length) return null;')) {
  console.error('CHECK FAILED: Reader must not render a blank page when a chapter has no pages.');
  failed = true;
}
if (!readerSourceRegression.includes('No pages are available for this chapter yet.')) {
  console.error('CHECK FAILED: Reader empty-page recovery message is missing.');
  failed = true;
}

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
const metricCount = [...metricSource.matchAll(/\bm\('/g)].length;
if (metricCount < 100) {
  console.error('CHECK FAILED: admin control room must define at least 100 analytics metrics; found:', metricCount);
  failed = true;
} else {
  console.log('Admin control-room metric definitions:', metricCount);
}

const htmlForCsp = await readFile('index.html', 'utf8');
const themeScriptOpen = htmlForCsp.indexOf('<script>\n    (function()');
if (themeScriptOpen < 0) {
  console.error('CHECK FAILED: theme bootstrap script not found in index.html.');
  failed = true;
} else {
  const bodyStart = htmlForCsp.indexOf('>', themeScriptOpen) + 1;
  const bodyEnd = htmlForCsp.indexOf('</script>', bodyStart);
  if (bodyStart <= 0 || bodyEnd < bodyStart) {
    console.error('CHECK FAILED: theme bootstrap script could not be parsed.');
    failed = true;
  } else {
    const body = htmlForCsp.slice(bodyStart, bodyEnd);
    const hashToken = "'sha256-" + createHash('sha256').update(body, 'utf8').digest('base64') + "'";
    for (const file of ['public/_headers', 'worker.js']) {
      const policyFile = await readFile(file, 'utf8');
      const policyLine = policyFile.match(/Content-Security-Policy[^\n]*/i)?.[0] || '';
      const scriptSource = policyLine.match(/script-src ([^;]+)/)?.[1] || '';
      if (!scriptSource.split(/\s+/).includes(hashToken)) {
        console.error('CHECK FAILED:', file, 'CSP does not allow the audited theme bootstrap hash:', hashToken);
        failed = true;
      }
      if (scriptSource.includes("'unsafe-inline'")) {
        console.error('CHECK FAILED:', file, 'script-src must not allow unsafe-inline.');
        failed = true;
      }
    }
  }
}
for (const [file, phrase] of [
  ['.gitignore', '.env'],
  ['.github/dependabot.yml', 'package-ecosystem: npm'],
  ['.github/workflows/codeql.yml', 'github/codeql-action/analyze@v4'],
  ['supabase/migrations/20261016112803_make_legacy_chapter_pages_bucket_private.sql', "SET public = false"],
]) {
  try {
    const content = await readFile(file, 'utf8');
    if (!content.includes(phrase)) {
      console.error('CHECK FAILED:', file, 'missing:', phrase);
      failed = true;
    }
  } catch {
    console.error('CHECK FAILED: required security configuration is missing:', file);
    failed = true;
  }
}


const adminControlRoom = await readFile('AdminControlRoom.jsx', 'utf8');
const adminPanelSource = await readFile('AdminPanel.jsx', 'utf8');
const declaredMetricCount = [...adminControlRoom.matchAll(/\bm\(['"][^'"]+['"],\s*['"][^'"]+['"]/g)].length;
const workbenchActionCount = [...adminControlRoom.matchAll(/\{\s*id:\s*'[^']+',\s*group:\s*'[^']+',\s*title:/g)].length;
if (declaredMetricCount < 200) {
  console.error('CHECK FAILED: admin control room must expose at least 200 documented analytics metrics; found', declaredMetricCount);
  failed = true;
}
if (workbenchActionCount !== 50) {
  console.error('CHECK FAILED: admin workbench must expose exactly 50 declared actions; found', workbenchActionCount);
  failed = true;
}
if (!adminControlRoom.includes("onClick={item.run}") || !adminControlRoom.includes("section === 'Feature Workbench'")) {
  console.error('CHECK FAILED: admin workbench actions are not connected to the rendered interface.');
  failed = true;
}
if (!adminPanelSource.includes("{ key: 'Email Campaigns'") || !adminPanelSource.includes("'Community Posts', 'Membership & Earnings'")) {
  console.error('CHECK FAILED: admin sidebar links and tab allow-list are out of sync.');
  failed = true;
}

if (failed) process.exit(1);
console.log('Atma Rekha production checks passed.');
