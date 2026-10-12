# Create a local encrypted source backup (Android / Termux)

This backup kit is prepared for Atma Rekha's Supabase source project. It is **not yet run**: the database password and Storage service-role credential must be entered locally so neither enters this conversation or GitHub.

## What it creates

- A PostgreSQL custom-format dump of database schemas and rows accessible to the database role.
- A tab-separated row-count inventory for all database tables.
- A local copy of all objects in every Supabase Storage bucket, including private buckets.
- One combined archive encrypted with AES-256-CBC + PBKDF2-HMAC-SHA256 (600,000 iterations).
- A SHA-256 checksum, passphrase-derived HMAC-SHA256 authentication sidecar, and plain metadata manifest that contain no row payloads, object paths or secrets.
- Archive checks using pg_restore --list and a decrypt-and-tar-list validation. The separate verifier checks SHA-256 + HMAC before decrypting.

The script does **not** upload database rows or Storage objects to GitHub. Temporary plaintext files are removed after successful encryption. A restore rehearsal is still required.

## Run on Android

1. In Termux, install requirements and grant shared-storage access:

   pkg update
   pkg install nodejs postgresql openssl tar coreutils
   termux-setup-storage

2. Download both files from this branch into the same folder:
   - [backup-supabase.sh](./backup-supabase.sh)
   - [backup-supabase.mjs](./backup-supabase.mjs)

3. From that folder, run:

   chmod 700 backup-supabase.sh
   bash ./backup-supabase.sh

4. Enter the prompted values:
   - Database connection URL from Supabase Dashboard → Connect. Use Session Pooler if direct DB connectivity is not available.
   - The source project's server-side service_role key, **not** the anon/publishable key. Never paste this key into ChatGPT or commit it.
   - A unique encryption passphrase at least 20 characters long. Save it offline in a password manager or another secure location separate from the phone.

The prompts do not echo values. Output is saved under ~/storage/downloads/Atmarekha-Backups/. Keep the encrypted .tar.gz.enc, .sha256 and .manifest.txt files together.

## Failure handling and limitations

- If pg_dump fails, no backup is declared complete.
- If Storage reports an authorization error, confirm the key belongs to this source project. Do not bypass auth or make private buckets public.
- If interrupted, inspect and delete any plaintext atma-backup-* temp working folder before retrying.
- Never upload an unencrypted database dump, Storage folder, database URL, service key or encryption passphrase.
- Successful archive checks are not the same as a restore rehearsal. Restore into an isolated target and verify core behavior before cutover.

Official guidance: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups) and [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Database backups don't contain the actual bytes held in Supabase Storage, which this kit separately downloads.

## Important limitations

This is a **database + Storage-object backup**, not a full Supabase project clone. It does not export project-level settings, OAuth/SMTP provider secrets, project API keys, Edge Function environment secrets or deployed function source, the Supabase Vault encryption root key, Cloudflare R2 objects/configuration, Razorpay configuration, or the application deployment configuration. Preserve those separately via their official consoles and a secure password manager. The PostgreSQL dump may include Supabase Auth and Storage metadata if the connected database role can access those schemas, but project Auth-provider settings are separate. Because pgcrypto/Supabase Vault is enabled on the source, separately verify the Vault/encryption-key recovery procedure before considering the source fully recoverable.


### Verify the backup before moving it

After a successful backup, run the included verifier. It asks for the encrypted archive path and the same passphrase, checks the SHA-256 checksum and authenticated HMAC, decrypts in a temporary folder, validates the archive listing, and runs pg_restore --list against the included database dump. It cleans up temporary plaintext files when finished.

```sh
chmod 700 verify-backup.sh
bash ./verify-backup.sh
```

A successful verifier is still not a restore rehearsal. Keep the encrypted archive plus its .sha256, .hmac, and .manifest.txt files together.
