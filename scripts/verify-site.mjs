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
  ['InfoPage.jsx', "['Age guidance', '15+']"],
  ['InfoPage.jsx', 'AI tools are part of the creative process'],
  ['InfoPage.jsx', 'Visual material made with AI tools'],
  ['PrivacyCenter.jsx', 'Why we use it'],
  ['PrivacyCenter.jsx', 'How long we keep information'],
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
  ['notification-prompt.js', 'if (stored === null || stored.trim() === \'\') return fallback;'],
  ['notification-prompt.js', 'FIRST_REPEAT_AT_TOTAL_SECONDS = 30 * 60 * 60'],
  ['notification-prompt.js', 'function migratePromptSchedule()'],
  ['notification-prompt.js', "localStorage.setItem(SCHEDULE_VERSION_KEY, '3')"],
  ['notification-prompt.js', "atma-notification-dont-show-again"],
  ['notification-prompt.js', "Don't show this again"],
  ['ProfileV2.jsx', 'emailRedirectTo: window.location.origin'],
  ['UserAuth.jsx', "dpdp_privacy_consent_version:'2026-10-19'"],
  ['supabase/functions/dpdp-data-rights/index.ts', 'if (existingError) throw existingError;'],
  ['ProfileV2.jsx', 'Your profile details were saved, but the email change failed:'],
  ['PrivacyCenter.jsx', 'Deletion requests are queued for review'],
  ['PrivacyCenter.jsx', 'some categories may be incomplete or could not be retrieved'],
  ['InfoPage.css', '.privacy-controls-grid'],
  ['InfoPage.css', 'html[data-theme="dark"] .privacy-control-button'],
  ['supabase/migrations/20261019084630_harden_dpdp_table_grants_20261019.sql', 'revoke insert, update, delete, truncate, references, trigger'],
  ['PrivacyCenter.jsx', "deletion?.status === 'pending' || deletion?.status === 'processing'"],
  ['PrivacyRequestsAdmin.jsx', 'admin-list-deletion-requests'],
  ['PrivacyRequestsAdmin.jsx', 'Mark erased & resolved'],
  ['AdminPanel.jsx', "key: 'Privacy Requests'"],
  ['supabase/functions/dpdp-data-rights/index.ts', 'admin-update-deletion-request'],
  ['supabase/functions/dpdp-data-rights/index.ts', 'export_warnings'],
  ['supabase/functions/delete-account/index.ts', 'dpdp_deletion_requests'],
  ['supabase/functions/delete-account/index.ts', 'queued: true'],
  ['supabase/functions/delete-account/index.ts', 'Never hard-delete an account from this endpoint'],

  ['supabase/functions/dpdp-data-rights/index.ts', '"moderation_reports","site_feedback","notification_subscriptions"'],
  ['supabase/functions/dpdp-data-rights/index.ts', 'export reached the 5,000-row safety limit'],
  ['supabase/migrations/20261019083955_dpdp_privacy_controls_20261019.sql', 'auth_user_record_dpdp_signup_consent'],
  ['InfoPage.jsx', 'within 48 hours'],
  ['InfoPage.jsx', 'within one month'],
  ['InfoPage.jsx', 'Membership renews automatically'],
  ['Community.jsx', 'Comments for community post'],
  ['Community.jsx', "atma-open-community-comments"],
  ['Community.jsx', 'community-post-comments'],
  ['EnhancedComments.jsx', 'fetchCommunityPostComments'],
  ['EnhancedComments.jsx', "atma-open-community-comments"],
  ['EnhancedComments.jsx', 'communityPostId))load()'],
  ['engagement.js', 'export async function fetchCommunityPostComments'],
  ['engagement.js', 'community_post_id: hasCommunityPost ? communityPostId : null'],
  ['supabase/migrations/20261019084004_community_post_comments_20261019.sql', 'comments_community_post_id_fkey'],
  ['supabase/migrations/20261019084630_harden_dpdp_table_grants_20261019.sql', 'from anon, authenticated'],

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
  ['InfoPage.jsx', 'Website & Print (Working)'],
];

let failed = false;

const simplifiedPrivacySource = await readFile('PrivacyCenter.jsx', 'utf8');
if (/nominee|nomination|privacy-nomination-form/i.test(simplifiedPrivacySource)) {
  console.error('CHECK FAILED: nominee controls should be removed from the reader-facing Privacy page.');
  failed = true;
}
const simplifiedRightsHandler = await readFile('supabase/functions/dpdp-data-rights/index.ts', 'utf8');
if (/nominee|nomination|delete-nomination/i.test(simplifiedRightsHandler)) {
  console.error('CHECK FAILED: the privacy data-rights endpoint should not expose nomination actions.');
  failed = true;
}
const legalCopyRegression = await readFile('InfoPage.jsx', 'utf8');
if (!legalCopyRegression.includes('AI tools are part of the creative process') ||
    !legalCopyRegression.includes('Membership renews automatically') ||
    !legalCopyRegression.includes('within 48 hours') ||
    !legalCopyRegression.includes('within one month')) {
  console.error('CHECK FAILED: public About, Terms or complaint copy is missing a required clarification.');
  failed = true;
}

const feedbackSourceRegression = await readFile('FeedbackForm.jsx', 'utf8');
if (/\bflushQueue\s*\(/.test(feedbackSourceRegression) && !/\b(?:function|const|let|var)\s+flushQueue\b/.test(feedbackSourceRegression)) {
  console.error('CHECK FAILED: FeedbackForm references flushQueue without an implementation.');
  failed = true;
}

const feedbackQueueRegression = await readFile('FeedbackForm.jsx', 'utf8');
if (!feedbackQueueRegression.includes('enqueueFeedbackPayload(payload)') || !feedbackQueueRegression.includes('Your message is saved on this device')) {
  console.error('CHECK FAILED: Feedback form must persist offline submissions and show queue status.');
  failed = true;
}
const feedbackWorkerRegression = await readFile('public/sw.js', 'utf8');
if (!feedbackWorkerRegression.includes("event.data?.type === 'FLUSH_FEEDBACK_QUEUE'")) {
  console.error('CHECK FAILED: Service worker feedback queue flush message handler is missing.');
  failed = true;
}
const notificationScheduleRegression = await readFile('AdminOperations.jsx', 'utf8');
if (notificationScheduleRegression.includes('Save scheduled record') ||
    notificationScheduleRegression.includes('Schedule (optional)') ||
    notificationScheduleRegression.includes('scheduleAt')) {
  console.error('CHECK FAILED: Operations advertises notification scheduling without an active scheduler.');
  failed = true;
}

const engagementDisplayNameRegression = await readFile('engagement.js', 'utf8');
if (!engagementDisplayNameRegression.includes(".select('username,display_name')") || !engagementDisplayNameRegression.includes('data?.display_name')) {
  console.error('CHECK FAILED: Comment author names must fall back to the public display name, not only the username.');
  failed = true;
}
const appCommentRegression = await readFile('App.jsx', 'utf8');
if (appCommentRegression.includes("window.localStorage.getItem('atma-rekha-comment-name')") || appCommentRegression.includes('authorName: cleanName')) {
  console.error('CHECK FAILED: Comment composer must not display an ignored, user-controlled author-name field.');
  failed = true;
}
if (!appCommentRegression.includes("Sign in to post a comment.") || !appCommentRegression.includes("detail: { mode: 'login' }")) {
  console.error('CHECK FAILED: Comment action must open the sign-in panel when authentication is required.');
  failed = true;
}
const communityAuthRegression = await readFile('Community.jsx', 'utf8');
if (!communityAuthRegression.includes("detail:{mode:'login'}") || !communityAuthRegression.includes("if(!user){setNotice('Sign in to react.')")) {
  console.error('CHECK FAILED: Community reactions must offer sign-in when authentication is required.');
  failed = true;
}
const enhancedCommentsAuthRegression = await readFile('EnhancedComments.jsx', 'utf8');
if (!enhancedCommentsAuthRegression.includes("detail:{mode:'login'}") || !enhancedCommentsAuthRegression.includes("detail:{mode:'signup'}")) {
  console.error('CHECK FAILED: The newer comment sheet must open sign-in/sign-up rather than leave protected actions blocked.');
  failed = true;
}
const groupChatAuthRegression = await readFile('GroupChat.jsx', 'utf8');
if (!groupChatAuthRegression.includes('const promptSignIn=action=>') || !groupChatAuthRegression.includes("detail:{mode:'login'}") || !groupChatAuthRegression.includes('Sign in to join the conversation')) {
  console.error('CHECK FAILED: Group Chat must offer sign-in for sending, liking and reacting while logged out.');
  failed = true;
}
const communityShareRegression = await readFile('Community.jsx', 'utf8');
if (!communityShareRegression.includes('const copy=async post=>') || !communityShareRegression.includes('await navigator.clipboard.writeText(post.content)') || !communityShareRegression.includes('Could not copy this message on your device.')) {
  console.error('CHECK FAILED: Community Copy must await clipboard success and report failure accurately.');
  failed = true;
}
if (!communityShareRegression.includes('Message and link copied.') || !communityShareRegression.includes('if(navigator.share)')) {
  console.error('CHECK FAILED: Community Share must use native share or a working link-copy fallback.');
  failed = true;
}
if (communityShareRegression.includes("navigator.clipboard?.writeText(post.content);setNotice('Message copied.')")) {
  console.error('CHECK FAILED: Community must not claim a clipboard copy succeeded without awaiting it.');
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


const adminPaletteSource = await readFile('AdminCommandPalette.jsx', 'utf8');
const adminOperationsSource = await readFile('AdminOperations.jsx', 'utf8');
const adminHealthSource = await readFile('AdminChapterHealth.jsx', 'utf8');
const adminWorkspaceCss = await readFile('admin-workspace-ux.css', 'utf8');
const adminToolListeners = [
  ['atma-admin-open-health', 'AdminChapterHealth.jsx', '<AdminChapterHealth />'],
  ['atma-admin-open-operations', 'AdminOperations.jsx', '<AdminOperations />'],
  ['atma-admin-open-management', 'AdminManagementTools.jsx', '<AdminManagementTools />'],
  ['atma-admin-open-moderation', 'AdminModerationTools.jsx', '<AdminModerationTools />'],
  ['atma-admin-open-group-chat', 'AdminGroupChatTools.jsx', '<AdminGroupChatTools />'],
  ['atma-admin-open-pro', 'AdminProTools.jsx', '<AdminProTools />'],
  ['atma-admin-open-community', 'CommunityAdmin.jsx', '<CommunityAdmin />'],
];
for (const [eventName, sourceFile, mountTag] of adminToolListeners) {
  const componentSource = await readFile(sourceFile, 'utf8');
  const listenerPattern = new RegExp("(?:window\\.)?addEventListener\\(['\\\"]" + eventName + "['\\\"]");
  if (!listenerPattern.test(componentSource) || !adminPanelSource.includes(mountTag)) {
    console.error('CHECK FAILED: admin action has no mounted event handler:', eventName, sourceFile);
    failed = true;
  }
}
if (!adminPanelSource.includes("window.addEventListener('atma-admin-open-command', openPalette)")) {
  console.error('CHECK FAILED: Control Room command shortcuts cannot open the admin command palette.');
  failed = true;
}
if (adminPaletteSource.includes("id: 'tool-command'")) {
  console.error('CHECK FAILED: command palette contains a self-opening command action.');
  failed = true;
}
if (!adminPaletteSource.includes('window.requestAnimationFrame(() => window.requestAnimationFrame(')) {
  console.error('CHECK FAILED: chapter search can dispatch focus before the chapter manager mounts.');
  failed = true;
}
if (!adminPaletteSource.includes("id: 'tool-activity'") || !adminPanelSource.includes("label: 'Admin Activity Log'")) {
  console.error('CHECK FAILED: admin activity log is missing from quick navigation.');
  failed = true;
}
if (adminOperationsSource.includes('viewResult')) {
  console.error('CHECK FAILED: Operations references the stale/undefined viewResult variable.');
  failed = true;
}
if (adminOperationsSource.includes('scheduleAt') || adminOperationsSource.includes('Save scheduled record') || adminOperationsSource.includes('Schedule (optional)')) {
  console.error('CHECK FAILED: Operations still advertises the unsupported notification scheduler.');
  failed = true;
}
if (!adminHealthSource.includes('chapter.coverUrl || chapter.cover_url || chapter.cover')) {
  console.error('CHECK FAILED: Chapter Health does not recognize normalized chapter cover fields.');
  failed = true;
}
if (!adminPanelSource.includes("import './admin-workspace-ux.css';") ||
    !adminWorkspaceCss.includes('@media (max-width:760px)') ||
    !adminWorkspaceCss.includes('.admin-bottom-nav')) {
  console.error('CHECK FAILED: responsive admin workspace styles are not imported or missing the phone navigation layout.');
  failed = true;
}
if (!adminControlRoom.includes('Open {featureCatalog.length} tools') ||
    !adminControlRoom.includes('{featureCatalog.length} shortcuts')) {
  console.error('CHECK FAILED: admin workbench count and copy are not generated from the action catalogue.');
  failed = true;
}


const adminIconRegistrySource = await readFile('admin-redesign-ui.jsx', 'utf8');
const iconRegistryBlock = adminIconRegistrySource.split('const paths = {')[1]?.split('\n  };')[0] || '';
const registeredAdminIcons = new Set(
  [...iconRegistryBlock.matchAll(/^\s*(?:'([^']+)'|([A-Za-z][\w-]*))\s*:/gm)].map(match => match[1] || match[2])
);
const usedAdminIcons = new Set([
  ...[...adminPanelSource.matchAll(/\{ key: '[^']+', icon: '([^']+)'/g)].map(match => match[1]),
  ...[...adminControlRoom.matchAll(/icon:\s*'([^']+)'/g)].map(match => match[1]),
]);
const unsupportedAdminIcons = [...usedAdminIcons].filter(icon => !registeredAdminIcons.has(icon));
if (unsupportedAdminIcons.length) {
  console.error('CHECK FAILED: admin navigation/workbench uses unregistered icons:', unsupportedAdminIcons.join(', '));
  failed = true;
}
const navigationGroupSource = adminPanelSource.split('const ADMIN_NAV_GROUPS = [')[1]?.split('\n];')[0] || '';
const navigationKeys = [...navigationGroupSource.matchAll(/\{\s*key: '([^']+)'/g)]
  .map(match => match[1])
  .filter(key => !key.startsWith('__'));
const tabsDeclaration = adminPanelSource.match(/const tabs = \[([^\]]+)\];/);
const tabKeys = tabsDeclaration ? [...tabsDeclaration[1].matchAll(/'([^']+)'/g)].map(match => match[1]) : [];
const missingNavigationTabs = navigationKeys.filter(key => !tabKeys.includes(key));
if (!tabsDeclaration || missingNavigationTabs.length) {
  console.error('CHECK FAILED: admin navigation links do not resolve to declared tabs:', missingNavigationTabs.join(', '));
  failed = true;
}
if (failed) process.exit(1);
console.log('Atma Rekha production checks passed.');
