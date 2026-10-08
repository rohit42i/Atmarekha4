alter table public.chapters
  add column if not exists chapter_list_thumbnail_desktop_url text,
  add column if not exists chapter_list_thumbnail_mobile_url text;

alter table public.pal_do_pal_ke_lamhe_chapters
  add column if not exists chapter_list_thumbnail_desktop_path text,
  add column if not exists chapter_list_thumbnail_mobile_path text;
