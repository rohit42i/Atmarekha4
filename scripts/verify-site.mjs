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
  ['InfoPage.jsx', 'AI tools assist selected parts of the visual workflow.'],
  ['InfoPage.jsx', 'AI-generated images are not published directly as finished comic pages.'],
  ['PrivacyPolicySections.jsx', '2. How we use your information'],
  ['PrivacyPolicySections.jsx', '5. Retention and account deletion'],
  ['InfoPage.jsx', 'className="legal-document-intro"'],
  ['InfoPage.css', 'font-family: Roboto, Arial, Helvetica, sans-serif;'],
  ['InfoPage.css', '.legal-document-sections .info-section h3'],
  ['index.html', 'family=Roboto:wght@400;500;600;700&display=swap'],
  ['theme-system.css', ':root[data-theme="dark"]'],
  ['theme-system.css', ':root[data-theme="light"]'],
  ['worker.js', 'https://atma-rekha-analytics.rohitbaswaraj.workers.dev'],
  ['scripts/generate-sitemap.mjs', 'STATIC_PATHS'],
  ['UserAuth.jsx', "from './formUX.js'"],
  ['ChapterDiscovery.jsx', '<div className="chapter-discovery">'],
  ['index.html', '<link rel="canonical" href="https://www.atmarekha.in/" />'],
  ['index.html', '<script type="application/ld+json" id="atma-rekha-site-schema">'],
  ['index.html', '<meta name="robots" content="index,follow'],
  ['public/robots.txt', 'Sitemap: https://www.atmarekha.in/sitemap.xml'],
  ['public/llms.txt', '> A fantasy adventure comic created by Arkesh Kaalvantik.'],
  ['public/llms.txt', 'Creator: Arkesh Kaalvantik'],
  ['public/llms-full.txt', '## Responsible answers'],
  ['public/llms-full.txt', 'YouTube https://www.youtube.com/@atmarekha'],
  ['public/llms.txt', 'Official profiles: Instagram https://www.instagram.com/atma.rekha/; YouTube https://www.youtube.com/@atmarekha.'],
  ['public/sitemap.xml', '<loc>https://www.atmarekha.in/chapter/special/intro-282d54fd</loc>'],
  ['public/sitemap.xml', '<loc>https://www.atmarekha.in/chapter/2</loc>'],
  ['scripts/generate-sitemap.mjs', "'/chapter/2'"],
  ['worker.js', '"/chapter/2"'],
  ['public/_headers', '/login*'],
  ['public/_headers', '/privacy-center*'],
  ['public/robots.txt', 'User-agent: OAI-SearchBot'],
  ['public/robots.txt', 'User-agent: Claude-SearchBot'],
  ['public/robots.txt', 'User-agent: PerplexityBot'],
  ['public/robots.txt', 'User-agent: GPTBot\nDisallow: /'],
  ['public/robots.txt', 'User-agent: Google-Extended\nDisallow: /'],
  ['public/robots.txt', 'User-agent: ClaudeBot\nDisallow: /'],
  ['index.html', '"@type":"ComicSeries"'],
  ['index.html', 'https://www.atmarekha.in/#creator'],
  ['App.jsx', 'function shortSeoTitle(value, fallback)'],
  ['App.jsx', "title = 'Atma Rekha | Chapter List';"],
  ['App.jsx', "title = 'Atma Rekha | Community';"],
  ['App.jsx', "title = 'Atma Rekha | Membership';"],
  ['App.jsx', "'@type': 'ComicIssue'"],
  ['InfoPage.jsx', '21 March 2025'],
  ['InfoPage.jsx', '25 April 2025'],
  ['InfoPage.jsx', '14 September 2026'],
  ['InfoPage.jsx', 'atmarekhasupport@gmail.com'],
  ['Footer.jsx', 'href="/info/contact"'],
  ['Footer.jsx', "{ label: 'Instagram', href: 'https://www.instagram.com/atma.rekha/', icon: 'instagram' },"],
  ['Footer.jsx', "{ label: 'YouTube', href: 'https://www.youtube.com/@atmarekha', icon: 'youtube' },"],
  ['InfoPage.jsx', "const YOUTUBE_URL = 'https://www.youtube.com/@atmarekha';"],
  ['InfoPage.jsx', "{ heading: 'YouTube', body: 'Watch official Atma Rekha videos and updates.'"],
  ['index.html', 'https://www.youtube.com/@atmarekha'],
  ['App.jsx', 'https://www.youtube.com/@atmarekha'],
  ['Footer.jsx', 'https://www.youtube.com/@atmarekha'],
  ['worker.js', 'function buildNoScriptFallback(path, url, chapters)'],
  ['worker.js', 'seo-no-script-content'],
  ['worker.js', '"@type": "ComicIssue"'],
  ['worker.js', 'login|signup|bookmarks|account'],
  ['public/llms.txt', 'The project idea dates to 21 March 2025'],
  ['public/llms-full.txt', 'The project idea dates to 21 March 2025'],
  ['App.jsx', "const DEFAULT_SEO_TITLE = 'Atma Rekha | Fantasy Adventure Comic';"],
  ['App.jsx', "const DEFAULT_SEO_DESCRIPTION = 'Explore Atma Rekha, a fantasy adventure comic where missing memories and mysterious powers lead to a larger mystery.';"],
  ['App.jsx', "upsertMeta('name', 'author', 'Arkesh Kaalvantik');"],
  ['worker.js', 'const shareTitle = seoTitle(chapterListSeo?.[0] || "Atma Rekha | Fantasy Adventure Comic"'],
  ['worker.js', 'const shareDescription = chapterListSeo?.[1] || "Explore Atma Rekha, a fantasy adventure comic where missing memories and mysterious powers lead to a larger mystery."'],
  ['scripts/test-worker-seo.mjs', 'Homepage Open Graph description is outdated.'],
  ['scripts/generate-sitemap.mjs', "'/info/about'"],
  ['scripts/generate-sitemap.mjs', "'/info/terms'"],
  ['scripts/generate-sitemap.mjs', "'/info/privacy'"],
  ['scripts/generate-sitemap.mjs', "'/info/contact'"],
  ['scripts/generate-sitemap.mjs', "'/pal-do-pal-ke-lamhe'"],
  ['public/.well-known/security.txt', 'Contact: mailto:atmarekhasupport@gmail.com'],
  ['public/.well-known/security.txt', 'Canonical: https://www.atmarekha.in/.well-known/security.txt'],
  ['notification-prompt.js', 'if (stored === null || stored.trim() === \'\') return fallback;'],
  ['notification-prompt.js', 'FIRST_REPEAT_AT_TOTAL_SECONDS = 30 * 60 * 60'],
  ['notification-prompt.js', 'function migratePromptSchedule()'],
  ['notification-prompt.js', "localStorage.setItem(SCHEDULE_VERSION_KEY, '3')"],
  ['notification-prompt.js', "atma-notification-dont-show-again"],
  ['notification-prompt.js', "Don't show this again"],
  ['ProfileV2.jsx', 'emailRedirectTo: window.location.origin'],
  ['UserAuth.jsx', "dpdp_privacy_consent_version:'2026-10-25'"],
  ['supabase/functions/dpdp-data-rights/index.ts', 'Use the password and email verification flow in Privacy Center to request account deletion.'],
  ['ProfileV2.jsx', 'Your profile details were saved, but the email change failed:'],
  ['PrivacyCenter.jsx', '14-day recovery window starts after email verification.'],
  ['PrivacyCenter.jsx', 'Confirm your password first.'],
  ['PrivacyCenter.jsx', 'Confirm deletion request'],
  ['PrivacyCenter.jsx', 'Cancel deletion and recover account'],
  ['PrivacyCenter.jsx', 'some categories may be incomplete or could not be retrieved'],
  ['InfoPage.css', '.privacy-controls-grid'],
  ['InfoPage.css', 'html[data-theme="dark"] .privacy-control-button'],
  ['supabase/migrations/20261025150000_fix_admin_read_permissions_and_feature_login.sql', 'Published announcements are publicly readable'],
  ['supabase/migrations/20261025150000_fix_admin_read_permissions_and_feature_login.sql', 'Published manga series are publicly readable'],
  ['supabase/migrations/20261025150000_fix_admin_read_permissions_and_feature_login.sql', 'security definer'],
  ['supabase/migrations/20261025150000_fix_admin_read_permissions_and_feature_login.sql', 'public_badge, created_at'],
  ['supabase/migrations/20261019084630_harden_dpdp_table_grants_20261019.sql', 'revoke insert, update, delete, truncate, references, trigger'],
  ['PrivacyCenter.jsx', "deletion?.status === 'pending' || deletion?.status === 'processing'"],
  ['PrivacyRequestsAdmin.jsx', 'admin-list-deletion-requests'],
  ['PrivacyRequestsAdmin.jsx', 'Mark erased & resolved'],
  ['AdminPanel.jsx', 'data-admin-theme={adminTheme}'],
  ['AdminPanel.jsx', 'hasUtilityRail'],
  ['AdminPanel.jsx', 'ar-admin-poppins-font'],
  ['AdminPanel.jsx', 'dark-theme-variables'],
  ['AdminUtilityRail.jsx', 'aria-label="Dashboard overview and quick actions"'],
  ['AdminUtilityRail.jsx', 'strokeDashoffset={offset}'],
  ['AdminUtilityRail.jsx', 'Content health'],
  ['admin-master-system.css', 'grid-template-columns:252px minmax(390px,1fr) 23rem'],
  ['admin-master-system.css', '@media (max-width: 980px)'],
  ['admin-master-system.css', 'body.dark-theme-variables main.admin-page.ar-admin-v3'],
  ['worker.js', 'https://fonts.googleapis.com'],
  ['worker.js', 'https://fonts.gstatic.com'],
  ['public/_headers', 'https://fonts.googleapis.com'],
  ['public/_headers', 'https://fonts.gstatic.com'],
  ['admin-master-system.css', 'main.admin-page.ar-admin-v3[data-admin-theme="dark"]'],
  ['AdminPanel.jsx', "key: 'Privacy Requests'"],
  ['supabase/functions/get-admin-console-data/index.ts', 'community_post_id,parent_comment_id,created_at'],
  ['AdminControlRoom.jsx', "action: 'dashboard-inventory'"],
  ['AdminControlRoom.jsx', 'const cloudViewsAvailable = cloudAnalyticsAvailable'],
  ['AdminControlRoom.jsx', 'const cloudReadersAvailable = cloudAnalyticsAvailable'],
  ['AdminOverview.jsx', "Number(previous) > 0"],
  ['AdminOverview.jsx', 'views_unavailable: !hasCloudflareViews'],
  ['AdminOverview.jsx', 'const chapterIds = new Set(['],
  ['AdminOverview.jsx', 'const baseChapterStatsById = new Map(baseChapterStats.map(row => [String(row.id), row]));'],
  ['AdminControlRoom.jsx', 'const cloudChapterStatsById = new Map((cloud.chapter_stats || []).map(row => [String(row.id), row]));'],
  ['AdminControlRoom.jsx', 'Include every chapter in the catalogue'],
  ['AdminOverview.jsx', 'Analytics could not be loaded.'],
  ['AdminOverview.jsx', 'viewsAvailable={!metrics.viewsUnavailable}'],
  ['supabase/functions/dpdp-data-rights/index.ts', 'admin-update-deletion-request'],
  ['supabase/functions/dpdp-data-rights/index.ts', 'export_warnings'],
  ['supabase/functions/delete-account/index.ts', 'ACCOUNT_DELETION_VERIFICATION_REQUIRED'],
  ['supabase/functions/delete-account/index.ts', 'This endpoint is retired.'],
  ['supabase/functions/account-deletion-workflow/index.ts', 'confirm-delete-otp'],
  ['supabase/functions/account-deletion-workflow/index.ts', 'confirm-reactivate-otp'],
  ['supabase/functions/account-deletion-workflow/index.ts', 'otpDigest'],
  ['supabase/functions/account-deletion-workflow/index.ts', 'if (!consumedVerification)'],
  ['supabase/functions/account-deletion-workflow/index.ts', 'invalidateError'],
  ['supabase/functions/account-deletion-workflow/index.ts', 'status: "cancelled"'],
  ['supabase/migrations/20261023190000_account_deletion_otp_recovery.sql', 'account_deletion_one_unused_otp_per_user_purpose'],
  ['supabase/migrations/20261023190000_account_deletion_otp_recovery.sql', "'cancelled'"],

  ['supabase/functions/dpdp-data-rights/index.ts', '"dpdp_nominations","email_marketing_preferences","feature_login_users"'],
  ['supabase/functions/dpdp-data-rights/index.ts', '"moderation_reports","notification_preferences","site_feedback"'],
  ['supabase/functions/dpdp-data-rights/index.ts', 'email_marketing_preferences: "user_id,marketing_unsubscribed,updated_at"'],
  ['supabase/functions/dpdp-data-rights/index.ts', 'export reached the 100,000-row safety limit'],
  ['supabase/migrations/20261019083955_dpdp_privacy_controls_20261019.sql', 'auth_user_record_dpdp_signup_consent'],
  ['InfoPage.jsx', 'Report a problem'],
  ['TermsOfUseSections.jsx', 'Membership renews automatically'],
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
  ['worker.js', 'searchParams.set("status", "ilike.published");'],
  ['scripts/generate-sitemap.mjs', "url.searchParams.set('status', 'ilike.published');"],
  ['scripts/generate-sitemap.mjs', 'application/json'],
  ['public/_headers', '/profile*'],
  ['public/_headers', 'X-Robots-Tag: noindex, nofollow, noarchive'],
  ['MorePage.jsx', 'Notification preferences'],
  ['MorePage.jsx', 'notification_preferences'],
  ['MorePage.jsx', 'comments_replies'],
  ['MorePage.jsx', 'other_updates'],
  ['App.jsx', 'data-reader-background="dark"'],
  ['App.jsx', 'data-reader-fit="width"'],
  ['reader-performance.css', 'data-reader-fit="width"'],
  ['supabase/migrations/20261019120000_reader_notification_preferences.sql', 'Readers can view own notification preferences'],
  ['supabase/functions/send-chapter-notification-v2/index.ts', 'notification_preferences'],
  ['supabase/functions/send-chapter-notification-v2/index.ts', 'allowedTypes'],
  ['AdminManagementTools.jsx', 'Readers who disabled this category will be skipped.'],
  ['AdminOperations.jsx', 'notificationType'],
  ['AdminOperations.jsx', 'PUBLISHING CALENDAR'],
  ['AdminOperations.jsx', 'Access simulator'],
  ['AdminOperations.jsx', 'SUSPICIOUS ACTIVITY'],
  ['AdminOperations.jsx', 'Email send monitor'],
  ['AdminManagementTools.jsx', 'Joined in last 30 days'],
  ['AdminChapterHealth.jsx', 'function probeImage(url)'],
  ['AdminChapterHealth.jsx', 'View failed image URLs'],
  ['AdminChapterHealth.jsx', 'runSiteLinkCheck'],
  ['AdminOperations.jsx', 'PDPKL requires Premium Supporter'],
  ['AdminPanel.jsx', 'eventType: \'new_chapters\''],
  ['AdminChapterManager.jsx', 'Readers with new-chapter notifications enabled will be notified.'],
  ['AdminOperations.jsx', 'Retry deletion of these stored media files'],
  ['engagement.js', "eventType: 'comments_replies'"],
  ['GroupChat.jsx', "eventType:'group_chat'"],
  ['CommunityAdmin.jsx', "eventType:'community_posts'"],
  ['supabase/functions/send-reader-event-notification/index.ts', 'notification_event_dispatches'],
  ['supabase/functions/send-reader-event-notification/index.ts', 'notification_preferences'],
  ['supabase/functions/resend-email-webhook/index.ts', 'new Webhook(secret).verify'],
  ['supabase/functions/resend-email-webhook/index.ts', 'email_delivery_events'],
  ['supabase/migrations/20261019160000_email_delivery_events.sql', 'Admins can view email delivery events'],
  ['supabase/migrations/20261019161000_notification_event_dispatches.sql', 'unique (event_type, event_id)'],
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

const seoSitemapRegression = await readFile('public/sitemap.xml', 'utf8');
const sitemapOpenUrlCount = (seoSitemapRegression.match(/<url>/g) || []).length;
const sitemapCloseUrlCount = (seoSitemapRegression.match(/<\/url>/g) || []).length;
if (!seoSitemapRegression.startsWith('<?xml') ||
    !seoSitemapRegression.includes('<urlset ') ||
    !seoSitemapRegression.trim().endsWith('</urlset>') ||
    sitemapOpenUrlCount !== sitemapCloseUrlCount ||
    /(?:<loc>https:\/\/www\.atmarekha\.in\/(?:admin|profile|membership|group-chat|privacy-center)(?:\/|<\/loc>))/i.test(seoSitemapRegression)) {
  console.error('CHECK FAILED: the sitemap must be well-formed and contain canonical public pages without private account routes.');
  failed = true;
}


const seoWorkerSource = await readFile('worker.js', 'utf8');
const aboutSource = await readFile('InfoPage.jsx', 'utf8');
const seoAppSource = await readFile('App.jsx', 'utf8');
if (!seoWorkerSource.includes('function buildNoScriptFallback') ||
    !seoWorkerSource.includes('seo-no-script-content') ||
    !seoWorkerSource.includes('"@type": "ComicIssue"') ||
    !seoAppSource.includes("function shortSeoTitle(value, fallback)")) {
  console.error('CHECK FAILED: route metadata, no-script crawlable content, or chapter ComicIssue schema is missing.');
  failed = true;
}
if (!aboutSource.includes('21 March 2025') || !aboutSource.includes('25 April 2025') ||
    !aboutSource.includes('14 September 2026') || !aboutSource.includes('Hindi written in Roman script and English')) {
  console.error('CHECK FAILED: About page is missing the creator, language, or verified publication timeline.');
  failed = true;
}
const publicRobotRules = await readFile('public/robots.txt', 'utf8');
for (const privateRoute of ['Disallow: /login', 'Disallow: /profile', 'Disallow: /membership', 'Disallow: /community']) {
  if (publicRobotRules.includes(privateRoute)) {
    console.error('CHECK FAILED: robots.txt blocks a private route that must remain crawlable for noindex headers:', privateRoute);
    failed = true;
  }
}


const footerSocialRegression = await readFile('Footer.jsx', 'utf8');
const socialArray = footerSocialRegression.match(/const SOCIAL_LINKS = \[[\s\S]*?\];/)?.[0] || '';
const socialHrefs = [...socialArray.matchAll(/href:\s*'([^']+)'/g)].map((match) => match[1]).sort();
const expectedSocialHrefs = [
  'https://www.instagram.com/atma.rekha/',
  'https://www.youtube.com/@atmarekha',
].sort();
if (!socialArray.includes('Instagram') || !socialArray.includes('YouTube') ||
    JSON.stringify(socialHrefs) !== JSON.stringify(expectedSocialHrefs)) {
  console.error('CHECK FAILED: footer social links must contain only the official Instagram and YouTube accounts.');
  failed = true;
}

const signupEmailUpdatesRegression = await readFile('UserAuth.jsx', 'utf8');
if (!signupEmailUpdatesRegression.includes("'atma_rekha_updates','chapter_announcements'") || signupEmailUpdatesRegression.includes("'marketing_email','chapter_announcements'") ||
    !signupEmailUpdatesRegression.includes('Email updates are enabled by default when you create an account.') ||
    !signupEmailUpdatesRegression.includes('More &amp; Settings → Notification preferences')) {
  console.error('CHECK FAILED: Signup must enable email updates by default and disclose how readers can turn them off.');
  failed = true;
}
if (!signupEmailUpdatesRegression.includes('if(data.session?.user?.id)') ||
    !signupEmailUpdatesRegression.includes("await supabase.functions.invoke('resend-contact-sync')") ||
    !signupEmailUpdatesRegression.includes('Resend contact sync did not complete; it will retry on a later sign-in.')) {
  console.error('CHECK FAILED: Contact syncing must wait for an authenticated session and retry after sign-in.');
  failed = true;
}
const morePagePreferenceRegression = await readFile('MorePage.jsx', 'utf8');
if (morePagePreferenceRegression.includes('Reader customization') || morePagePreferenceRegression.includes('readerSettingsOpen')) {
  console.error('CHECK FAILED: Reader customization must not appear in More & Settings.');
  failed = true;
}
if (!morePagePreferenceRegression.includes('Email updates') ||
    !morePagePreferenceRegression.includes('update-chapter-email-preference') ||
    !morePagePreferenceRegression.includes('prefsLoadFailed') ||
    !morePagePreferenceRegression.includes("authData?.user?.id !== user.id") ||
    !morePagePreferenceRegression.includes(".select('preferences')") ||
    !morePagePreferenceRegression.includes('Preferences saved. They apply to future notification alerts.')) {
  console.error('CHECK FAILED: Notification preferences must handle load errors, verify the signed-in user, and confirm persisted values.');
  failed = true;
}
const chapterReleaseEmailRetryRegression = await readFile('supabase/functions/send-reader-event-notification/index.ts', 'utf8');
if (!chapterReleaseEmailRetryRegression.includes('Partial sends are not retried automatically') ||
    !chapterReleaseEmailRetryRegression.includes('.eq("status", "failed").eq("sent_count", 0)') ||
    !chapterReleaseEmailRetryRegression.includes('if (existing.status !== "failed" || Number(existing.sent_count || 0) !== 0)')) {
  console.error('CHECK FAILED: chapter release emails must retry only failed zero-send dispatches.');
  failed = true;
}
if (!chapterReleaseEmailRetryRegression.includes('const subject = `${chapterLabel} is now out!`;') ||
    chapterReleaseEmailRetryRegression.includes('.eq("id", dispatch.id);')) {
  console.error('CHECK FAILED: chapter announcements must use a chapter-specific subject and notification dispatch status updates must use the claimed dispatch ID.');
  failed = true;
}
const razorpayWebhookRetryRegression = await readFile('supabase/functions/razorpay-subscription-webhook/index.ts', 'utf8');
if (!razorpayWebhookRetryRegression.includes("if (!record) throw new Error('Razorpay subscription record not found for webhook event.')") ||
    !razorpayWebhookRetryRegression.includes('Razorpay subscription lookup failed:') ||
    !razorpayWebhookRetryRegression.includes('Could not check Razorpay event idempotency:') ||
    razorpayWebhookRetryRegression.indexOf("if (!record) throw new Error('Razorpay subscription record not found for webhook event.')") >
      razorpayWebhookRetryRegression.indexOf("await admin.from('payment_events').insert")) {
  console.error('CHECK FAILED: Razorpay subscription webhooks must remain retryable until the local subscription is updated.');
  failed = true;
}
const adminNotificationRetryRegression = await readFile('supabase/functions/send-chapter-notification-v2/index.ts', 'utf8');
if (!adminNotificationRetryRegression.includes("['failed','no_subscribers'].includes(String(existing.status||''))") ||
    !adminNotificationRetryRegression.includes(".in('status',['failed','no_subscribers']).eq('sent_count',0)") ||
    !adminNotificationRetryRegression.includes("Sent/partial/sending rows remain blocked")) {
  console.error('CHECK FAILED: admin push notifications must retry only zero-send failures and preserve deduplication.');
  failed = true;
}
const readerEventRetryRegression = await readFile('supabase/functions/send-reader-event-notification/index.ts', 'utf8');
if (!readerEventRetryRegression.includes('existingDispatch.status !== "failed"') ||
    !readerEventRetryRegression.includes('.eq("status", "failed").eq("sent_count", 0)') ||
    !readerEventRetryRegression.includes('sentDuringDispatch > 0 ? "partial" : "failed"')) {
  console.error('CHECK FAILED: notification dispatches must safely retry zero-send failures without duplicating partial deliveries.');
  failed = true;
}
const emailStudioLoadRegression = await readFile('EmailStudio.jsx', 'utf8');
const emailStudioLoadStart = emailStudioLoadRegression.indexOf('const load = async () => {');
const emailStudioLoadEnd = emailStudioLoadRegression.indexOf('setLoadingRecipients(true);', emailStudioLoadStart);
const emailStudioLoadBlock = emailStudioLoadRegression.slice(emailStudioLoadStart, emailStudioLoadEnd);
if (emailStudioLoadStart < 0 ||
    emailStudioLoadEnd < 0 ||
    emailStudioLoadBlock.indexOf("setTemplates(nextTemplates)") < 0 ||
    emailStudioLoadBlock.indexOf("setTemplates(nextTemplates)") > emailStudioLoadBlock.indexOf("const historyResult") ||
    !emailStudioLoadBlock.includes("Email templates loaded, but campaign history is unavailable:")) {
  console.error('CHECK FAILED: Email Studio template loading must survive a campaign-history query failure.');
  failed = true;
}
const emailStudioRegression = await readFile('EmailStudio.jsx', 'utf8');
const emailStudioFunctionRegression = await readFile('supabase/functions/resend-email-studio/index.ts', 'utf8');
if (!emailStudioRegression.includes("const effectiveCategory = isChapterTemplate ? 'updates' : draft.category;") ||
    !emailStudioFunctionRegression.includes('const category = templateSlug === "new-chapter" ? "updates" : requestedCategory;') ||
    !emailStudioFunctionRegression.includes('marketing_opted_out') || !emailStudioFunctionRegression.includes('updates_consented')) {
  console.error('CHECK FAILED: Chapter announcements must use the reader-updates preference and respect opt-outs.');
  failed = true;
}
if (!emailStudioFunctionRegression.includes('const subjectSource = cleanText(input.subject || template?.subject, 200);') ||
    !emailStudioFunctionRegression.includes('font-family:Roboto,Arial,Helvetica,sans-serif;font-weight:500') ||
    emailStudioFunctionRegression.includes('background-color:#f3f3f3') ||
    emailStudioFunctionRegression.includes('ATMA REKHA · <a href="https://www.atmarekha.in/"') ||
    !emailStudioFunctionRegression.includes('announcement_body: cleanText(variables.announcement_body, 2000)') ||
    !emailStudioFunctionRegression.includes('chapterUrl = SITE_URL;') ||
    !emailStudioRegression.includes('variables: isChapterTemplate ? chapter : extraVariables') ||
    !emailStudioRegression.includes('visibleExtraVariables.map(field =>') ||
    emailStudioRegression.includes('placeholder="https://www.atmarekha.in/chapter/1"')) {
  console.error('CHECK FAILED: Email Studio must honor editable subjects, render custom values, use the clean full-width email layout, and use the homepage for chapter announcements.');
  failed = true;
}
const emailPreferencePersistenceRegression = await readFile('supabase/functions/update-chapter-email-preference/index.ts', 'utf8');
if ((emailPreferencePersistenceRegression.match(/from\("email_marketing_preferences"\)\.upsert/g) || []).length < 2 ||
    emailPreferencePersistenceRegression.includes('from("email_marketing_preferences").update')) {
  console.error('CHECK FAILED: enabling and disabling email updates must persist preferences even when no row exists yet.');
  failed = true;
}
const resendContactSyncRegression = await readFile('supabase/functions/resend-contact-sync/index.ts', 'utf8');
const resendContactBackfillRegression = await readFile('supabase/functions/resend-contact-backfill/index.ts', 'utf8');
const emailAudienceStudioRegression = await readFile('EmailStudio.jsx', 'utf8');
if (resendContactSyncRegression.includes('RESEND_CONTACTS_API_KEY') ||
    resendContactBackfillRegression.includes('RESEND_CONTACTS_API_KEY') ||
    resendContactSyncRegression.includes('api.resend.com/contacts') ||
    resendContactBackfillRegression.includes('api.resend.com/contacts') ||
    !resendContactSyncRegression.includes('sourceOfTruth: "supabase"') ||
    !resendContactBackfillRegression.includes('mode: "database_source_of_truth"') ||
    !emailAudienceStudioRegression.includes('Check email audience') ||
    !emailAudienceStudioRegression.includes('duplicate Resend contacts are not required') ||
    !resendContactSyncRegression.includes('replace(/^Bearer\\s+/i') ||
    !resendContactBackfillRegression.includes('replace(/^Bearer\\s+/i') ||
    !emailPreferencePersistenceRegression.includes('replace(/^Bearer\\s+/i')) {
  console.error('CHECK FAILED: email audience eligibility must use Supabase consent/preferences without a privileged Resend Contacts key and must parse bearer tokens correctly.');
  failed = true;
}
const legacyBulkEmailRegression = await readFile('supabase/functions/send-email-to-users/index.ts', 'utf8');
if (!legacyBulkEmailRegression.includes('if (!testEmail)') ||
    !legacyBulkEmailRegression.includes('Bulk sending through this legacy endpoint is disabled') ||
    !legacyBulkEmailRegression.includes('}, 410);')) {
  console.error('CHECK FAILED: legacy bulk email must not bypass the consent-aware Email Studio sender.');
  failed = true;
}
const unsubscribeOneClickRegression = await readFile('supabase/functions/email-unsubscribe/index.ts', 'utf8');
const emailStudioUnsubscribeRegression = await readFile('supabase/functions/resend-email-studio/index.ts', 'utf8');
const chapterReleaseUnsubscribeRegression = await readFile('supabase/functions/send-reader-event-notification/index.ts', 'utf8');
if (!unsubscribeOneClickRegression.includes('req.method !== "GET" && req.method !== "POST"') ||
    !unsubscribeOneClickRegression.includes('new URLSearchParams(body).get("List-Unsubscribe") !== "One-Click"') ||
    !unsubscribeOneClickRegression.includes('marketing_unsubscribed: true') ||
    !emailStudioUnsubscribeRegression.includes('"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"') ||
    !chapterReleaseUnsubscribeRegression.includes('"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"')) {
  console.error('CHECK FAILED: update email one-click unsubscribe must use a validated POST and persist the reader opt-out.');
  failed = true;
}

const privacyExportPreferencesRegression = await readFile('supabase/functions/dpdp-data-rights/index.ts', 'utf8');
if (!privacyExportPreferencesRegression.includes('notification_preferences') ||
    !privacyExportPreferencesRegression.includes('dpdp_nominations') ||
    !privacyExportPreferencesRegression.includes('email_marketing_preferences') ||
    !privacyExportPreferencesRegression.includes('email_marketing_preferences: "user_id,marketing_unsubscribed,updated_at"') ||
    privacyExportPreferencesRegression.includes('email_marketing_preferences: "user_id,marketing_unsubscribed,updated_at,unsubscribe_token"')) {
  console.error('CHECK FAILED: data export must include notification and email preference state without exposing unsubscribe bearer tokens.');
  failed = true;
}
const mfaCodeRegression = await readFile('MfaGate.jsx', 'utf8');
if (!mfaCodeRegression.includes("/^\\d{6}$/.test(cleanCode)") ||
    !mfaCodeRegression.includes("maxLength={6}") ||
    !mfaCodeRegression.includes("disabled={verifying || !/^\\d{6}$/.test(code)}")) {
  console.error('CHECK FAILED: authenticator verification must accept exactly six numeric digits.');
  failed = true;
}
const emailChangeRequestsMigration = await readFile('supabase/migrations/20261023071335_admin_email_change_requests.sql', 'utf8');
if (!emailChangeRequestsMigration.includes('create table if not exists public.email_change_requests') ||
    !emailChangeRequestsMigration.includes('create table if not exists public.email_change_request_events') ||
    !emailChangeRequestsMigration.includes('Readers can submit own email change requests') ||
    !emailChangeRequestsMigration.includes('Admins can view email change request history')) {
  console.error('CHECK FAILED: email-change tracking must use owner-scoped RLS and server-only audit writes.');
  failed = true;
}
const adminEmailChangeToolsRegression = await readFile('AdminManagementTools.jsx', 'utf8');
const adminProfileEmailChangeRegression = await readFile('ProfileV2.jsx', 'utf8');
const adminEmailChangeResendRegression = await readFile('supabase/functions/send-email-to-users/index.ts', 'utf8');
const adminEmailChangeDataRegression = await readFile('supabase/functions/get-admin-console-data/index.ts', 'utf8');
if (!adminEmailChangeToolsRegression.includes("view==='emailChanges'") ||
    !adminEmailChangeToolsRegression.includes('resend_email_change_confirmation') ||
    !adminProfileEmailChangeRegression.includes("from('email_change_requests')") ||
    !adminEmailChangeResendRegression.includes('email_change_current') ||
    !adminEmailChangeResendRegression.includes('email_change_new') ||
    !adminEmailChangeDataRegression.includes('if (action === "email_change_requests")') ||
    !adminEmailChangeResendRegression.includes('RESEND_FROM_EMAIL')) {
  console.error('CHECK FAILED: secure email-change workflow needs tracked requests, dual-address verification and admin audit history.');
  failed = true;
}
const signupVerificationAdminRegression = await readFile('supabase/functions/send-email-to-users/index.ts', 'utf8');
if (!signupVerificationAdminRegression.includes('if (action === "resend_signup_verification")') ||
    !signupVerificationAdminRegression.includes('authMailer.auth.resend({') ||
    !signupVerificationAdminRegression.includes('target.email_confirmed_at') ||
    !signupVerificationAdminRegression.includes('resend_signup_verification')) {
  console.error('CHECK FAILED: admin resend must use Supabase Auth resend for existing unverified accounts and refuse already-verified users.');
  failed = true;
}
const adminReaderDetailUiRegression = await readFile('AdminManagementTools.jsx', 'utf8');
const adminReaderDetailApiRegression = await readFile('supabase/functions/get-admin-console-data/index.ts', 'utf8');
if (!adminReaderDetailUiRegression.includes('function ReaderDetailsPanel') ||
    !adminReaderDetailUiRegression.includes("onClick={()=>loadUserDetails(u)}") ||
    !adminReaderDetailUiRegression.includes("action:'user-details',user_id:reader.id") ||
    !adminReaderDetailApiRegression.includes('if (action === "user-details")') ||
    !adminReaderDetailApiRegression.includes('Reader account not found.') ||
    !adminReaderDetailApiRegression.includes('community_reactions: communityReactions')) {
  console.error('CHECK FAILED: admin reader details must load through the protected admin data function and show a bounded activity summary.');
  failed = true;
}
const privacyCenterRegression = await readFile('PrivacyCenter.jsx', 'utf8');
if (!privacyCenterRegression.includes('const refreshStatus = async () =>') ||
    !privacyCenterRegression.includes("setMessage('Privacy request status is up to date.')") ||
    !privacyCenterRegression.includes("requestByEmail(") ||
    !privacyCenterRegression.includes('Please review my Atma Rekha account')) {
  console.error('CHECK FAILED: privacy centre must refresh request state and provide a review path when consent is missing.');
  failed = true;
}
const privacyAdminRegression = await readFile('PrivacyRequestsAdmin.jsx', 'utf8');
if (!privacyAdminRegression.includes('resolutionNotes[request.id]') ||
    !privacyAdminRegression.includes('privacy-admin-resolution-field') ||
    privacyAdminRegression.includes('window.prompt(')) {
  console.error('CHECK FAILED: privacy deletion resolution must use a validated inline note form, not browser prompts.');
  failed = true;
}

const deletionProcessorSource = await readFile('supabase/functions/process-scheduled-account-deletions/index.ts', 'utf8');
const deletionMigrationSource = await readFile('supabase/migrations/20261023190000_account_deletion_otp_recovery.sql', 'utf8');
const privacyRightsSource = await readFile('supabase/functions/dpdp-data-rights/index.ts', 'utf8');
const privacyAdminQueueSource = await readFile('PrivacyRequestsAdmin.jsx', 'utf8');
if (!deletionProcessorSource.includes('.lte("scheduled_delete_at", now)') ||
    !deletionProcessorSource.includes('.lte("recovery_until", now)') ||
    !deletionProcessorSource.includes('erase_due_account_personal_data') ||
    !deletionProcessorSource.includes('cancel_at_period_end: true') ||
    !deletionProcessorSource.includes('Legacy subscription expiry date is unknown.') ||
    !deletionProcessorSource.includes('https://api.resend.com/contacts/') ||
    !deletionProcessorSource.includes('Email-provider contact cleanup failed.') ||
    !deletionMigrationSource.includes('function public.erase_due_account_personal_data') ||
    !deletionMigrationSource.includes('delete from public.login_password_protection') ||
    !deletionMigrationSource.includes('update public.notification_event_dispatches set sender_user_id = null') ||
    !privacyRightsSource.includes('Scheduled deletions can only be closed by the verified erasure processor.') ||
    !privacyAdminQueueSource.includes('process-scheduled-account-deletions') ||
    !privacyAdminQueueSource.includes('Run due erasures') ||
    !privacyAdminQueueSource.includes('Automated erasure in progress')) {
  console.error('CHECK FAILED: scheduled deletion must verify both deadlines, retain billing history, and finalize through the protected processor.');
  failed = true;
}
const deletionRecoveryPromptSource = await readFile('AccountDeletionRecoveryPrompt.jsx', 'utf8');
const userAuthRecoveryMount = await readFile('UserAuth.jsx', 'utf8');
if (!userAuthRecoveryMount.includes("import AccountDeletionRecoveryPrompt from './AccountDeletionRecoveryPrompt.jsx';") ||
    !userAuthRecoveryMount.includes('<AccountDeletionRecoveryPrompt/>') ||
    !deletionRecoveryPromptSource.includes("event === 'SIGNED_IN'") ||
    !deletionRecoveryPromptSource.includes("action: 'send-reactivate-otp'") ||
    !deletionRecoveryPromptSource.includes("action: 'confirm-reactivate-otp'") ||
    !deletionRecoveryPromptSource.includes('You signed in while a deletion request was still recoverable.')) {
  console.error('CHECK FAILED: signing in during the recovery window must offer OTP-protected cancellation without blocking login.');
  failed = true;
}
if (!privacyCenterRegression.includes('scheduled_delete_at') ||
    !privacyCenterRegression.includes('recovery_until') ||
    !privacyCenterRegression.includes("action: 'confirm-delete-otp'") ||
    !privacyCenterRegression.includes("action: 'confirm-reactivate-otp'")) {
  console.error('CHECK FAILED: Privacy Center must show deletion timing and use the OTP-confirmed deletion/recovery flow.');
  failed = true;
}
if (!privacyAdminRegression.includes('request.requested_period') ||
    !privacyAdminRegression.includes('Run due erasures') ||
    !privacyAdminRegression.includes('Automated erasure in progress') ||
    !privacyAdminRegression.includes('process-scheduled-account-deletions')) {
  console.error('CHECK FAILED: admin privacy queue must show schedule details and provide a protected retry for due erasures.');
  failed = true;
}

const adminViewCountRegression = await readFile('AdminOverview.jsx', 'utf8');
const controlRoomViewCountRegression = await readFile('AdminControlRoom.jsx', 'utf8');
if (!adminViewCountRegression.includes('const hasViewCounts = hasCloudflareViews;') ||
    !adminViewCountRegression.includes('views: hasCloudflareViews ? Number(cloud?.views || 0) : null') ||
    !adminViewCountRegression.includes('views_unavailable: !hasCloudflareViews') ||
    adminViewCountRegression.includes('const hasFallbackViews =') ||
    !controlRoomViewCountRegression.includes('const viewCountsAvailable = cloudViewsAvailable;') ||
    !controlRoomViewCountRegression.includes('const currentViews = cloudViewsAvailable ? asNumber(cloud.current_views) : null;') ||
    controlRoomViewCountRegression.includes('const fallbackViewsAvailable =')) {
  console.error('CHECK FAILED: admin dashboards must use Cloudflare/R2 as the authoritative view source and hide view counts when that source is unavailable.');
  failed = true;
}
const readerViewKeyRegression = await readFile('engagement.js', 'utf8');
const viewerKeyStart = readerViewKeyRegression.indexOf('export function getViewerKey() {');
const viewerKeyEnd = readerViewKeyRegression.indexOf('\n}', viewerKeyStart) + 2;
const viewerKeyBlock = readerViewKeyRegression.slice(viewerKeyStart, viewerKeyEnd);
if (viewerKeyStart < 0 ||
    viewerKeyEnd < 2 ||
    !viewerKeyBlock.includes('window.localStorage.getItem(VIEWER_KEY_STORAGE)') ||
    !viewerKeyBlock.includes('catch (_)') ||
    !viewerKeyBlock.includes('inMemoryViewerKey ||= createViewerKey()')) {
  console.error('CHECK FAILED: reader engagement must generate a stable in-memory viewer key when browser storage is unavailable.');
  failed = true;
}
const analyticsReaderFallbackRegression = await readFile('analytics-worker/worker.js', 'utf8');
const analyticsReaderMetricsStart = analyticsReaderFallbackRegression.indexOf('async function readerMetrics(env, start, end');
const analyticsReaderMetricsEnd = analyticsReaderFallbackRegression.indexOf('async function verifyAdmin', analyticsReaderMetricsStart);
const analyticsReaderMetricsBlock = analyticsReaderFallbackRegression.slice(analyticsReaderMetricsStart, analyticsReaderMetricsEnd);
if (analyticsReaderMetricsStart < 0 ||
    analyticsReaderMetricsEnd < 0 ||
    !analyticsReaderMetricsBlock.includes('listViewEventObjects(env, segment.day, context)') ||
    !analyticsReaderMetricsBlock.includes('mapWithConcurrency(batch, 8') ||
    !analyticsReaderMetricsBlock.includes('dayResults.some(result => result.identityIncomplete)') ||
    !analyticsReaderMetricsBlock.includes('activeViewers.add(viewerHash)') ||
    !analyticsReaderMetricsBlock.includes('days.size >= 2') ||
    analyticsReaderMetricsBlock.includes('ANALYTICS_SQL')) {
  console.error('CHECK FAILED: reader metrics must use bounded/cached durable R2 reads and stop scanning once legacy identities make the result incomplete.');
  failed = true;
}
if (!analyticsReaderFallbackRegression.includes('archived && segment.fullDay') ||
    !analyticsReaderFallbackRegression.includes('viewRowsForPeriod(env, segment.start, segment.end, context)') ||
    !analyticsReaderFallbackRegression.includes('const adminAnalyticsInFlight = new Map()') ||
    !analyticsReaderFallbackRegression.includes('const [summary, current, previous, currentReaders, dailyTrend, previousDailyTrend]')) {
  console.error('CHECK FAILED: R2 analytics must share event reads, use timestamped partial-day buckets and avoid unused reader scans.');
  failed = true;
}
if (!controlRoomViewCountRegression.includes('const dailyTrendAvailable = cloudViewsAvailable && validTrendSeries') ||
    !controlRoomViewCountRegression.includes('views: asNumber(row.views)') ||
    !controlRoomViewCountRegression.includes('const missingAdminMetricFields = requiredAdminMetricFields.filter') ||
    !controlRoomViewCountRegression.includes('const currentLikes = adminAnalyticsAvailable ? asNumber(analytics.current_likes) : null;') ||
    !controlRoomViewCountRegression.includes("m('Deep Analytics', 'Rating score 10 count', adminAnalyticsAvailable ?") ||
    controlRoomViewCountRegression.includes("m('Deep Analytics', 'Rating score 10 count', data.analytics != null") ||
    !controlRoomViewCountRegression.includes("{ name: 'Cloudflare daily trends', ok: dailyTrendAvailable") ||
    !adminViewCountRegression.includes('admin_analytics_unavailable: adminAnalyticsUnavailable') ||
    !adminViewCountRegression.includes('currentLikes: adminAnalyticsAvailable ? Number(data.current_likes || 0) : null') ||
    !adminViewCountRegression.includes('Rating analytics unavailable')) {
  console.error('CHECK FAILED: admin analytics must validate required source fields, correct trend data, and show unavailable metrics instead of false zeros.');
  failed = true;
}
const communityShareClipboardRegression = await readFile('Community.jsx', 'utf8');
if (!communityShareClipboardRegression.includes('async function copyTextToClipboard(value)') ||
    !communityShareClipboardRegression.includes("document.execCommand('copy')") ||
    !communityShareClipboardRegression.includes('Sharing was unavailable, so the message and link were copied.') ||
    !communityShareClipboardRegression.includes("if(e?.name==='AbortError')return;")) {
  console.error('CHECK FAILED: community copy/share actions need a clipboard fallback and must respect native-share cancellation.');
  failed = true;
}
const communityReactionAccessibilityRegression = await readFile('Community.jsx', 'utf8');
if (!communityReactionAccessibilityRegression.includes('className="community-post-react"') ||
    !communityReactionAccessibilityRegression.includes('aria-expanded={pickerPost===post.id}') ||
    !communityReactionAccessibilityRegression.includes('Choose a reaction') ||
    !communityReactionAccessibilityRegression.includes('event.key==="Escape"')) {
  console.error('CHECK FAILED: community reactions need a keyboard-accessible open button and Escape-to-close behavior.');
  failed = true;
}
const serviceRoleSecretCompatibilityPaths = [
  'supabase/functions/get-admin-console-data/index.ts',
  'supabase/functions/get-admin-user-stats/index.ts',
  'supabase/functions/dpdp-data-rights/index.ts',
];
for (const path of serviceRoleSecretCompatibilityPaths) {
  const source = await readFile(path, 'utf8');
  if (!source.includes('function readSupabaseServiceRoleKey()') ||
      !source.includes('Deno.env.get("SUPABASE_SECRET_KEYS")') ||
      !source.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")')) {
    console.error('CHECK FAILED: critical functions must accept both Supabase secret-key formats: ' + path);
    failed = true;
  }
}
const contactSyncKeyRegression = await readFile('supabase/functions/email-unsubscribe/index.ts', 'utf8');
if (contactSyncKeyRegression.includes('RESEND_CONTACTS_API_KEY') ||
    contactSyncKeyRegression.includes('api.resend.com/contacts')) {
  console.error('CHECK FAILED: unsubscribe must persist in Supabase without requiring the Resend Contacts API.');
  failed = true;
}
const featureLoginGrantMigration = await readFile('supabase/migrations/20261022142628_fix_feature_login_rpc_grant_20261022.sql', 'utf8');
if (!featureLoginGrantMigration.includes('grant execute on function public.record_feature_login() to authenticated, service_role;') ||
    !featureLoginGrantMigration.includes('revoke execute on function public.record_feature_login() from public, anon;')) {
  console.error('CHECK FAILED: feature login RPC must work for authenticated readers without allowing anonymous calls.');
  failed = true;
}
const homeHeaderProfileRegression = await readFile('App.jsx', 'utf8');
const homeHeaderStart = homeHeaderProfileRegression.indexOf('function Home({ chapters })');
const homeHeaderEnd = homeHeaderProfileRegression.indexOf('function AccessDenied', homeHeaderStart);
const homeHeader = homeHeaderProfileRegression.slice(homeHeaderStart, homeHeaderEnd);
if (homeHeader.includes('Open your profile') || homeHeader.includes('homeAvatar') || homeHeader.includes('loadHomeProfile')) {
  console.error('CHECK FAILED: the home header must not add a duplicate profile control; profile access belongs in the existing navigation.');
  failed = true;
}
const appReaderAppearanceRegression = await readFile('App.jsx', 'utf8');
if (appReaderAppearanceRegression.includes('atma-reader-preferences-v1') ||
    appReaderAppearanceRegression.includes('atma:reader-preferences-change') ||
    appReaderAppearanceRegression.includes('readerPreferences')) {
  console.error('CHECK FAILED: Reader appearance must use the standard layout, without hidden per-device customization overrides.');
  failed = true;
}
const securitySettingsRegression = await readFile('SecuritySettings.jsx', 'utf8');
if (!securitySettingsRegression.includes('Sign in to manage security') ||
    !securitySettingsRegression.includes('const cancelEnrollment = async () =>') ||
    !securitySettingsRegression.includes('Could not load security settings. Refresh the page and try again.') ||
    !securitySettingsRegression.includes('maxLength={6}')) {
  console.error('CHECK FAILED: Account security must handle signed-out sessions, failed requests and pending MFA cleanup.');
  failed = true;
}

const simplifiedPrivacySource = await readFile('PrivacyCenter.jsx', 'utf8');
if (/nominee|nomination|privacy-nomination-form/i.test(simplifiedPrivacySource)) {
  console.error('CHECK FAILED: nominee controls should be removed from the reader-facing Privacy page.');
  failed = true;
}
const simplifiedRightsHandler = await readFile('supabase/functions/dpdp-data-rights/index.ts', 'utf8');
if (/action\s*===?\s*["'](?:nomination|delete-nomination)["']/i.test(simplifiedRightsHandler)) {
  console.error('CHECK FAILED: the privacy data-rights endpoint should not expose nomination mutation actions.');
  failed = true;
}
if (!simplifiedRightsHandler.includes('.range(offset, offset + pageLimit - 1)') ||
    !simplifiedRightsHandler.includes('USER_TABLE_ORDER_BY') ||
    !simplifiedRightsHandler.includes('query = query.order(column, { ascending: true })') ||
    simplifiedRightsHandler.includes('.limit(5000)') ||
    !simplifiedRightsHandler.includes('100,000-row safety limit')) {
  console.error('CHECK FAILED: privacy data exports must paginate beyond 5,000 rows and disclose the bounded maximum.');
  failed = true;
}
const legalCopyRegression = await readFile('InfoPage.jsx', 'utf8');
const termsCopyRegression = await readFile('TermsOfUseSections.jsx', 'utf8');
const privacyCopyRegression = await readFile('PrivacyPolicySections.jsx', 'utf8');
if (!legalCopyRegression.includes('AI tools assist selected parts of the visual workflow.') ||
    !legalCopyRegression.includes('AI-generated images are not published directly as finished comic pages.') ||
    !termsCopyRegression.includes('Membership renews automatically') ||
    !termsCopyRegression.includes('atmarekhasupport@gmail.com') ||
    !termsCopyRegression.includes('no-reply@atmarekha.in') ||
    !legalCopyRegression.includes("const isPrivacy = type === 'privacy';") ||
    !privacyCopyRegression.includes('atmarekhainfo@gmail.com') ||
    !privacyCopyRegression.includes('atmarekhaoffical@gmail.com') ||
    !privacyCopyRegression.includes('recovery window of 14 days') ||
    privacyCopyRegression.includes('Personal data breaches') ||
    privacyCopyRegression.includes('Indian data-protection law') ||
    privacyCopyRegression.includes('within 48 hours') ||
    privacyCopyRegression.includes('within one month') ||
    privacyCopyRegression.includes('privacy@atmarekha.in') ||
    legalCopyRegression.includes('within 48 hours') ||
    legalCopyRegression.includes('within one month') ||
    legalCopyRegression.includes('Grievance Officer: Arkesh, creator.')) {
  console.error('CHECK FAILED: public About, Terms or Privacy copy is missing required content or contains an unapproved contact/compliance section.');
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
if (!communityShareRegression.includes('const copy=async post=>') ||
    !communityShareRegression.includes('await copyTextToClipboard(post.content)') ||
    !communityShareRegression.includes('Could not copy this message on your device.')) {
  console.error('CHECK FAILED: Community Copy must await clipboard success and report failure accurately.');
  failed = true;
}
if (!communityShareRegression.includes('if(navigator.share)') ||
    !communityShareRegression.includes('await navigator.share(') ||
    !communityShareRegression.includes('await copyTextToClipboard(shareText)') ||
    !communityShareRegression.includes('Sharing was unavailable, so the message and link were copied.')) {
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
const adminStyles = await readFile('admin-master-system.css', 'utf8');

for (const [name, content, phrase] of [
  ['AdminPanel.jsx', adminPanel, "import './admin-master-system.css';"],
  ['AdminControlRoom.jsx', controlRoom, "import './admin-control-room.css';"],
  ['AdminControlRoom.jsx', controlRoom, 'const loadSequence = useRef(0);'],
  ['AdminControlRoom.jsx', controlRoom, 'const exportVisibleMetrics = () => exportMetricRows(visibleMetrics'],
  ['AdminControlRoom.jsx', controlRoom, 'onClick={exportVisibleMetrics}'],
  ['AdminChapterManager.jsx', chapterManager, 'admin-chapter-card-grid'],
  ['admin-master-system.css', adminStyles, ':focus-visible'],
  ['admin-master-system.css', adminStyles, 'prefers-reduced-motion'],
]) {
  if (!content.includes(phrase)) {
    console.error('CHECK FAILED:', name, 'missing admin control-room safeguard:', phrase);
    failed = true;
  }
}


const pdlplAdminSubmitRegression = await readFile('PalDoPalAdmin.jsx', 'utf8');
if (!pdlplAdminSubmitRegression.includes('<button type="submit" className="pdlpl-primary" disabled={busy}>')) {
  console.error('CHECK FAILED: PDPKL chapter editing must use an explicit form submit action.');
  failed = true;
}

const adminStudioButtonSource = await readFile('admin-studio-ui.jsx', 'utf8');
if (!adminStudioButtonSource.includes('<button type="button" className={classes} {...props}>')) {
  console.error('CHECK FAILED: shared admin buttons must default to type=button unless a caller explicitly overrides it.');
  failed = true;
}

const adminPanelReliabilityChecks = [
  ['AdminPanel.jsx', adminPanel, 'const loadSequence = useRef(0);'],
  ['AdminPanel.jsx', adminPanel, 'async function loadAllChapterPageRows()'],
  ['AdminPanel.jsx', adminPanel, 'async function loadAllCommentReportRows()'],
  ['AdminPanel.jsx', adminPanel, ".order('chapter_id', { ascending: true })"],
  ['AdminPanel.jsx', adminPanel, ".order('created_at', { ascending: false })\n      .order('id', { ascending: false })"],
  ['AdminPanel.jsx', adminPanel, '{comments.length} recent comments · replies included'],
  ['AdminPanel.jsx', adminPanel, ".select('id', { count: 'exact', head: true }).or('status.is.null,status.eq.open')"],
  ['AdminPanel.jsx', adminPanel, 'Admin panel loaded with limited data:'],
  ['AdminPanel.jsx', adminPanel, 'if (event.key === \'Escape\') setMobileSidebarOpen(false);'],
  ['AdminPanel.jsx', adminPanel, "document.body.style.overflow = drawerBreakpoint.matches ? 'hidden' : previousOverflow;"],
  ['AdminPanel.jsx', adminPanel, "window.addEventListener('resize', syncBodyScroll);"],
  ['AdminPanel.jsx', adminPanel, "aria-label={mobileSidebarOpen ? 'Close navigation' : 'Open navigation'}"],
  ['AdminPanel.jsx', adminPanel, "document.querySelector('.ar-admin-sidebar .ar-admin-mobile-close')?.focus();"],
  ['AdminPanel.jsx', adminPanel, "document.querySelector('.ar-admin-menu-button')?.focus();"],
  ['AdminPanel.jsx', adminPanel, 'aria-controls="ar-admin-sidebar" aria-expanded={mobileSidebarOpen}'],
  ['AdminPanel.jsx', adminPanel, 'setMobileSidebarOpen(value => !value)'],
  ['AdminPanel.jsx', adminPanel, 'setMobileSidebarOpen(false);\n          if (item.action) openAdminTool(item.action, item.detail);'],
  ['admin-studio-ui.jsx', adminStudioButtonSource, 'id="ar-admin-sidebar"'],
  ['admin-master-system.css', adminStyles, 'Mobile admin drawer reliability'],
  ['admin-master-system.css', adminStyles, 'visibility: hidden !important;'],
  ['admin-master-system.css', adminStyles, 'pointer-events: auto !important;'],
  ['admin-master-system.css', adminStyles, 'transition: none !important;'],
];
const adminOperationsRegressionSource = await readFile('AdminOperations.jsx', 'utf8');
const groupChatAdminSource = await readFile('AdminGroupChatTools.jsx', 'utf8');
const communityAdminSource = await readFile('CommunityAdmin.jsx', 'utf8');
const chapterHealthAdminSource = await readFile('AdminChapterHealth.jsx', 'utf8');
for (const [name, source, phrase] of adminPanelReliabilityChecks) {
  if (!source.includes(phrase)) {
    console.error('CHECK FAILED:', name, 'missing admin reliability safeguard:', phrase);
    failed = true;
  }
}
for (const [name, source, phrase] of [
  ['AdminOperations.jsx', adminOperationsRegressionSource, "select('id', { count: 'exact', head: true }).gte('created_at', todayStart())"],
  ['AdminOperations.jsx', adminOperationsRegressionSource, "today.views == null ? 'Unavailable'"],
  ['AdminOperations.jsx', adminOperationsRegressionSource, "today.readers == null ? 'Unavailable'"],
  ['AdminOperations.jsx', adminOperationsRegressionSource, "today.likes == null ? 'Unavailable'"],
  ['AdminOperations.jsx', adminOperationsRegressionSource, "subscriberCount == null ? 'Unavailable'"],
  ['AdminGroupChatTools.jsx', groupChatAdminSource, '<button type="button" className={'],
  ['AdminGroupChatTools.jsx', groupChatAdminSource, '<button type="button" className="ar-gcm-action" onClick={deleteSelected}'],
  ['AdminChapterHealth.jsx', chapterHealthAdminSource, '<button type="button" className="ar-health-run" onClick={runCheck}'],
  ['CommunityAdmin.jsx', communityAdminSource, 'finally{setLoadingPosts(false)}'],
  ['CommunityAdmin.jsx', communityAdminSource, '<button type="submit" className="community-admin-send"'],
  ['CommunityAdmin.jsx', communityAdminSource, "throw Error('Admin access required.')"],
]) {
  if (!source.includes(phrase)) {
    console.error('CHECK FAILED:', name, 'missing admin action safeguard:', phrase);
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

const adminFixCss = await readFile('admin-master-system.css', 'utf8');
if (!adminFixCss.includes('.ar-admin-top-actions') || !adminFixCss.includes('.ar-admin-topbar')) {
  console.error('CHECK FAILED: master stylesheet is missing actual admin topbar action/layout selectors.');
  failed = true;
}

const appEntry = await readFile('main.jsx', 'utf8');
const duplicateMountAdminSource = await readFile('AdminPanel.jsx', 'utf8');
const hasMountedTool = (source, component) =>
  source.includes('<' + component + ' ') ||
  source.includes('<' + component + '/>') ||
  source.includes('<' + component + '>');
for (const component of ['CommunityAdmin', 'AdminProTools', 'AdminChapterHealth', 'AdminGroupChatTools', 'AdminManagementTools', 'AdminModerationTools', 'AdminOperations']) {
  if (hasMountedTool(appEntry, component)) {
    console.error('CHECK FAILED: admin-only tool must not be mounted globally in main.jsx:', component);
    failed = true;
  }
  if (!hasMountedTool(duplicateMountAdminSource, component)) {
    console.error('CHECK FAILED: admin-only tool is not mounted by AdminPanel.jsx:', component);
    failed = true;
  }
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
const adminWorkspaceCss = await readFile('admin-master-system.css', 'utf8');
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
if (!adminPanelSource.includes("import './admin-master-system.css';") ||
    !adminWorkspaceCss.includes('@media (max-width: 980px)') ||
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

const publicSitemap = await readFile('public/sitemap.xml', 'utf8');
const sitemapWorker = await readFile('worker.js', 'utf8');
const sitemapGenerator = await readFile('scripts/generate-sitemap.mjs', 'utf8');
const crawlerRules = await readFile('public/robots.txt', 'utf8');
for (const route of ['/info/about', '/info/terms', '/info/privacy', '/info/contact', '/info/report', '/pal-do-pal-ke-lamhe']) {
  if (!publicSitemap.includes('https://www.atmarekha.in' + route) ||
      !sitemapGenerator.includes(route)) {
    console.error('CHECK FAILED: public sitemap is missing a required public route:', route);
    failed = true;
  }
}
if (publicSitemap.includes('storage/') || publicSitemap.includes('<image:image>') ||
    publicSitemap.includes('xmlns:image')) {
  console.error('CHECK FAILED: static sitemap must not expose storage or raw image URLs.');
  failed = true;
}
if (!sitemapWorker.includes('async function serveSitemap') ||
    !sitemapWorker.includes('async function loadAllPublishedChapters') ||
    !sitemapWorker.includes('url.pathname === "/sitemap.xml"')) {
  console.error('CHECK FAILED: Worker dynamic sitemap route or complete chapter pagination is missing.');
  failed = true;
}
if (!crawlerRules.includes('Sitemap: https://www.atmarekha.in/sitemap.xml')) {
  console.error('CHECK FAILED: robots.txt does not reference the canonical sitemap.');
  failed = true;
}

if (failed) process.exit(1);
console.log('Atma Rekha production checks passed.');
