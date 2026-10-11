import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'src/config/publicEnv.js',
  'src/features/chapters/chapterService.js',
  'src/shared/errors/toUserMessage.js',
  'src/shared/validation/input.js',
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
