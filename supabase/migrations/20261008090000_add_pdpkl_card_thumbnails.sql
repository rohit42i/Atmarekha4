alter table public.pal_do_pal_ke_lamhe_chapters
  add column if not exists card_thumbnail_desktop_path text,
  add column if not exists card_thumbnail_mobile_path text;
