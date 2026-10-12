# Proposed future backend architecture

**Design proposal only. Not implemented. Supabase remains active.**

## Principles

- Preserve current behavior until every domain contract passes compatibility tests.
- Treat database, identity, authorization, realtime, storage, payments and deployment as separate workstreams.
- Keep privileged credentials server-side. Browser code must never receive Catalyst project-management or service credentials.
- Fail closed: no provider selector or fallback until both adapters are complete and proven.
- Keep existing Cloudflare hosting, Workers/R2 and Razorpay unchanged unless a separate task authorizes changes.

## Current boundary

The Vite/React browser constructs a Supabase client in supabase.js. UI components issue direct table queries and mutations, alongside helper modules. Access is enforced jointly through Supabase Auth, RLS, SQL RPCs/triggers and Edge Functions. Cloudflare Worker assets host the site; separate Workers support media and analytics. Media access depends on current Supabase-derived auth/configuration. Razorpay side effects run through server-side Supabase functions.

## Proposed future boundaries

### Browser/presentation

Keep route, reader, theme, form and admin behavior stable. After a separately approved compatibility refactor, components should call domain-level services rather than provider SDK details. No such abstraction is safe to add now without broad call-site changes and regression testing.

### Trusted API/functions

Catalyst Advanced I/O/Node.js Functions and API Gateway are candidates for sensitive operations, multi-step writes, and server-only secrets. Every function must authenticate the caller and authorize the specific resource/action on the server. Never trust a user ID, admin role, membership plan or ownership claim supplied only in a request body.

Possible logical APIs:
- content and chapter/page reads, publication and page mutations;
- profile, identity and role resolution;
- membership/entitlement resolution;
- comments, moderation, ratings, likes, bookmarks and reading progress;
- community and chat persistence;
- admin operations, audit trail and announcements;
- privacy and push-subscription handling;
- payment endpoints only in a separately approved workstream.

Capture exact existing contracts before implementation. These are proposed domains, not proof that every endpoint has been inventoried.

### Persistence decision

Catalyst Data Store/ZCQL is not a PostgreSQL replacement by assumption. Compare the verified schema and access patterns to actual Data Store types, constraints, relationships, query capabilities, permissions and consistency. If important paths depend on arbitrary PostgreSQL queries, PL/pgSQL functions, synchronous triggers, atomic transactions/locking or RLS semantics that cannot be reproduced safely, either retain a compatible PostgreSQL target for those paths or approve a specific redesign with tested invariants.

An architecture decision record must state the selected Data Store vs PostgreSQL vs hybrid approach, the reason for every exception, data center, cost/limits and backup strategy.

### Identity and authorization

Map stable user identities and ownership references before changing Auth. Define supported sign-in methods, PKCE/session behavior, expiry/revocation, reset/recovery, email verification, TOTP MFA/step-up, admin roles and entitlement checks. Do not assume passwords or TOTP factors can be transferred. Plan a supported account recovery/reset path and explicit session cutover.

A trusted API validates token issuer, audience, signature, expiry and required auth strength. Authorization comes from verified identity plus current server-side roles/entitlements. Table scopes/security rules add protection but do not replace resource-level checks. Decide explicitly whether old Supabase tokens are supported during a controlled transition; do not create an ambiguous dual-trust mode.

### Realtime

Keep current Supabase subscriptions until an alternative is approved and proven. Signals is an event bus for publisher/target workflows; this audit has not verified a browser-facing filtered change stream or Presence equivalent. A future design may require a separately verified real-time service, authenticated WebSocket/SSE gateway, or polling with accepted UX semantics. Specify authorization, filters, order, reconnect, replay, duplicates and presence expiry.

### Storage/Cloudflare and payments

Keep Cloudflare Workers, Pages configuration, R2, object paths, media URLs, CSP, CORS and deployments unchanged. Existing media Workers validate Supabase-derived auth/configuration; an eventual identity replacement needs a separately reviewed token trust-boundary update and rollback plan. Catalyst Stratus is not part of the initial database-readiness change.

Keep Razorpay functions, webhook secrets, signature validation, idempotency, membership records and reconciliation untouched. A future payment migration needs a separate approval and sandbox validation.

## Future provider boundary (not code)

After contracts are complete, define domain interfaces such as ContentService, IdentityService, MembershipService, EngagementService, CommunityService, AdminService and PrivacyService. Interfaces should specify stable models, pagination and normalized errors. Provider-specific adapters sit behind those services. Use server functions for privileged or multi-step work rather than a generic abstraction that merely hides incompatible SQL APIs.

Do not add a provider switch environment variable until complete adapters exist and a non-production rollout proves parity. Current direct calls make this a broader refactor; this task intentionally adds no interfaces, client package, Catalyst initialization or environment toggle.

## Architecture decisions still required

1. Data Store, compatible PostgreSQL or hybrid persistence.
2. Identity/user-ID continuity, reset policy, MFA and session plan.
3. RLS-to-service authorization mapping.
4. Atomic writes, triggers, indexes and derived data.
5. Realtime/change-feed and Presence transport.
6. Source and contracts for four invoked but untracked functions.
7. Cloudflare Worker token validation after any future identity transition.
8. Backup/restore, data center, cost, availability and cutover owner.

See CAPABILITY-MAP.md and official service documentation linked there.