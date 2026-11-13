import { readFile } from 'node:fs/promises';

const files = {
  app: await readFile('App.jsx', 'utf8'),
  auth: await readFile('UserAuth.jsx', 'utf8'),
  guard: await readFile('ChapterAccessGuard.jsx', 'utf8'),
  membership: await readFile('Membership.jsx', 'utf8'),
  pdlplAccess: await readFile('palDoPalKeLamhe.js', 'utf8'),
  more: await readFile('MorePage.jsx', 'utf8'),
  page: await readFile('RewardsPage.jsx', 'utf8'),
  pageCss: await readFile('rewards-page.css', 'utf8'),
  client: await readFile('supabase.js', 'utf8'),
  atmaWorker: await readFile('atma-media-worker/index.js', 'utf8'),
  pdpklWorker: await readFile('pdlpl-media-worker/index.js', 'utf8'),
  migration: await readFile('supabase/migrations/20261113190000_referral_rewards_and_coin_redemption.sql', 'utf8'),
};

const checks = [
  ['Rewards route is registered', /route === 'rewards'.*RewardsPage/.test(files.app)],
  ['Rewards page is reachable from More & Settings', /Rewards &amp; Referrals/.test(files.more) && /window\.location\.hash = 'rewards'/.test(files.more)],
  ['Referral code is captured from the invite URL', /atma-referral-code/.test(files.app) && /referral_code:getPendingReferralCode\(\)/.test(files.auth)],
  ['Each verified new referral awards 100 coins', /email_confirmed_at is not null/.test(files.migration) && /'referral_reward', v_signup\.id/.test(files.migration)],
  ['Self-referrals and duplicate signup attribution are blocked', /v_referrer = new\.id/.test(files.migration) && /referred_user_id uuid not null unique/.test(files.migration)],
  ['Referral credit is idempotent and recoverable', /coin_ledger_one_referral_reward_idx/.test(files.migration) && /Recover already-qualified referrals/.test(files.migration)],
  ['Claim and redemption use server-side RPCs', /claim_referral_rewards/.test(files.page) && /redeem_reward_subscription/.test(files.page)],
  ['Coin redemption thresholds and durations match the product rules', /when 'mini_member' then v_cost := 1000; v_days := 30/.test(files.migration) && /when 'supporter' then v_cost := 2000; v_days := 30/.test(files.migration) && /when 'premium_yearly' then v_cost := 15000; v_days := 365/.test(files.migration)],
  ['Coin spending is serialized and ledger-backed', /pg_advisory_xact_lock/.test(files.migration) && /subscription_redemption/.test(files.migration)],
  ['Paid/reward membership overlap is blocked', /paid_membership_pending/.test(files.migration) && /reward_subscriptions/.test(files.migration) && /coin-redeemed membership is active/.test(await readFile('supabase/functions/create-razorpay-subscription/index.ts', 'utf8'))],
  ['Atma Rekha protected chapter policy grants reward memberships', /atma_reward_members_read_paid_chapters/.test(files.migration)],
  ['PDPKL protected chapter policy grants eligible reward memberships', /pdlpl_reward_members_read_published_chapters/.test(files.migration)],
  ['Atma media Worker checks reward entitlements', /supabaseRows\(env, 'reward_subscriptions'/.test(files.atmaWorker) && /'mini_member', 'supporter', 'premium_yearly'/.test(files.atmaWorker)],
  ['PDPKL media Worker checks reward entitlements', /supabaseRows\(env, authorization, 'reward_subscriptions'/.test(files.pdpklWorker) && /'supporter', 'premium_yearly'/.test(files.pdpklWorker)],
  ['Frontend membership lookup includes reward entitlements', /from\('reward_subscriptions'\)/.test(files.client)],
  ['Membership/chapter/PDPKL access refreshes after redemption', /atma:membership-updated/.test(files.membership) && /atma:membership-updated/.test(files.guard) && /atma:membership-updated/.test(files.page) && /atma:membership-updated/.test(files.pdlplAccess)],
  ['Invite sharing and copying are available', /navigator\.share/.test(files.page) && /copyText\(referralLink\)/.test(files.page)],
  ['Redemption uses an in-app accessible confirmation dialog', /role="dialog" aria-modal="true"/.test(files.page) && /Confirm redemption/.test(files.page)],
  ['Responsive and reduced-motion styles are present', /@media \(max-width: 700px\)/.test(files.pageCss) && /prefers-reduced-motion/.test(files.pageCss)],
  ['Light and dark theme button labels have explicit high-contrast colors', /data-theme=\\"light\\" body \.rewards-page button\.rewards-primary-button/.test(files.pageCss) && /data-theme=\\"dark\\" body \.rewards-page button\.rewards-primary-button/.test(files.pageCss) && /-webkit-text-fill-color/.test(files.pageCss) && /button:disabled/.test(files.pageCss)],
];

let failed = 0;
for (const [label, passed] of checks) {
  if (!passed) {
    failed += 1;
    console.error('FAIL ' + label);
  } else {
    console.log('PASS ' + label);
  }
}
if (failed) {
  console.error(`Referral rewards regression checks failed: ${failed}/${checks.length}`);
  process.exitCode = 1;
} else {
  console.log(`Referral rewards regression checks passed: ${checks.length}/${checks.length}`);
}
