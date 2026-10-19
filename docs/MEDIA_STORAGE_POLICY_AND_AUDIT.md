# Website media storage policy and audit

Audit date: 19 October 2026

## Storage boundary

- Supabase is used for application data, authentication, database queries and Edge Functions. It must not be used as a fallback for website media files.
- Atma Rekha manga pages, chapter covers, thumbnails and community uploads use Cloudflare R2 bucket `atma-rekha-manga` through the `tiny-pond-c959` media Worker.
- Pal Do Pal Ke Lamhe artwork uses the separate `pdlpl-manga` R2 bucket through the `pdlpl-media` Worker.
- The browser adapter supports only the explicit Atma media buckets `chapter-pages`, `covers` and `community`. Any unknown bucket must fail with an error; it must not silently switch to Supabase Storage.
- The admin media library uploads image files to R2 under `covers/media/`; it does not accept arbitrary external image URLs. Deleting a media item removes its R2 object and records cleanup failures for follow-up.
- Bundled files under `public/` (for example, fixed UI icons and the preset avatar images) are static website assets deployed with the site, not user uploads or Supabase Storage objects.

## Live database URL audit

The live Supabase database was inspected read-only on 19 October 2026. Active URLs in the inspected media fields did not point to Supabase Storage. The chapter pages (38 rows), chapter covers (3 rows) and community post images (2 rows) use Cloudflare Worker URLs. The community attachment URL fields were blank. The media library and member-content image fields had no rows. Preset profile avatars use local static paths or are blank.

One chapter-list thumbnail field referenced an object key that did not exist in the R2 bucket and did not match the media Worker's supported path allow-list. It was repaired to use that chapter's existing R2 cover URL. The resulting URL points to the verified object `covers/chapters/a6ddc25b-c814-4ad2-8386-58ce94639586/cover-1789677679658.png`.

## Legacy Supabase Storage objects

The old Supabase Storage buckets currently contain 22 entries:

| Bucket | Entries |
| --- | ---: |
| `chapter-pages` | 10 |
| `covers` | 9 |
| `community` | 3 |

The `assets`, `member-content` and `pdlpl-content` buckets are empty. All three community objects have matching object keys and sizes in R2. The remaining 18 page/cover objects and one empty-folder placeholder are legacy entries; their old paths do not match current live image URLs inspected above.

These old objects were deliberately preserved. This change does not claim they were migrated, and does not delete them: the available audit establishes that current database URLs do not reference them, but it does not prove byte-for-byte equivalence or rule out historical/backup value. If they are needed, copy them through a controlled export/import, verify checksums in R2, and reconcile any database references before removing the old copies.

## Regression checks

Run `npm run check`. The media check verifies that:

- unsupported buckets fail closed instead of falling back to Supabase Storage;
- community uploads, URL generation and cleanup use the explicit R2 adapter;
- Atma and PDPKL upload/read paths remain routed through their Cloudflare media Workers;
- the app and function source do not reintroduce direct `supabase.storage.from(...)` calls.
