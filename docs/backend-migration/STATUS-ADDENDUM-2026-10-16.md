# Supabase → Zoho Catalyst migration: live verification addendum

**Checked:** 16 October 2026 (UTC)  
**Scope:** Catalyst Development only. Supabase remains production.

## Direct checks performed

- **Source application schema:** Live Supabase metadata exposes 59 tables in `public` and 2 tables in `private` = **61 application tables**. The live public-table metadata contains **396 columns**; the two private tables contain 15 columns, giving **411 source columns**. This reconciles the earlier 61-table / 411-column inventory.
- **Catalyst Datastore:** Live listing returns **62 tables**. The 61 application tables are represented; the two private source tables are mapped with `private_` prefixes (`dpdp_breach_incidents` → `private_dpdp_breach_incidents`, `feedback_rate_limits` → `private_feedback_rate_limits`). There is also a target-only `migration_timestamp_precision_archive` table that must be classified as migration metadata and checked for any non-fixture data before acceptance.
- **Column mapping caveat:** Catalyst tables use Datastore system fields (`ROWID`, `CREATORID`, `CREATEDTIME`, `MODIFIEDTIME`) and at least some source fields are explicitly renamed to `source_*` fields (for example, `status` → `source_status`, `created_at` → `source_created_at` in `chapters`). Table-name parity is therefore not proof of column-level parity. Full field-by-field type/nullability/constraint verification remains open.
- **Catalyst Functions:** Direct listing returns **0 functions**. No replacement for any of the 16 active Supabase Edge Functions is deployed in Catalyst.
- **Catalyst CORS (Development):** Added and re-read `atmarekha.in` and `www.atmarekha.in` as allowed CORS origins, with iframe embedding disabled for both. This does not create API routes or deploy functions.
- **Catalyst authentication:** Latest live configuration says `hosted_auth=true`, `public_signup=true`, `embedded_auth=false`, and `third_party_auth=false`. This means Catalyst hosted authentication is configured, not that Supabase identity records, password hashes, sessions, JWT validation, admin roles, or application login flows have been migrated or tested.
- **Catalyst Stratus:** Direct bucket listing returns **0 buckets**. The user reports that six folders were created in Catalyst **File Store**, with underscores in names where the UI would not accept hyphens. File Store folders are not Stratus buckets; the available Catalyst connector does not expose File Store folder enumeration/transfer tools, so folder contents and permissions could not be independently verified here.
- **Production safety:** No production cutover was performed. Keep Supabase as the live backend. Keep GitHub `main`, Cloudflare Workers/R2, and the deployment pipeline unchanged. Keep PR #60 draft and unmerged.

## Exact remaining work

1. **Field-level schema reconciliation:** Compare all 411 source fields against the 61 mapped Catalyst tables, including type conversion, nullability, defaults, checks/enums, unique keys, composite keys, foreign-key semantics, timestamp precision, JSONB handling, and generated/system fields. Resolve each mismatch in the migration branch and rerun the comparison.
2. **Data reconciliation:** Produce per-table source/target counts and key-set/hash checks; distinguish real imported records from synthetic smoke fixtures; identify missing, duplicate, target-only, or stale rows. Do not delete target rows until fixtures are positively identified.
3. **Private tables and permissions:** Confirm both private-source mappings remain inaccessible to public/App User roles and that server-only functions are the only access path for sensitive data. Re-check all table permissions and scopes.
4. **File Store / media:** Independently verify the six File Store folders and contents in the Catalyst console; map underscore folder names to original Supabase bucket names in a backend storage adapter. Preserve private access for `member-content` and `pdlpl-content`. Transfer/verify objects and content hashes before any cutover. Separately initialize Stratus only if the selected Catalyst storage architecture actually requires it.
5. **Authentication:** Design and test identity migration and session/JWT compatibility. Do not assume hosted auth or a same-email account creates identity continuity. Do not migrate password hashes unless Zoho's supported import flow explicitly permits it. Test signup, login, password reset, logout, session expiry, account deletion, and admin authorization.
6. **Function porting:** Port all 16 functions to Catalyst-compatible Node.js functions; replace Supabase-specific Auth/DB/Storage/RPC calls with tested Catalyst adapters; retain payment/webhook signature checks, idempotency, rate limits, authorization, DPDP controls, and push/email behaviour. The connected Catalyst tool set can list/update/execute existing functions but exposes no create/deploy-function operation, so deployment cannot be completed through this connection.
7. **External integrations:** Configure Razorpay keys/webhook endpoint and email/push secrets only in Catalyst server-side configuration. Verify webhook retries and signature checks without touching production Razorpay configuration.
8. **Recovery and tests:** Restore the encrypted backup into an isolated disposable PostgreSQL database; integrity checks alone are not a restore rehearsal. Run unit, integration, security, privacy, payment sandbox, file access, and rollback tests.
9. **Cutover gate:** Only after all above evidence passes, review the draft PR and ask for explicit approval before changing production routing.

## Current conclusion

**Migration is not complete and is not safe to cut over.** The Datastore table count and source column inventory now reconcile at the table-count level, but field-level parity, complete data verification, media transfer, identity continuity, all 16 function replacements, and restore/end-to-end tests remain release blockers.
