# Backup and migration execution status

**Updated:** 12 October 2026 (Asia/Kolkata)  
**Current gate:** Source metadata snapshot is saved. The encrypted database-and-Storage backup has **not been executed**. No production data has been copied to Catalyst.

## Confirmed source backup situation

- Source Supabase project ref: `pbukwjokgkqacaphlqzm`, PostgreSQL 17.6.1, region `ap-south-1`.
- Supabase organization plan was checked through the connected management tool: **Free**.
- Supabase documents automatic daily database backups for Pro, Team and Enterprise plans, and recommends logical exports/off-site backups for Free-tier projects. Database backups alone do not include the actual bytes stored through the Storage API. See [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).
- No native backup/restore command is exposed by the connected Supabase MCP tools. A complete local export needs the database connection URL and a server-side Storage key, entered directly on the owner's phone.

## Metadata snapshot committed to this branch

These are **metadata/reference backups only**, not restorable data backups:

- [SOURCE-INVENTORY.json](./source-snapshot/SOURCE-INVENTORY.json): source project metadata, inventory counts, extensions, current function names/versions, and all 180 migration-history entries.
- [SOURCE-MIGRATION-HISTORY.csv](./source-snapshot/SOURCE-MIGRATION-HISTORY.csv): 180 source migration history records.
- [SOURCE-TABLE-METADATA.csv](./source-snapshot/SOURCE-TABLE-METADATA.csv): 61 table definitions and 411 source field descriptions, including nullability/default/check and key metadata.
- [CATALYST-SCHEMA-MAP.csv](./CATALYST-SCHEMA-MAP.csv): field-by-field target map and Catalyst table IDs.

No user rows, auth data, payment payloads, or Storage file bytes were committed to GitHub.

## Encrypted local backup kit prepared

- [backup-supabase.sh](../../migration-kit/backup/backup-supabase.sh)
- [backup-supabase.mjs](../../migration-kit/backup/backup-supabase.mjs)
- [Backup runbook](../../migration-kit/backup/README.md)

The kit asks for the source DB URL, server-side Storage service-role key and a unique encryption passphrase via silent prompts. It creates a PostgreSQL custom-format dump, captures a table row-count inventory, downloads every Supabase Storage object (including private buckets), puts these into one AES-256-CBC/PBKDF2-encrypted archive, verifies the dump listing and encrypted archive, calculates a SHA-256 checksum, and removes plaintext temporary files on success. A GitHub Actions syntax check passed for the backup kit.

### Required local action to create the actual backup

In Termux on the Android phone:

1. Install requirements and grant shared Downloads access as shown in the runbook.
2. Download the three backup-kit files from this branch to the same folder.
3. Run `bash ./backup-supabase.sh`.
4. Enter credentials only into the silent local prompts. Never send the database URL, service-role key or encryption passphrase to ChatGPT or GitHub.
5. Confirm the script says `Complete` and save the encrypted archive, .sha256 and .manifest.txt files. Keep the passphrase separate from the phone.

**Do not say the backup is complete unless the script succeeds.** The script has not been run from this environment.

## Current migration state

- Catalyst Development schema is staged: 61 tables / 411 source-mapped fields.
- Table permission lists have been read back for all 61 tables and match the intended model: App User has no table operations; App Administrator has CRUD.
- Three synthetic, unpublished rows in the series → chapter → page relationship were inserted and read back successfully.
- There is no real production data in Catalyst.
- Authentication, server functions, API Gateway, CORS and Storage buckets are still unconfigured. Stratus requires a first-use console session before the bucket API can create buckets.
- No production code, Supabase, Cloudflare or Razorpay settings have been changed.

## Go/no-go

**Actual data migration remains blocked** until the encrypted backup succeeds and its contents are independently restored/verified in isolation. After the backup gate, the next work is to initialize Stratus, implement and deploy reviewed Development-only functions, and verify source-to-target behavioral contracts with synthetic data. Do not copy user/auth/payment data into Catalyst or route the website there yet.

The source schema and migration-history snapshot is preserved, but it is not a substitute for the encrypted backup or restore rehearsal.

### Coverage caveat

The local kit is a **database + Supabase Storage object backup**, not a full clone of Supabase project settings. It does not export OAuth/SMTP provider secrets, project API keys, Edge Function environment secrets/deployed code, the Supabase Vault encryption root key, Cloudflare R2 objects/configuration, Razorpay settings, or the website deployment configuration. This project reports Supabase Vault installed, so follow the platform's separate Vault key/recovery procedure before calling the entire service fully recoverable. These items must be inventoried separately and stored securely outside GitHub.
