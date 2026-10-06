alter table public.pal_do_pal_ke_lamhe_chapters
  add column if not exists language text;

update public.pal_do_pal_ke_lamhe_chapters
set language = 'hi'
where language is null;

alter table public.pal_do_pal_ke_lamhe_chapters
  alter column language set default 'hi';

alter table public.pal_do_pal_ke_lamhe_chapters
  alter column language set not null;

alter table public.pal_do_pal_ke_lamhe_chapters
  drop constraint if exists pal_do_pal_ke_lamhe_chapters_language_check;

alter table public.pal_do_pal_ke_lamhe_chapters
  add constraint pal_do_pal_ke_lamhe_chapters_language_check
  check (language in ('en','hi'));

create unique index if not exists pdpl_chapters_number_language_unique_idx
  on public.pal_do_pal_ke_lamhe_chapters (chapter_number, language) nulls not distinct;

create index if not exists pdpl_chapters_language_number_idx
  on public.pal_do_pal_ke_lamhe_chapters (language, chapter_number);
