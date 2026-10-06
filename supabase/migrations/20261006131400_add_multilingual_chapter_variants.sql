-- Multilingual Atma Rekha chapter variants.
-- Existing chapters are preserved as Hindi. English variants get their own rows,
-- page/cover objects and engagement records through the chapter UUID.

alter table public.chapters drop constraint if exists chapters_chapter_number_unique;

alter table public.chapters add column if not exists language text;
update public.chapters set language = 'hi' where language is null;
alter table public.chapters alter column language set default 'hi';
alter table public.chapters alter column language set not null;

alter table public.chapters drop constraint if exists chapters_language_check;
alter table public.chapters
  add constraint chapters_language_check check (language in ('en','hi'));

create unique index if not exists chapters_manga_number_language_unique_idx
  on public.chapters (manga_id, chapter_number, language) nulls not distinct;

create index if not exists chapters_manga_language_number_idx
  on public.chapters (manga_id, language, chapter_number);
