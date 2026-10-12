# Stratus staging bucket plan

**Target:** Catalyst project `Atmarekha`, project ID `81164000000013050`, **Development only**.  
**Current state:** No Stratus buckets exist yet. Bucket creation failed because the provider returned a first-use session requirement for Stratus. This file records the intended isolated configuration; it is not evidence that buckets were created.

## One-time console step

Open the [Atmarekha Catalyst console](https://console.catalyst.zoho.in/baas/60091620701/index), choose the `Atmarekha` project and its Development environment, then open **Stratus / Storage** once and complete any initialization prompt. Do not change Production or the existing `Polls`/`Project-Rainfall` projects. After Stratus initializes, the bucket creation operation can be retried.

## Intended buckets

Names are staging-only; they do not reuse production bucket names.

| Staging bucket | Mirrors source bucket | Access type | Encryption | Versioning | Cache |
|---|---|---|---|---|---|
| `atma-stage-assets` | `assets` (public) | public | enabled | disabled | disabled |
| `atma-stage-chapter-pages` | `chapter-pages` (public) | public | enabled | disabled | disabled |
| `atma-stage-community` | `community` (public) | public | enabled | disabled | disabled |
| `atma-stage-covers` | `covers` (public) | public | enabled | disabled | disabled |
| `atma-stage-member-content` | `member-content` (private) | protected | enabled | disabled | disabled |
| `atma-stage-pdpkl-content` | `pdlpl-content` (private) | protected | enabled | disabled | disabled |

All bucket audit-consent flags should be reviewed before creation, especially for user-generated community media and protected membership content. Caching and versioning are disabled initially to avoid stale test artifacts and unnecessary staging storage growth.

## Security conditions

- **Do not copy real Storage objects yet.** This setup phase uses only synthetic fixtures.
- Public buckets should contain only material intended for public access. Never put unpublished/member-only pages in a public bucket.
- Protected buckets must be read through a server-side authorization function that checks user identity and current entitlement before issuing short-lived access. Do not expose protected object keys or credentials as a substitute for authorization.
- Do not configure a live custom domain, production object URLs, or client-side write permissions.
- Before actual migration, inventory every Supabase bucket's policies, MIME/content expectations, naming structure, signed URL expiry, cache-control rules, CDN use and references in the application code. Compare behavior and costs with Stratus.
- Confirm bucket list/count after creation and record the outcome in `CATALYST-STAGING-STATUS.md`.

## Creation parameters

For each row above, use Catalyst Stratus bucket creation with:
- `bucket_name`: the exact staging name in the table;
- `bucket_meta.type`: `public` for the four public-source buckets, `protected` for the two protected-source buckets;
- `bucket_meta.encryption`: `true`;
- `bucket_meta.versioning`: `false`;
- `bucket_meta.caching.status`: `disabled`.

These settings are the intended Development baseline and should be checked in Catalyst after creation. No creation has succeeded yet.
