import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'src/config/publicEnv.js',
  'src/app/routing/routeService.js',
  'src/shared/api/analyticsClient.js',
  'src/features/chapters/chapterService.js',
  'src/features/chapters/components/ChapterDiscovery.jsx',
  'src/features/chapters/components/ChapterAccessGuard.jsx',
  'src/features/engagement/engagementService.js',
  'src/features/membership/membershipService.js',
  'src/features/attribution/attributionService.js',
  'src/features/pdlpl/engagementService.js',
  'src/features/pdlpl/chapterService.js',
  'src/infrastructure/supabase/client.js',
  'src/infrastructure/media/r2Storage.js',
  'src/infrastructure/media/pdlplStorage.js',
  'src/infrastructure/media/pdlplMediaDomain.js',
  'src/infrastructure/media/r2Domain.js',
  'src/features/auth/authService.js',
  'src/features/auth/adminAuthorizationService.js',
  'src/shared/errors/toUserMessage.js',
  'src/shared/validation/input.js',
  'src/shared/validation/formUX.js',
  'src/shared/security/passwordSecurity.js',
  'src/app/routing/routeService.test.js',
  'src/shared/api/analyticsClient.test.js',
  'src/shared/validation/formUX.test.js',
  'src/shared/security/passwordSecurity.test.js',
  'src/features/chapters/chapterDomain.test.js',
  'src/features/engagement/engagementDomain.test.js',
  'src/features/membership/membershipDomain.test.js',
  'src/features/attribution/attributionDomain.test.js',
  'src/features/pdlpl/engagementDomain.test.js',
  'src/features/pdlpl/chapterDomain.test.js',
  'src/infrastructure/media/r2Domain.test.js',
  'src/infrastructure/media/pdlplMediaDomain.test.js',
  'ErrorBoundary.jsx',
  'jsconfig.json',
  'eslint.config.js',
  '.prettierrc.json',
  '.githooks/pre-commit',
  'docs/ARCHITECTURE.md',
];

const problems = [];

for (const file of requiredFiles) {
  try {
    await access(file);
  } catch {
    problems.push(`Missing required architecture file: ${file}`);
  }
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
for (const script of [
  'test',
  'lint',
  'typecheck',
  'format:check',
  'quality:check',
  'hooks:install',
]) {
  if (!packageJson.scripts?.[script]) {
    problems.push(`Missing package script: ${script}`);
  }
}

const chapterFacade = await readFile('chapters.js', 'utf8');
if (!chapterFacade.includes('./src/features/chapters/chapterService.js')) {
  problems.push('chapters.js must remain a compatibility facade during migration.');
}

const environmentExample = await readFile('.env.example', 'utf8');
for (const forbidden of [
  'SUPABASE_SERVICE_ROLE_KEY=',
  'RAZORPAY_KEY_SECRET=',
  'CLOUDFLARE_API_TOKEN=',
]) {
  if (environmentExample.includes(forbidden)) {
    problems.push('Public environment example contains a server-secret variable name.');
  }
}

if (problems.length) {
  for (const problem of problems) console.error(`ARCHITECTURE CHECK FAILED: ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Architecture structure checks passed.');
}
