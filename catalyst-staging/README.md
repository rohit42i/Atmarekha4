# Atma Rekha Catalyst staging bundle

This directory is separate from the Vite website build and production deployment. Target: Zoho Catalyst **Development** only.

- Project: `Atmarekha`
- Project ID: `81164000000013050`
- Environment: `Development`
- Domain: `https://atmarekha-60091620701.development.catalystserverless.in`

## Included

### `functions/atmarekha-health`

A dependency-free Basic I/O liveness probe. It reports static staging status and does not connect to the Data Store or process identities.

### `functions/atma-rekha-api`

A first, deliberately narrow implementation slice for the migration: **read-only published chapter metadata** at `GET /v1/chapters`.

- Runs as a Catalyst Advanced I/O function using the current modular Catalyst JavaScript SDK.
- Uses a fixed allowlisted query against the mapped `chapters` table. No request-supplied SQL, table, or field name is accepted.
- Repeats the published/non-deleted check in the response mapper and explicitly allowlists output fields.
- Maps target aliases (`source_status`, `lang_code`, and `chapter_list_thumb_*`) back to the existing public response shape.
- Allows only `GET` and `OPTIONS`; CORS is restricted to the Atma Rekha origins and localhost development.
- Does **not** return page images, membership/private data, or mutations. The live website does not call this endpoint yet.

## Validation

Run from the repository root:

```sh
node --check catalyst-staging/functions/atma-rekha-api/index.js
node --check catalyst-staging/functions/atma-rekha-api/lib/public-chapters.js
node --test catalyst-staging/functions/atma-rekha-api/test/*.test.js
```

The GitHub validation workflow runs these checks on changes to the migration bundle/docs. They are code/synthetic tests only; they do not connect to Catalyst.

## Deployment and production safety

- Neither function source is deployed by these GitHub commits. The connected Catalyst tools cannot upload or deploy function source.
- The new API has **not** been verified against a live Catalyst function invocation. Do not point the website at it until it is imported into Development, dependencies resolve, the ZCQL query is verified against the target schema, and the published-chapter contract is read back and tested.
- Keep Supabase production, Cloudflare Workers/R2, Razorpay production settings, the live website and the `main` branch unchanged until the full migration and separate cutover go/no-go.
- Do not put Catalyst project-management secrets, OAuth secrets, service credentials, payment secrets, or user passwords in Vite variables or GitHub.
- Current App User table permissions are deny-all; the API uses an admin-scoped server-side SDK call for this fixed read-only public projection. Never generalize this route into a client-controlled Data Store proxy.

## SDK and runtime

The API uses Node.js 24, Express Advanced I/O, `@zcatalyst/auth` and `@zcatalyst/datastore`. Zoho's September 2026 documentation recommends the modular JavaScript SDK for new code; the older Node.js/Web SDKs entered deprecation on 1 October 2026. See the official [SDK setup](https://docs.catalyst.zoho.com/en/sdk/javascript/v1/setup/), [Node authentication configuration](https://docs.catalyst.zoho.com/en/sdk/javascript/v1/auth-config/node-consideration/) and [DataStore ZCQL](https://docs.catalyst.zoho.com/en/sdk/javascript/v1/cloudscale/datastore/query-datastore/) documentation.
