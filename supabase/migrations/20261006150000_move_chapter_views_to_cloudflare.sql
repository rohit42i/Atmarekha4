-- Move raw chapter-view event storage out of Supabase.
-- Cloudflare Analytics Engine receives new view events; R2 stores long-term
-- daily/monthly summaries. Keep the legacy rows for historical reference,
-- but stop public inserts once the analytics Worker is deployed.
drop policy if exists "Public can record chapter views" on public.chapter_views;
revoke insert on table public.chapter_views from anon, authenticated;
comment on table public.chapter_views is
  'Legacy chapter-view events retained for historical reference; new public view tracking is handled by Cloudflare Analytics Engine.';
