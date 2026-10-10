import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const failures = [];
const passes = [];
const notes = [];

async function file(path) {
  try { return await readFile(path, 'utf8'); }
  catch (error) {
    failures.push(`Missing or unreadable file: ${path} (${error.code || error.message})`);
    return '';
  }
}

function check(label, condition, failure) {
  if (condition) passes.push(label);
  else failures.push(failure || label);
}

const html = await file('index.html');
const main = await file('main.jsx');
const packageJson = JSON.parse(await file('package.json') || '{}');
const standardsCss = await file('website-standards.css');
const robots = await file('public/robots.txt');
const sitemap = await file('public/sitemap.xml');
const headers = await file('public/_headers');
const privacy = await file('PrivacyCenter.jsx');
const info = await file('InfoPage.jsx');
const footer = await file('Footer.jsx');
const errorLogger = await file('errorLogger.js');
const discovery = await file('ChapterDiscovery.jsx');
const groupChat = await file('GroupChat.jsx');

check('HTML declares a document language', /<html\s+lang=["'][a-z-]+["']/i.test(html), 'index.html must declare a document language.');
check('Mobile viewport is configured', /name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i.test(html), 'index.html is missing a responsive viewport.');
check('Page title and description exist', /<title>[^<]+<\/title>/i.test(html) && /name=["']description["'][^>]*content=["'][^"']+["']/i.test(html), 'Missing page title or meta description.');
check('Canonical and social metadata exist', /rel=["']canonical["']/i.test(html) && /property=["']og:title["']/i.test(html) && /name=["']twitter:card["']/i.test(html), 'Canonical, Open Graph, or Twitter metadata is missing.');
check('Favicon and web manifest are referenced', /rel=["']icon["']/i.test(html) && /rel=["']manifest["']/i.test(html), 'Favicon or web manifest reference is missing.');
check('Sitemap is discoverable by robots.txt', /Sitemap:\s*https:\/\/www\.atmarekha\.in\/sitemap\.xml/i.test(robots), 'robots.txt must advertise the production sitemap.');
check('Sitemap is valid XML-shaped output with unique locations', /<urlset\b/.test(sitemap) && /<\/urlset>/.test(sitemap) && (() => {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  return locs.length > 0 && new Set(locs).size === locs.length;
})(), 'Sitemap is empty, malformed, or contains duplicate <loc> entries.');
check('Private routes receive no-index headers', /X-Robots-Tag:\s*noindex, nofollow, noarchive/i.test(headers), 'Expected no-index headers for private/profile routes were not found.');
check('Privacy controls and legal pages are present in application source', /export default function PrivacyCenter/.test(privacy) && /Terms & Conditions/.test(info) && /Privacy/.test(privacy), 'Privacy controls or Terms & Conditions source is missing.');
check('Footer includes legal/contact navigation', /Footer navigation/.test(footer) && /info\/contact/.test(footer) && /info\/privacy/.test(footer) && /info\/terms/.test(footer), 'Footer legal/contact navigation is incomplete.');
check('Standards stylesheet is imported by the app', /import ['"]\.\/website-standards\.css['"]/.test(main), 'Import website-standards.css from main.jsx.');
check('Standards stylesheet has rectangular controls and solid action fills', /border-radius:\s*var\(--ar-control-radius\)\s*!important/.test(standardsCss) && /background-image:\s*none\s*!important/.test(standardsCss), 'Control-shape and gradient-button guardrails are missing.');
check('Keyboard focus styles exist for light and dark themes', /:focus-visible/.test(standardsCss) && /data-theme=["']dark["']/.test(standardsCss), 'Visible keyboard-focus styles are missing.');
check('Reduced-motion support exists', /prefers-reduced-motion:\s*reduce/.test(standardsCss), 'Reduced-motion support is missing.');
check('Interactive transition duration is capped', /transition-duration:\s*180ms\s*!important/.test(standardsCss), 'Interactive transitions must be capped at 180ms.');
check('Chapter and group-chat navigation avoid emoji-only UI icons', !discovery.includes('📄') && !discovery.includes('💬') && !groupChat.includes('💬 Group Chat') && !groupChat.includes('group-chat-launch-icon">💬') && groupChat.includes('REACTIONS.map(reaction'), 'Replace emoji-only UI icons with descriptive text or SVG icons.');
check('Chapter browser controls use readable type and responsive mobile columns', /font: 500 14px\/1\.4 system-ui, sans-serif !important/.test(standardsCss) && /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/.test(standardsCss) && /max-width: 360px/.test(standardsCss), 'Chapter browser controls or mobile columns are not using the readability guardrails.');
check('Muted text tokens meet minimum contrast targets by source color', /--faint-color: #6b6b6b/.test(standardsCss) && /--faint-color: #a6a6a6/.test(standardsCss), 'Light/dark muted text tokens require stronger contrast.');
check('Unattended CSS animations are capped and do not loop', /animation-duration:\s*300ms\s*!important/.test(standardsCss) && /animation-iteration-count:\s*1\s*!important/.test(standardsCss), 'Unattended CSS animations must be capped at 300ms and limited to one iteration.');
check('Build and static checks are scripted', typeof packageJson.scripts?.build === 'string' && typeof packageJson.scripts?.check === 'string', 'package.json is missing production build/check scripts.');
check('Error logger does not print raw error objects or arbitrary context', !/console\.error\(err,\s*context\)/.test(errorLogger), 'Raw error objects/context may expose sensitive values in the browser console.');

async function walk(dir) {
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  const found = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || ['node_modules', 'dist', 'coverage', '.wrangler'].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(path));
    else if (['.css', '.js', '.jsx', '.html'].includes(extname(entry.name))) found.push(path);
  }
  return found;
}

const sourceFiles = (await walk('.')).filter(path => path !== 'scripts/audit-website.mjs');
for (const path of sourceFiles) {
  let content = '';
  try { content = await readFile(path, 'utf8'); } catch { continue; }
  if (/cursor\s*:\s*url\s*\(/i.test(content)) failures.push(`Custom cursor declaration found in ${path}`);
  if (/lorem ipsum|experience the magic|10m\+\s+users|made with ai/i.test(content)) failures.push(`Placeholder/forbidden marketing copy found in ${path}`);
}

if (failures.length) {
  console.error('Website standards audit failed:');
  for (const item of failures) console.error('  FAIL:', item);
} else {
  console.log(`Website standards static checks passed (${passes.length} checks).`);
}

notes.push(
  'Manual launch gate still required: visual design audit, color-contrast measurements, alt-text review, form/keyboard/screen-reader checks, responsive testing at 320/768/1024/1440px, cross-browser and real-device testing, Lighthouse on mobile/desktop, live DNS/TLS and dead-link checks, email-delivery verification, security review, legal review, backup/rollback confirmation, and stakeholder sign-off.',
  'The strict ban on AI-generated imagery conflicts with the site’s published manga artwork and current AI-assistance disclosure. Preserve existing story content; the content owner must explicitly resolve this policy before that item can be marked compliant.',
);
for (const item of notes) console.warn('MANUAL GATE:', item);

if (failures.length) process.exit(1);
