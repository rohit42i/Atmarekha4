# Owner execution steps — Supabase to Zoho Catalyst (Development first)

**Updated:** 16 October 2026  
**Target:** Zoho Catalyst project `Atmarekha`, project ID `81164000000013050`, `Development` environment only.  
**Production rule:** Keep the live site, Supabase, Cloudflare Workers/R2, GitHub `main`, and Razorpay live webhook unchanged until a separate migration/cutover approval.

## Current actual state

- Source Supabase ref: `pbukwjokgkqacaphlqzm`.
- Catalyst Development: 61 mapped Data Store tables / 411 source-mapped fields; 448 partial source rows plus 3 synthetic test fixtures are already present. Do not treat this as a complete migration.
- Catalyst currently has zero deployed functions, zero Stratus buckets, authentication disabled, public signup disabled, and API Gateway disabled.
- The 16 October read-only check did not create resources, move data, set secrets, or change production routing.
- An encrypted DB + Storage backup has **not** yet been created or restore-tested.
- The migration-kit backup scripts were hardened in this branch. GitHub Actions run #48 passed JavaScript syntax, shell syntax, and metadata parsing checks. That validates source syntax only; it does not execute a real backup.

## Phase 1 — Create a private source backup on your Android phone

Do this before copying any more source records to Catalyst.

### A. Install Termux requirements

Open Termux and run:

```sh
pkg update -y
pkg install -y nodejs postgresql openssl tar coreutils curl
termux-setup-storage
```

Approve Android's storage permission dialog. Return to Termux after permission is granted.

### B. Download the current backup kit

Run these commands in Termux. They download from the existing migration branch; they do not touch the live site or `main`.

```sh
mkdir -p ~/atma-migration-backup
cd ~/atma-migration-backup
BASE='https://raw.githubusercontent.com/rohit42i/Atmarekha4/docs/backend-migration-readiness-2026-10-12/migration-kit/backup'
curl -fL "$BASE/backup-supabase.sh" -o backup-supabase.sh
curl -fL "$BASE/backup-supabase.mjs" -o backup-supabase.mjs
curl -fL "$BASE/verify-backup.sh" -o verify-backup.sh
curl -fL "$BASE/verify-backup.mjs" -o verify-backup.mjs
chmod 700 backup-supabase.sh verify-backup.sh
```

### C. Run the backup

```sh
bash ./backup-supabase.sh
```

The script will request four inputs, with values hidden while you type:

1. **Supabase database connection URL:** obtain this from the Supabase dashboard for project `Atmarekha` → Connect. Prefer the direct database host if it works; otherwise use that project's **Session Pooler** connection URL. Do not use a URL from another Supabase project.
2. **Server-side Storage credential:** use the source project's service-role/server secret key that has Storage read access. Never use a publishable/anon key for this backup.
3. **Encryption passphrase:** at least 20 characters, randomly generated if possible. Save it offline in a password manager or another safe location separate from the archive.
4. Re-enter the passphrase to confirm it.

**Important safeguards in the updated script:** it rejects a database URL that does not match this project's expected direct-host or project-specific pooler pattern; it verifies that the exact six inventoried Storage buckets are present with the expected public/private split; it writes owner-only local files; and it avoids passing the database URL, Storage key, or passphrase to spawned utility processes unless required. If the bucket inventory/security settings have changed, the script stops instead of silently backing up a different set.

### D. Confirm and verify the backup

The script should end with `6/6 Complete` and show the archive location, SHA-256, and Storage bucket/object counts. It writes the encrypted archive and these sidecars under:

`~/storage/downloads/Atmarekha-Backups/`

The actual database and Storage bytes remain local. Do not upload the archive, unencrypted dump, service key, database URL, or passphrase to GitHub or ChatGPT.

Then run:

```sh
bash ./verify-backup.sh
```

At the prompt, enter the full path to the `.tar.gz.enc` archive and the same passphrase. The verifier must report that checksum, HMAC authentication, decryption/package structure, and PostgreSQL archive listing all passed.

Keep the encrypted archive plus its `.sha256`, `.hmac`, and `.manifest.txt` sidecars together. Keep the passphrase separately. If the script or verifier fails, stop and share **only the non-secret error text**. Never paste the URL/key/passphrase or raw data.

**This verification is not a restore rehearsal.** Before any cutover, restore into a separate disposable PostgreSQL/Supabase target and reconcile the schema, row counts, and key application flows. Do not use the live source or the existing partially imported Catalyst project as the restore destination.

## Phase 2 — Initialize Catalyst Stratus in Development

This requires one owner action because Zoho returned a first-use session error through the connector.

1. Open the [Catalyst console](https://console.catalyst.zoho.in/baas/60091620701/index).
2. Select project **Atmarekha** (ID `81164000000013050`).
3. Confirm the environment is **Development**, not Production.
4. Open **Stratus / Storage** and complete any first-time initialization prompt. Do not create or modify buckets in a different project.
5. Return here and tell me only: **“Stratus initialized in Atmarekha Development.”** No credentials are needed in chat.

After initialization, the six intended staging buckets can be retried and then read back to verify their settings:

| Staging bucket | Source bucket | Intended access |
|---|---|---|
| `atma-stage-assets` | `assets` | Public objects only |
| `atma-stage-chapter-pages` | `chapter-pages` | Public objects only |
| `atma-stage-community` | `community` | Public objects only |
| `atma-stage-covers` | `covers` | Public objects only |
| `atma-stage-member-content` | `member-content` | Authenticated/protected |
| `atma-stage-pdpkl-content` | `pdlpl-content` | Authenticated/protected |

Enable AES-256 encryption for every bucket. Leave caching and versioning off initially. Do not copy real/private content yet. A public bucket is public to the internet; it is not appropriate for unpublished or member-only pages.

## Phase 3 — Deploy only the harmless Development health probe

This phase must not deploy the full migration or turn on public APIs.

The source-only health probe is in `catalyst-staging/functions/atmarekha-health/`. It returns a static Development status and does not touch data, identity, secrets, payments, or Cloudflare. It is not yet deployed.

The supported Catalyst CLI workflow is the route to use if the console does not offer source upload. On an Android Termux session, install the official `catalyst-cli`, log in, and work only from a local copy of this migration branch. Before any deploy, confirm the CLI's selected project is **Atmarekha** and its selected environment is **Development**. Do not run a root-level `catalyst deploy` from the website repository: that could deploy unrelated resources. Deploy only the `atmarekha-health` function target and verify the URL returned by Catalyst. The deployment URL must be copied from Catalyst itself, not guessed.

Official references:
- [Catalyst CLI first-function workflow](https://catalyst.zoho.com/cookbook/catalyst-101/deploy-first-function/)
- [Catalyst function deployment](https://docs.catalyst.zoho.com/en/cli/v1/deploy-resources/deploy-functions/)

If CLI login/project selection on Android is unclear, stop before deploying and share a screenshot of the **Development project selector only** with secrets and account details hidden.

## Phase 4 — Backend/auth design and implementation (not ready yet)

Do not enable public signup or API Gateway yet. The remaining engineering work is not a console toggle:

1. Semantically reconcile 180 live Supabase migration-ledger records with 65 tracked SQL migration files.
2. Review the seven deployed-only Supabase Edge Function sources recovered to this branch and compare all 16 deployed function contracts with the website callers.
3. Port and test domain operations while preserving UUIDs, numeric precision, JSON/array serialization, uniqueness, foreign-key/ownership rules, validation, deletion behavior, transaction/atomicity and aggregates. Catalyst Data Store does not automatically reproduce PostgreSQL constraints, triggers, RLS, transactions, or PL/pgSQL logic.
4. Design account continuity and recovery before configuring Catalyst Authentication. User identities/password credentials have not been migrated; switching login providers without a tested identity/session plan would lock users out.
5. Add server-side authorization, admin/resource ownership checks, rate limits, pagination, audit events, safe errors, idempotency, and automated contract/security tests.
6. Test synthetic-only user roles (anonymous, own user, other user, member, moderator, admin), failed requests, retries, concurrency, privacy deletion, push, realtime/chat, and storage access.
7. Restore the backup in isolation and rehearse a migration plus rollback before any production decision.

Only after those checks pass should the Development API surface, exact CORS origins, auth callback/redirects, and limited test credentials be configured. CORS is not an authorization system.

## Phase 5 — Razorpay setup (test mode first, live webhook unchanged)

The existing Supabase webhook is `razorpay-subscription-webhook`; it reads `RAZORPAY_WEBHOOK_SECRET`, validates the **raw request body** with HMAC-SHA256 against `x-razorpay-signature`, and deduplicates using `x-razorpay-event-id` (or a body hash fallback). The replacement must preserve signature validation, deduplication, subscription state mapping, and paid-period cancellation semantics before it is trusted.

1. Implement and deploy a reviewed Catalyst Development webhook handler first. Its endpoint must be copied from the actual Catalyst deployment/API Gateway output.
2. Store `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` only as server-side Development secrets. Never put them in `VITE_*` environment variables or source files.
3. In Razorpay **Test Mode**, add a separate staging webhook pointing to the confirmed Development endpoint and set a new test webhook secret. Select only the events the implementation handles and verify signature failure, duplicate delivery, retry, out-of-order events, cancellation at period end, and entitlement reconciliation.
4. Confirm the matching test orders/subscriptions are created and verified by the corresponding Development functions. Use no live key or live webhook endpoint during staging.
5. Keep the current live Supabase webhook enabled until a separate production cutover is approved and a rollback/replay plan exists. Do not repoint a live webhook to an unverified function.

Razorpay signs the exact raw HTTP request body; parse-after-signing or re-serialized JSON will break verification. Official guidance: [Razorpay webhook signature validation](https://github.com/razorpay/razorpay.github.io/blob/master/docs/webhooks/validate-test.md).

## Phase 6 — Cloudflare / R2 handling (keep current resources unchanged)

The current site has a Cloudflare media Worker at `https://tiny-pond-c959.rohitbaswaraj.workers.dev`; the R2 bucket is `atma-rekha-manga`. The website's existing `supabase.js` routes `chapter-pages`, `covers`, and `community` through that Worker. The current Worker also manages the actual access path to R2.

- Do not create replacement production R2 credentials or alter Worker bindings as part of staging.
- Never place Cloudflare account tokens, R2 secret access keys, or shared signing secrets in browser-visible `VITE_*` variables or GitHub source.
- Do not point protected PDPKL/member media directly at a public bucket.
- Prefer the existing Worker boundary for object access. If a future Catalyst server function needs a privileged Worker call, implement and test a narrow server-to-server contract and store any shared secret on server-side secret stores only. Do not expose R2 credentials to the browser.
- Verify upload, read, delete, media path normalization, auth headers, 401 refresh behavior, and protected-content entitlement before any change to the production Worker or its secrets.

Cloudflare reference: [Use R2 from Workers](https://developers.cloudflare.com/r2/api/workers/).

## Phase 7 — Production cutover (separate approval required)

There is no authorized production cutover in this plan. Do not merge PR #60, change the live app's environment variables, change the GitHub main deployment workflow, enable production Catalyst signup/API routes, transfer more real data, rotate live credentials, or repoint Razorpay's live webhook until all gates below are signed off:

- Verified encrypted source backup and successful isolated restore.
- Complete schema/data reconciliation with sensitive-data review.
- All critical contract, authorization, payment, media, privacy, concurrency, and recovery tests passed.
- Identity mapping/recovery, webhook idempotency, and entitlement consistency proven.
- Cloudflare and Razorpay staging regressions passed.
- Final-write reconciliation, monitoring, incident owner, cutover window and tested rollback documented.
- A separate explicit authorization for Production is received.

**Current next action:** run Phase 1 on Termux; then initialize Stratus as in Phase 2. Report only success/failure and non-secret error text. No secret values are needed in chat.
