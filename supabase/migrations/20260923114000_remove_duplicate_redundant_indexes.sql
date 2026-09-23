-- Remove duplicate indexes that provide no additional constraint or query coverage.
drop index if exists public.admins_user_id_uidx;
drop index if exists public.pdlpl_pages_chapter_page_idx;
