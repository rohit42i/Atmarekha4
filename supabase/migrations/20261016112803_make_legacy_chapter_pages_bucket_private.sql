-- Keep legacy Supabase Storage chapter-page objects from bypassing the
-- authorization checks in the Atma media Worker.
-- Production database migration version: 20261016112803.
UPDATE storage.buckets
SET public = false
WHERE id = 'chapter-pages'
  AND public IS DISTINCT FROM false;
