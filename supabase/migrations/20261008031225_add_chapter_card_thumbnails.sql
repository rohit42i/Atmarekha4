alter table public.chapters
  add column if not exists card_thumbnail_desktop_url text,
  add column if not exists card_thumbnail_mobile_url text;
