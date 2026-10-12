# Future migration operations and safety controls

**Current state:** This change did not connect Catalyst to Atma Rekha runtime. Supabase, Cloudflare and Razorpay remain unchanged.

## Environment separation

Only after explicit authorization, use a dedicated Catalyst development/test project and separately configured production project. Verify region/data center, service availability, data residency, quota and cost first. Separate identities, redirect origins, secrets, quotas and logs. Experiments must not point to production data.

The current GitHub workflow has push-to-main deployment/infrastructure steps. No workflow changes are part of this task. Future implementation CI must prove branch/PR jobs cannot deploy or read production credentials.

## Secrets

- Never put Catalyst client secrets, admin credentials, service keys, signing keys or database passwords in Vite-prefixed variables.
- Keep server secrets in the selected platform's secret store, scoped to the minimum function/environment.
- Do not log authorization headers, access/refresh tokens, reset/MFA codes, payment signatures, webhook secrets or user payloads.
- Keep a metadata inventory of secret name, owner, purpose, environment and rotation date only; never commit values.
- Use least-privileged CI identities. Untrusted pull-request workflows must not access production credentials.
- Rotate credentials via an approved incident/change procedure if exposure is suspected.

## Access and security

Enforce token signature/issuer/audience/expiry and resource-level authorization at trusted server boundaries. UI role hiding and CORS are not authorization. Use least-privilege Catalyst project roles, service accounts and Data Store/API permissions. Keep the existing RLS source until the replacement model is independently reviewed. Audit admin, payment, privacy and migration actions.

## Monitoring

Future production monitoring should cover function latency/errors/timeouts, 429 rates, auth/MFA failures, rejected admin/resource accesses, event lag, migration checkpoints, row/aggregate reconciliation, webhook signatures, entitlement drift, backup/restore success and configuration changes. Use correlation IDs and safe error codes; redact personal data. Define retention and log access in advance.

## Backups and recovery

Before any separately approved migration:
- Verify source backup/export capability and retention.
- Save a schema-only snapshot; handle any authorized data backup separately and do not commit it to Git.
- Take recoverable target snapshots before each schema/data batch.
- Restore both source and target in isolation and prove the restore, not just job completion.
- Protect encryption keys separately, restrict access, set retention and schedule recovery drills.
- Define recovery point/time objectives and the go/no-go owner.

Checked-in migrations are not a complete source-schema backup.

## Deployment and change control

Use feature branches and small reviewable diffs; never commit directly to main. Run static checks, contract/security tests, dependency audit and secret scanning. Promote a tested immutable build through human approval. Confirm exact SHA and environment before deploying. Treat infrastructure changes, secret updates and app cutover as distinct approved changes. No merge or deploy from this task.

## Incident and rollback playbook

1. Stop rollout and prevent further divergent writes.
2. Preserve checkpoints/logs safely and redact sensitive payloads.
3. Establish which backend is authoritative and whether target-only writes exist.
4. Follow the rehearsed rollback/reconciliation plan; do not blindly route back if writes would be lost.
5. Verify identity, critical entitlements, counts and authorization before restoring traffic.
6. Record root cause and preventive tests without exposing secrets.

Do not use unsupervised browser dual writes. Use an approved write-freeze/final-delta or durable outbox/change-log strategy with idempotency and reconciliation. Payment or identity incidents require their own owner decisions.

## Future operational go/no-go checklist

- [ ] Development/production separation, data center, cost and limits verified.
- [ ] Schema/RLS/function and identity design approved.
- [ ] Missing invoked endpoint sources/contracts resolved.
- [ ] Source/target backups restored successfully.
- [ ] Contract/access/MFA/rate-limit tests pass.
- [ ] Realtime and Cloudflare Worker/media token plan approved.
- [ ] Data mapping, pagination, idempotency and reconciliation tested.
- [ ] Payment sandbox verified under separate approval.
- [ ] Monitoring, alerts, incident ownership and rollback rehearsal complete.
- [ ] Separate production deployment/cutover authorization received.

## Official documentation

- [Catalyst Functions](https://docs.catalyst.zoho.com/en/serverless/help/functions/introduction/)
- [Catalyst Authentication](https://docs.catalyst.zoho.com/en/cloud-scale/help/authentication/introduction/)
- [Catalyst Data Store columns](https://docs.catalyst.zoho.com/en/cloud-scale/help/data-store/columns/)
- [ZCQL SELECT/pagination](https://docs.catalyst.zoho.com/en/cloud-scale/help/zcql/select/)
- [Catalyst Signals](https://docs.catalyst.zoho.com/en/signals/getting-started/introduction/)
- [Stratus permissions](https://docs.catalyst.zoho.com/en/cloud-scale/help/stratus/stratus-permissions/)

## Environment status after read-only audit — 12 October 2026

- Production Supabase remains `ACTIVE_HEALTHY` in `ap-south-1`, PostgreSQL 17. Do not pause, reconfigure, or replace it during readiness work.
- The live database migration ledger (180 entries) and tracked SQL migration directory (65 files) do not reconcile by normalized name. Freeze migration writes until a reviewed mapping and full schema baseline are available.
- All 16 active deployed Supabase Edge Functions were inventoried. The seven deployed-only handlers (`delete-account`, `send-chapter-notification`, `send-chapter-notification-v2`, `send-email-to-users`, `get-admin-console-data`, `dpdp-data-rights`, `submit-feedback`) have now had their source files recovered into the migration branch after a basic literal-secret-pattern scan. These commits are source backups only; no function was deployed or modified in Supabase. Review the recovered source against current behavior before replacement.
- Read-only Catalyst listing did not identify a project clearly dedicated to Atma Rekha. Do not repurpose an unrelated project. The available MCP tool list did not expose project creation; create a separate Development project through the Catalyst console only after confirming India-region requirements, quotas, ownership and costs.
- No encrypted database/Storage backup or restore rehearsal has been run or verified. A backup is not proven usable until an isolated restore rehearsal succeeds. The existing Catalyst Development import is partial (448 source rows plus three synthetic fixtures); source row-count comparison identifies 89 source rows absent from target in six deferred/operational tables. Keep the target closed pending data-sensitivity review, and keep Supabase, Cloudflare R2/Workers, Razorpay and the production website unchanged.

## Actual staging target — verified 12 October 2026

- Catalyst organization: `60091620701` (Zoho India).
- Project: `Atmarekha`; project ID `81164000000013050`; active Development environment.
- Development domain: `https://atmarekha-60091620701.development.catalystserverless.in`.
- The existing `Polls` and `Project-Rainfall` projects were not changed.
- All 61 source tables and 411 source fields are mapped into Catalyst Data Store. The exact table IDs and field-name/type conversions are committed in `CATALYST-SCHEMA-MAP.csv`.
- Data Store access is deny-by-default for the Catalyst `App User` role. Do not enable it until the server-side authz implementation is complete.

### Blocked first-use action

Stratus reports: “User needs to be in session when accessing Stratus for the first time.” The owner must open the target project in the Catalyst console, open **Stratus / Storage** once, and complete any prompted setup. Only after this step should the setup be resumed to create the six `atma-stage-*` buckets using the access split in `STRATUS-SETUP.md` (four public-source buckets and two protected buckets, all with encryption). Bucket creation attempts failed and created no buckets.

### Current non-configured services

Catalyst Authentication (hosted/embedded/third-party), API Gateway, routes, CORS domains, functions, buckets, mail configs, scheduled jobs, payment integrations, Realtime/chat transport and production routing remain unconfigured. The available Catalyst MCP does not provide live function resource creation/upload/deployment operations; the minimal health-probe source scaffold is in `catalyst-staging/` on this branch only. Use the supported console or CLI workflow, with code reviewed and deployed to Development only.

## SDK/version selection note — 12 October 2026

Zoho's official September 2026 release notes state that the modular Catalyst JavaScript SDK is generally available and replaces the separate Node.js and Web SDKs. The Node.js SDK v2 and Web SDK v4 entered deprecation on 1 October 2026, with support termination announced for 1 October 2027. New function work should therefore use the current JavaScript SDK after verifying the current API and function bundle structure, rather than starting a fresh implementation on a deprecated SDK. See [Catalyst SDK release notes](https://docs.catalyst.zoho.com/en/release-notes/sdk/) and [function implementation guidance](https://docs.catalyst.zoho.com/en/serverless/help/functions/implementation/).
