-- Allow the same chapter number in multiple language variants.
-- The composite unique index (chapter_number, language) is the intended constraint.
alter table public.pal_do_pal_ke_lamhe_chapters
  drop constraint if exists pdlpl_chapters_number_unique;

create unique index if not exists pdpl_chapters_number_language_unique_idx
  on public.pal_do_pal_ke_lamhe_chapters (chapter_number, language) nulls not distinct;
