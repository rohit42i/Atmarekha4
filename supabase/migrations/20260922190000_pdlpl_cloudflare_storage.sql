-- Pal Do Pal Ke Lamhe: metadata stays in Supabase; manga bytes stay in Cloudflare R2.
-- This migration hardens the existing provisional tables and makes the page replacement RPC obey RLS.

alter table public.pal_do_pal_ke_lamhe_chapters
  drop constraint if exists pal_do_pal_ke_lamhe_chapters_status_check;
alter table public.pal_do_pal_ke_lamhe_chapters
  add constraint pal_do_pal_ke_lamhe_chapters_status_check
  check (status in ('Draft', 'Published', 'Archived'));

alter table public.pal_do_pal_ke_lamhe_chapters
  drop constraint if exists pal_do_pal_ke_lamhe_chapters_number_check;
alter table public.pal_do_pal_ke_lamhe_chapters
  add constraint pal_do_pal_ke_lamhe_chapters_number_check
  check (chapter_number is null or chapter_number >= 1);

alter table public.pal_do_pal_ke_lamhe_chapter_pages
  drop constraint if exists pdlpl_page_number_check;
alter table public.pal_do_pal_ke_lamhe_chapter_pages
  add constraint pdlpl_page_number_check
  check (page_number >= 1);

alter table public.pal_do_pal_ke_lamhe_chapter_pages
  drop constraint if exists pdlpl_image_path_check;
alter table public.pal_do_pal_ke_lamhe_chapter_pages
  add constraint pdlpl_image_path_check
  check (length(trim(image_path)) > 0);

create index if not exists pdlpl_pages_chapter_page_idx
  on public.pal_do_pal_ke_lamhe_chapter_pages (chapter_id, page_number);

create or replace function public.pdlpl_replace_chapter_pages(
  p_chapter_id uuid,
  p_pages jsonb
)
returns void
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  page jsonb;
begin
  if p_chapter_id is null then
    raise exception 'Chapter ID is required';
  end if;

  if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) = 0 then
    raise exception 'At least one page is required';
  end if;

  if not exists (
    select 1
    from public.pal_do_pal_ke_lamhe_chapters
    where id = p_chapter_id
  ) then
    raise exception 'Chapter not found';
  end if;

  delete from public.pal_do_pal_ke_lamhe_chapter_pages
  where chapter_id = p_chapter_id;

  for page in select value from jsonb_array_elements(p_pages)
  loop
    if (page->>'page_number') is null
       or (page->>'page_number')::bigint < 1
       or nullif(trim(page->>'image_path'), '') is null then
      raise exception 'Every page needs a valid page number and image path';
    end if;

    insert into public.pal_do_pal_ke_lamhe_chapter_pages
      (chapter_id, page_number, image_path)
    values (
      p_chapter_id,
      (page->>'page_number')::bigint,
      page->>'image_path'
    );
  end loop;
end;
$function$;

revoke all on function public.pdlpl_replace_chapter_pages(uuid, jsonb) from public;
grant execute on function public.pdlpl_replace_chapter_pages(uuid, jsonb) to authenticated;
