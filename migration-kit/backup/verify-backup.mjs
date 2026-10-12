#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const encryptedPath = path.resolve(process.argv[2] || '');
const passphrase = process.env.BACKUP_PASSPHRASE;
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'atma-verify-'));

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}
function run(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      env: options.env || process.env,
      stdio: [options.stdin ? 'pipe' : 'ignore', options.capture ? 'pipe' : 'ignore', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    if (options.capture) child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', e => reject(new Error(program + ' could not start: ' + e.message)));
    child.on('close', code => {
      if (code !== 0) reject(new Error(program + ' failed (exit ' + code + '). ' + stderr.slice(-1200)));
      else resolve({ stdout, stderr });
    });
    if (options.stdin) {
      child.stdin.write(options.stdin);
      child.stdin.end();
    }
  });
}
function hmacKey() {
  return crypto.createHash('sha256')
    .update('AtmaRekha Supabase backup HMAC v1\\0')
    .update(passphrase)
    .digest();
}
async function fileDigest(filePath, mode) {
  return new Promise((resolve, reject) => {
    const digest = mode === 'hmac'
      ? crypto.createHmac('sha256', hmacKey())
      : crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(digest.digest('hex')));
  });
}
async function main() {
  ensure(encryptedPath && fs.existsSync(encryptedPath), 'Backup file not found.');
  ensure(passphrase && passphrase.length >= 20, 'Provide the backup passphrase (20+ characters).');
  const shaPath = encryptedPath + '.sha256';
  const hmacPath = encryptedPath + '.hmac';
  ensure(fs.existsSync(shaPath) && fs.existsSync(hmacPath), 'The .sha256 or .hmac integrity sidecar is missing.');
  const expectedSha = fs.readFileSync(shaPath, 'utf8').trim().split(/\s+/)[0];
  const expectedHmac = fs.readFileSync(hmacPath, 'utf8').trim().split(/\s+/)[1];
  ensure(/^[a-f0-9]{64}$/i.test(expectedSha || ''), 'Invalid SHA-256 sidecar.');
  ensure(/^[a-f0-9]{64}$/i.test(expectedHmac || ''), 'Invalid HMAC sidecar.');

  console.log('1/4 Checking encrypted archive checksum...');
  const actualSha = await fileDigest(encryptedPath, 'sha');
  ensure(crypto.timingSafeEqual(Buffer.from(actualSha, 'hex'), Buffer.from(expectedSha, 'hex')), 'SHA-256 mismatch. Do not restore this file.');

  console.log('2/4 Authenticating encrypted archive...');
  const actualHmac = await fileDigest(encryptedPath, 'hmac');
  ensure(crypto.timingSafeEqual(Buffer.from(actualHmac, 'hex'), Buffer.from(expectedHmac, 'hex')), 'HMAC mismatch (wrong passphrase or modified backup). Do not restore this file.');

  console.log('3/4 Decrypting and checking package structure...');
  const tarPath = path.join(work, 'verification.tar.gz');
  await run('openssl', ['enc','-d','-aes-256-cbc','-pbkdf2','-iter','600000','-md','sha256','-in',encryptedPath,'-out',tarPath,'-pass','stdin'], {
    stdin: passphrase + '\n',
  });
  await run('tar', ['-tzf', tarPath], { capture: true });
  await run('tar', ['-xzf', tarPath, '-C', work, 'database.dump']);
  await run('pg_restore', ['--list', path.join(work, 'database.dump')], { capture: true });

  console.log('4/4 Passed: checksum, HMAC, decrypt/package integrity, and PostgreSQL archive listing.');
  console.log('This still is not a restore rehearsal. Restore into an isolated database before any migration cutover.');
}
main().catch(error => {
  console.error('BACKUP VERIFICATION FAILED: ' + error.message);
  process.exitCode = 1;
}).finally(() => {
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
});
process.on('SIGINT', () => {
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  process.exit(130);
});
