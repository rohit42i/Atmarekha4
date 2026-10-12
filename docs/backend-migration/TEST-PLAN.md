# Backend migration readiness and regression test plan

**Execution status:** No tests were run by this session. No local checkout, Node process or browser test environment was available through the connected tools.

## Baseline checks for a maintainer

Run in a controlled checkout of the exact baseline:
- npm ci
- npm run check
- npm run build (the prebuild hook also runs sitemap generation)
- Existing CI production dependency audit.
- Browser regression for reader, account/session, admin, membership, community/chat and media flows.

The GitHub workflow describes check/audit/build steps for pull requests targeting main; this session did not run them. package.json has no dedicated test script. Do not push this branch to main to trigger deployment conditions.

## Provider contract tests

For each domain operation, test exact request/response/error shapes, missing/invalid/expired/revoked sessions, unexpected data, null handling, pagination/order, timeout/retry behavior, rate limits and service outage. Verify privileged data never appears in browser responses or logs. Use deterministic synthetic data in a non-production environment only.

## Feature regression matrix

| Feature | Positive cases | Negative/concurrent cases |
|---|---|---|
| Chapters/pages | Published listing, languages, page order, metadata, correct access | Unpublished/missing chapter, paid page without entitlement |
| Admin page writes | Add/replace/reorder/delete pages and thumbnails | Non-admin call, partial failure, concurrent reorder, retried request and atomicity |
| Accounts/profiles | Sign-up, password login, URL session exchange, reset, logout, profile update | Invalid credentials, expired session, email collision, reused reset code, other-user privacy |
| MFA/security | TOTP enrol/challenge/verify/step-up/remove | Invalid factor/code, stale session, disabled user and bypass attempt |
| Membership | Active/expired/current period, plan resolution and chapter entitlement | Duplicate/out-of-order rows, forged client plan, revocation and concurrent subscription creation |
| Comments/ratings/reports | Create/edit/delete, parent thread, own rating, report workflow and counts | Other-user write, invalid/oversized text, duplicate like, abuse/limits and report ownership |
| Realtime/chat | Filtered comment updates, message/reaction/read receipts and presence | Unauthorized subscription, reconnect/replay, stale presence, duplicate/out-of-order event |
| Community/admin | Posts, membership, announcements, moderation and audit events | Hidden/private resource leak, missing role, direct endpoint bypass and missing audit record |
| Privacy/push | Consent and deletion request lifecycle, push subscribe/update/unsubscribe | Cross-user request, duplicate request, wrong subscription owner and rate limit |
| Payments (separate approval) | Sandbox order/subscription/webhook lifecycle, entitlement reconciliation | Invalid signature, replay, duplicate event, cancellation race, transient failure |
| Media (separate approval) | Existing R2 upload/read/delete, protected PDPKL media | Expired token, one 401 refresh, unauthorized paid page, wrong origin and URL regression |

## Authorization matrix

For every object and endpoint, explicitly test anonymous, own-user, other-user, member, moderator, admin and owner-role requests, including disabled/banned users and expired sessions. Include unpublished content and privileged security/rate-limit state. Test direct HTTP calls that bypass the UI; denial must be enforced server-side/database-side, not only by hiding UI controls.

## Schema/data validation tests (future authorized staging)

- Verify data type, nullability/default, IDs, timestamp/time-zone, unique values, parent references and delete behavior.
- Reconcile counts by entity/status/language, orphan references, key uniqueness and critical membership state.
- Compare normalized fields/checksums safely; never place personal row data in logs.
- Compare or rebuild derived rating/like/comment/view aggregates and record the reconciliation rule.
- Test idempotency, checkpoint recovery, duplicate/late events, retry after partial batch failure and conflicting updates.
- Test paginated reads across Catalyst ZCQL's documented 300-row per-query SELECT limit.
- Restore backups in isolation and validate app behavior against the restored snapshot.

## Resilience and performance

Use synthetic representative load. Test query latency, quotas, rate limits, function concurrency/timeouts, event lag, retries and external-service outages. Inject 429/5xx, timeout, stale auth and network interruptions. Retry writes only where idempotency is proven; do not automatically replay payment side effects.

## Cutover gates

No production cutover until:
- All critical contracts and authorization cases pass in staging.
- Schema/data mapping and reconciliation are signed off.
- Identity mapping, recovery, MFA/session behavior and support path pass.
- Missing endpoint implementation/contracts are resolved.
- Realtime, Worker/media auth, payment and storage dependencies have explicit plans.
- Backups restore successfully; rollback and target-write reconciliation are rehearsed.
- Monitoring/on-call and deployment approval gates are ready.
- Separate authorization approves the target environment and production cutover.

Record baseline SHA, target environment, test dataset version, command, timestamp, pass/fail, known issues, owner and approval. Redact personal data and secrets.