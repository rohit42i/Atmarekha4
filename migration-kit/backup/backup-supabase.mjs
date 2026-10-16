#!/usr/bin/env node
'use strict';

// Keep backup files owner-only even when Termux has a permissive default umask.
process.umask(0o077);

/*
 * Local Atma Rekha source backup for Android/Termux.
 * Dumps PostgreSQL, downloads every Supabase Storage object, encrypts the package,
 * validates the archive, and deletes plaintext temp files on success.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const PROJECT_REF = 'pbukwjokgkqacaphlqzm';
const SUPABASE_URL = 'https://' + PROJECT_REF + '.supabase.co';
const DATABASE_URL = process.env.SUPABASE_DB_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSPHRASE = process.env.BACKUP_PASSPHRASE;
const outputRoot = path.join(os.homedir(), 'storage', 'downloads', 'Atmarekha-Backups');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = path.join(outputRoot, 'Atmarekha-Supabase-' + stamp + '.tar.gz.enc');
const manifestPath = outPath + '.manifest.txt';
const checksumPath = outPath + '.sha256';
const hmacPath = outPath + '.hmac';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'atma-backup-'));

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
function hmacKey() {
  return crypto.createHash('sha256')
    .update('AtmaRekha Supabase backup HMAC v1\\0')
    .update(PASSPHRASE)
    .digest();
}
async function hmacFile(filePath) {
  return new Promise((resolve, reject) => {
    const mac = crypto.createHmac('sha256', hmacKey());
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => mac.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(mac.digest('hex')));
  });
}
function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}
function parseDatabaseUrl(input) {
  let u;
  try { u = new URL(input); } catch { throw new Error('The database connection URL is invalid.'); }
  ensure(['postgres:', 'postgresql:'].includes(u.protocol), 'Use a postgresql:// or postgres:// connection URL.');
  ensure(u.hostname && u.username && u.password && u.pathname.length > 1, 'The connection URL must include host, username, password and database name.');
  return {
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGSSLMODE: 'require',
    PGCONNECT_TIMEOUT: '20',
  };
}
function safeChildEnv(base = process.env) {
  const env = { ...base };
  delete env.SUPABASE_DB_URL;
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  delete env.BACKUP_PASSPHRASE;
  return env;
}

function run(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: options.env || safeChildEnv(),
      stdio: [options.stdin ? 'pipe' : 'ignore', options.capture ? 'pipe' : 'ignore', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    if (options.capture) child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', e => reject(new Error(program + ' could not start: ' + e.message)));
    child.on('close', code => {
      if (code !== 0) reject(new Error(program + ' failed (exit ' + code + '). ' + stderr.slice(-1500)));
      else resolve({ stdout, stderr });
    });
    if (options.stdin) {
      child.stdin.write(options.stdin);
      child.stdin.end();
    }
  });
}
async function apiRequest(route, options = {}) {
  const response = await fetch(SUPABASE_URL + route, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error('Supabase Storage API returned HTTP ' + response.status + ': ' + detail);
  }
  return response;
}
function safePath(root, bucket, objectName) {
  const bucketRoot = path.resolve(root, bucket);
  const segments = objectName.split('/');
  ensure(segments.every(s => s && s !== '.' && s !== '..' && !s.includes('\0')), 'Unsafe Storage object path encountered.');
  const file = path.resolve(bucketRoot, ...segments);
  ensure(file.startsWith(bucketRoot + path.sep), 'Storage object path escaped its bucket folder.');
  return file;
}
async function listObjects(bucket, prefix) {
  const all = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const response = await apiRequest('/storage/v1/object/list/' + encodeURIComponent(bucket), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    const page = await response.json();
    ensure(Array.isArray(page), 'Storage listing for bucket "' + bucket + '" did not return an object list.');
    all.push(...page);
    if (page.length < limit) break;
  }
  return all;
}
async function backupBucket(bucket, storageRoot, manifest) {
  async function walk(prefix) {
    const entries = await listObjects(bucket, prefix);
    for (const item of entries) {
      ensure(item && typeof item.name === 'string' && item.name.length > 0, 'Storage returned an object without a name.');
      const objectName = prefix ? prefix + '/' + item.name : item.name;
      if (item.id == null) {
        await walk(objectName);
        continue;
      }
      const objectPath = '/storage/v1/object/' + encodeURIComponent(bucket) + '/' + objectName.split('/').map(encodeURIComponent).join('/');
      const response = await apiRequest(objectPath);
      const bytes = Buffer.from(await response.arrayBuffer());
      const target = safePath(storageRoot, bucket, objectName);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes, { flag: 'wx' });
      manifest.objects.push({
        bucket,
        path: objectName,
        bytes: bytes.length,
        sha256: sha256(bytes),
        contentType: response.headers.get('content-type') || item.metadata?.mimetype || null,
      });
      manifest.totalObjectBytes += bytes.length;
      manifest.counts[bucket] = (manifest.counts[bucket] || 0) + 1;
    }
  }
  await walk('');
}
async function getRowCounts(pgEnv) {
  const listing = await run('psql', [
    '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-F', '\t', '-c',
    "SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname, tablename;"
  ], { env: pgEnv, capture: true });
  const tables = listing.stdout.split(/\r?\n/).filter(Boolean).map(line => {
    const index = line.indexOf('\t');
    ensure(index > 0, 'Could not parse PostgreSQL table inventory.');
    return [line.slice(0, index), line.slice(index + 1)];
  });
  const chunks = [];
  for (const [schema, table] of tables) {
    ensure(/^[a-zA-Z0-9_]+$/.test(schema) && /^[a-zA-Z0-9_]+$/.test(table), 'Unexpected identifier in PostgreSQL inventory.');
    chunks.push("SELECT '" + schema + '.' + table + "'::text AS table_name, count(*)::bigint AS row_count FROM " + quoteIdent(schema) + '.' + quoteIdent(table));
  }
  const rowCounts = ['table_name\trow_count'];
  if (chunks.length) {
    const counted = await run('psql', ['-X','-qAt','-v','ON_ERROR_STOP=1','-F','\t','-c',chunks.join(' UNION ALL ') + ' ORDER BY 1;'], { env: pgEnv, capture: true });
    rowCounts.push(...counted.stdout.split(/\r?\n/).filter(Boolean));
  }
  return { rowCountsText: rowCounts.join('\n') + '\n', tableCount: tables.length };
}
async function encryptAndVerify(archivePath, encryptedPath) {
  await run('openssl', ['enc','-aes-256-cbc','-salt','-pbkdf2','-iter','600000','-md','sha256','-in',archivePath,'-out',encryptedPath,'-pass','stdin'], {
    stdin: PASSPHRASE + '\n',
  });
  const checkPath = path.join(work, 'verify-decrypted.tar.gz');
  try {
    await run('openssl', ['enc','-d','-aes-256-cbc','-pbkdf2','-iter','600000','-md','sha256','-in',encryptedPath,'-out',checkPath,'-pass','stdin'], { stdin: PASSPHRASE + '\n' });
    await run('tar', ['-tzf', checkPath], { capture: true });
  } finally {
    try { fs.rmSync(checkPath, { force: true }); } catch {}
  }
}
async function main() {
  ensure(DATABASE_URL && SERVICE_KEY && PASSPHRASE, 'Missing prompted backup credentials.');
  ensure(PASSPHRASE.length >= 20, 'Backup passphrase must be at least 20 characters.');
  ensure(fs.existsSync(path.join(os.homedir(), 'storage', 'downloads')), 'Run termux-setup-storage and allow access before backing up.');
  const parsedUrl = new URL(DATABASE_URL);
  const dbHost = parsedUrl.hostname.toLowerCase();
  const dbUser = decodeURIComponent(parsedUrl.username).toLowerCase();
  const expectedDirectHost = 'db.' + PROJECT_REF + '.supabase.co';
  const expectedPooler = dbHost.endsWith('.pooler.supabase.com') &&
    (dbUser === 'postgres.' + PROJECT_REF || dbUser.endsWith('.' + PROJECT_REF));
  ensure(dbHost === expectedDirectHost || expectedPooler,
    'Database URL does not identify the expected Atma Rekha Supabase project. Use its direct host or its project-specific Session Pooler username. No backup was taken.');

  const pgEnv = { ...safeChildEnv(), ...parseDatabaseUrl(DATABASE_URL) };
  delete pgEnv.SUPABASE_DB_URL;
  delete pgEnv.SUPABASE_SERVICE_ROLE_KEY;
  delete pgEnv.BACKUP_PASSPHRASE;

  fs.mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(outputRoot, 0o700); } catch {}
  const dumpPath = path.join(work, 'database.dump');
  const storageRoot = path.join(work, 'storage');
  fs.mkdirSync(storageRoot, { recursive: true });

  console.log('1/6 Testing PostgreSQL connection and creating a custom-format database dump...');
  await run('pg_dump', ['--format=custom','--no-owner','--no-acl','--verbose','--file',dumpPath], { env: pgEnv });
  await run('pg_restore', ['--list', dumpPath], { capture: true });
  const dumpInfo = fs.statSync(dumpPath);

  console.log('2/6 Capturing table row-count reconciliation metadata...');
  const counts = await getRowCounts(pgEnv);
  fs.writeFileSync(path.join(work, 'row-counts.tsv'), counts.rowCountsText);

  console.log('3/6 Listing Supabase Storage buckets...');
  const bucketsResponse = await apiRequest('/storage/v1/bucket');
  const buckets = await bucketsResponse.json();
  ensure(Array.isArray(buckets), 'Storage bucket listing did not return an array.');
  const expectedBuckets = new Map([
    ['assets', true], ['chapter-pages', true], ['community', true], ['covers', true],
    ['member-content', false], ['pdlpl-content', false],
  ]);
  const actualBucketNames = buckets.map(bucket => bucket && bucket.name).sort();
  const expectedBucketNames = [...expectedBuckets.keys()].sort();
  ensure(JSON.stringify(actualBucketNames) === JSON.stringify(expectedBucketNames),
    'Storage bucket inventory differs from the six reviewed source buckets. Stop and review the current Supabase bucket list before backing up; this run will not silently omit or add buckets.');
  for (const bucket of buckets) {
    ensure(typeof bucket.public === 'boolean' && bucket.public === expectedBuckets.get(bucket.name),
      'Storage access setting changed for bucket "' + bucket.name + '". Stop and review it before backup.');
  }
  const storageManifest = { projectRef: PROJECT_REF, capturedAt: new Date().toISOString(), buckets, objects: [], counts: {}, totalObjectBytes: 0 };

  console.log('4/6 Downloading every object from ' + buckets.length + ' Storage bucket(s) into the local backup package...');
  for (const bucket of buckets) {
    ensure(bucket && typeof bucket.name === 'string', 'Storage returned a bucket without a name.');
    await backupBucket(bucket.name, storageRoot, storageManifest);
    console.log('    Backed up bucket "' + bucket.name + '": ' + (storageManifest.counts[bucket.name] || 0) + ' object(s)');
  }
  fs.writeFileSync(path.join(work, 'storage-manifest.json'), JSON.stringify(storageManifest, null, 2));

  const sourceSnapshot = {
    projectRef: PROJECT_REF,
    region: 'ap-south-1',
    databaseVersionAtPreparation: '17.6.1.155',
    capturedAt: new Date().toISOString(),
    databaseDump: { format: 'PostgreSQL custom archive', bytes: dumpInfo.size, sha256: await sha256File(dumpPath), pgRestoreListCheck: 'passed' },
    tableInventoryCount: counts.tableCount,
    storageBucketCount: buckets.length,
    storageObjectCount: storageManifest.objects.length,
    storageObjectBytes: storageManifest.totalObjectBytes,
    caution: 'This is a backup artifact, not a tested restore. Restore rehearsal is still required before migration cutover.',
  };
  fs.writeFileSync(path.join(work, 'source-snapshot.json'), JSON.stringify(sourceSnapshot, null, 2));

  console.log('5/6 Creating and encrypting the combined backup archive...');
  const plainArchive = path.join(work, 'backup.tar.gz');
  await run('tar', ['-czf', plainArchive, '-C', work, 'database.dump', 'row-counts.tsv', 'storage', 'storage-manifest.json', 'source-snapshot.json']);
  const packageBytes = fs.statSync(plainArchive).size;
  await encryptAndVerify(plainArchive, outPath);
  const cipherBytes = fs.statSync(outPath).size;
  const digest = await sha256File(outPath);
  const hmac = await hmacFile(outPath);
  fs.writeFileSync(checksumPath, digest + '  ' + path.basename(outPath) + '\n');
  fs.writeFileSync(hmacPath, 'HMAC-SHA256 ' + hmac + '  ' + path.basename(outPath) + '\n');

  const externalManifest = [
    'Atma Rekha encrypted Supabase backup',
    'Created (UTC): ' + new Date().toISOString(),
    'Source project ref: ' + PROJECT_REF,
    'Encrypted artifact: ' + path.basename(outPath),
    'Encrypted bytes: ' + cipherBytes,
    'Encrypted SHA-256: ' + digest,
    'Authenticated HMAC-SHA256: ' + hmac,
    'Compressed package bytes before encryption: ' + packageBytes,
    'PostgreSQL table inventory entries: ' + counts.tableCount,
    'Storage buckets: ' + buckets.length,
    'Storage objects downloaded: ' + storageManifest.objects.length,
    'Storage bytes downloaded: ' + storageManifest.totalObjectBytes,
    'Verification: pg_restore --list passed; decrypt-and-tar-list passed; HMAC-SHA256 saved in sidecar.',
    'Not yet verified: complete restore into an isolated PostgreSQL/Supabase target.',
    'Keep the encryption passphrase offline; without it the backup cannot be decrypted.',
  ].join('\n') + '\n';
  fs.writeFileSync(manifestPath, externalManifest);

  try { fs.rmSync(plainArchive, { force: true }); } catch {}
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  console.log('6/6 Complete. Plaintext temporary backup files have been removed.');
  console.log('Encrypted backup: ' + outPath);
  console.log('SHA-256: ' + digest);
  console.log('Storage buckets / objects: ' + buckets.length + ' / ' + storageManifest.objects.length);
  console.log('Do not upload the encryption passphrase or service-role key anywhere.');
}
main().catch(error => {
  console.error('BACKUP FAILED: ' + error.message);
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(outPath, { force: true }); } catch {}
  try { fs.rmSync(checksumPath, { force: true }); } catch {}
  try { fs.rmSync(hmacPath, { force: true }); } catch {}
  try { fs.rmSync(manifestPath, { force: true }); } catch {}
  process.exitCode = 1;
});
process.on('SIGTERM', () => {
  console.error('\nTerminated; removing plaintext temporary backup files.');
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(outPath, { force: true }); } catch {}
  try { fs.rmSync(checksumPath, { force: true }); } catch {}
  try { fs.rmSync(hmacPath, { force: true }); } catch {}
  try { fs.rmSync(manifestPath, { force: true }); } catch {}
  process.exit(143);
});
process.on('SIGINT', () => {
  console.error('\nInterrupted; removing plaintext temporary backup files.');
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(outPath, { force: true }); } catch {}
  try { fs.rmSync(checksumPath, { force: true }); } catch {}
  try { fs.rmSync(hmacPath, { force: true }); } catch {}
  process.exit(130);
});
