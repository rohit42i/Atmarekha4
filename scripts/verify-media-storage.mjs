import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.wrangler']);
const sourceExtensions = /\.(?:js|jsx|ts|tsx)$/i;

async function collectSourceFiles(directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name) || entry.name.startsWith('.')) continue;
      files.push(...await collectSourceFiles(join(directory, entry.name)));
    } else if (sourceExtensions.test(entry.name)) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

const read = path => readFile(join(root, path), 'utf8');
const [adapter, community, worker, atmaAdmin, pageAdmin, pdlplMedia] = await Promise.all([
  read('supabase.js'),
  read('CommunityAdmin.jsx'),
  read('atma-media-worker/index.js'),
  read('AdminPanel.jsx'),
  read('AdminChapterPages.jsx'),
  read('pdlplR2.js'),
]);
const checks = [
  [
    'Unknown media buckets fail closed without Supabase Storage fallback',
    adapter.includes("const R2_BUCKETS = new Set(['chapter-pages', 'covers', 'community'])")
      && /if \(!R2_BUCKETS\.has\(bucket\)\)\s*\{\s*throw new Error/.test(adapter)
      && adapter.includes('Supabase Storage fallback is disabled.')
      && !adapter.includes('return client.storage.from(bucket)'),
  ],
  [
    'Community attachment upload, URL generation, and cleanup use Cloudflare R2',
    community.includes("import { supabase, cloudflareR2 } from './supabase';")
      && (community.match(/cloudflareR2\.from\('community'\)/g) || []).length >= 3
      && !/supabase\s*\.\s*storage\s*\.\s*from\s*\(['"]community['"]\)/.test(community),
  ],
  [
    'Atma chapter and cover uploads use the Cloudflare R2 adapter',
    atmaAdmin.includes('cloudflareR2.from(bucket).upload')
      && atmaAdmin.includes('cloudflareR2.from(COVER_BUCKET).getPublicUrl'),
  ],
  [
    'Atma chapter-page editing reads and removes media through Cloudflare R2',
    pageAdmin.includes('cloudflareR2.from(ATMA_BUCKET).getPublicUrl')
      && pageAdmin.includes('cloudflareR2.from(ATMA_BUCKET).remove'),
  ],
  [
    'Media Worker has an explicit allow-list for supported object paths',
    worker.includes('function objectKey(request)')
      && worker.includes('const communityAttachment = /^community\\/[^/]+$/i;')
      && worker.includes('const cover = new RegExp')
      && worker.includes('const page = new RegExp'),
  ],
  [
    'PDPKL images use their dedicated Cloudflare media Worker',
    pdlplMedia.includes('PDLPL_MEDIA_WORKER_URL')
      && pdlplMedia.includes('pdlpl-media.rohitbaswaraj.workers.dev')
      && pdlplMedia.includes('export async function uploadPdlplFile'),
  ],
];

let failed = false;
for (const [label, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ': ' + label);
  if (!passed) failed = true;
}

// Scan application and function code to prevent legacy storage uploads being reintroduced.
// This test file is excluded because its assertions intentionally mention the forbidden API.
const sourceFiles = await collectSourceFiles();
for (const path of sourceFiles) {
  const relativePath = relative(root, path).replace(/\\/g, '/');
  if (relativePath === 'scripts/verify-media-storage.mjs') continue;
  const content = await readFile(path, 'utf8');
  if (/supabase\s*\.\s*storage\s*\.\s*from\s*\(/.test(content)) {
    console.error('FAIL: Supabase Storage call remains in application code: ' + relativePath);
    failed = true;
  }
}

if (failed) {
  console.error('Media storage verification failed.');
  process.exitCode = 1;
} else {
  console.log('Media storage verification passed.');
}
