-- PDPKL uploader hardening: align the admin form with the production schema and fix page-management RPC variable conflicts.

alter table public.pal_do_pal_ke_lamhe_chapters
  alter column chapter_number drop not null;

alter table public.pal_do_pal_ke_lamhe_chapters
  drop constraint if exists pal_do_pal_ke_lamhe_chapters_status_check;

alter table public.pal_do_pal_ke_lamhe_chapters
  add constraint pal_do_pal_ke_lamhe_chapters_status_check
  check (status in ('Draft', 'Published', 'Archived', 'Scheduled', 'Pre-uploaded'));

create or replace function public.pdlpl_reorder_chapter_page(
  p_page_id uuid,
  p_direction integer
)
returns void
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_chapter_id uuid;
  v_current_number bigint;
  v_target_number bigint;
  v_target_id uuid;
  v_temporary_number bigint;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_page_id is null then
    raise exception 'Page ID is required';
  end if;

  if p_direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1';
  end if;

  select page.chapter_id, page.page_number
  into v_chapter_id, v_current_number
  from public.pal_do_pal_ke_lamhe_chapter_pages as page
  where page.id = p_page_id;

  if v_chapter_id is null then
    raise exception 'Page not found';
  end if;

  perform 1
  from public.pal_do_pal_ke_lamhe_chapter_pages as page
  where page.chapter_id = v_chapter_id
  order by page.page_number, page.id
  for update;

  v_target_number := v_current_number + p_direction;

  select page.id
  into v_target_id
  from public.pal_do_pal_ke_lamhe_chapter_pages as page
  where page.chapter_id = v_chapter_id
    and page.page_number = v_target_number
  order by page.id
  limit 1;

  if v_target_id is null then
    return;
  end if;

  select coalesce(max(page.page_number), 0) + 1
  into v_temporary_number
  from public.pal_do_pal_ke_lamhe_chapter_pages as page
  where page.chapter_id = v_chapter_id;

  update public.pal_do_pal_ke_lamhe_chapter_pages as page
  set page_number = v_temporary_number
  where page.id = p_page_id;

  update public.pal_do_pal_ke_lamhe_chapter_pages as page
  set page_number = v_current_number
  where page.id = v_target_id;

  update public.pal_do_pal_ke_lamhe_chapter_pages as page
  set page_number = v_target_number
  where page.id = p_page_id;
end;
$function$;

create or replace function public.pdlpl_delete_chapter_page(
  p_page_id uuid
)
returns void
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_chapter_id uuid;
  v_page_count bigint;
  v_temporary_base bigint;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_page_id is null then
    raise exception 'Page ID is required';
  end if;

  select page.chapter_id
  into v_chapter_id
  from public.pal_do_pal_ke_lamhe_chapter_pages as page
  where page.id = p_page_id;

  if v_chapter_id is null then
    raise exception 'Page not found';
  end if;

  perform 1
  from public.pal_do_pal_ke_lamhe_chapter_pages as page
  where page.chapter_id = v_chapter_id
  order by page.page_number, page.id
  for update;

  delete from public.pal_do_pal_ke_lamhe_chapter_pages
  where id = p_page_id;

  select count(*)
  into v_page_count
  from public.pal_do_pal_ke_lamhe_chapter_pages as page
  where page.chapter_id = v_chapter_id;

  if v_page_count = 0 then
    return;
  end if;

  select coalesce(max(page.page_number), 0) + v_page_count + 1
  into v_temporary_base
  from public.pal_do_pal_ke_lamhe_chapter_pages as page
  where page.chapter_id = v_chapter_id;

  with renumbered as (
    select
      page.id,
      row_number() over (order by page.page_number, page.id)::bigint as new_number
    from public.pal_do_pal_ke_lamhe_chapter_pages as page
    where page.chapter_id = v_chapter_id
  )
  update public.pal_do_pal_ke_lamhe_chapter_pages as page
  set page_number = v_temporary_base + renumbered.new_number
  from renumbered
  where page.id = renumbered.id;

  with renumbered as (
    select
      page.id,
      row_number() over (order by page.page_number, page.id)::bigint as new_number
    from public.pal_do_pal_ke_lamhe_chapter_pages as page
    where page.chapter_id = v_chapter_id
  )
  update public.pal_do_pal_ke_lamhe_chapter_pages as page
  set page_number = renumbered.new_number
  from renumbered
  where page.id = renumbered.id;
end;
$function$;

revoke all on function public.pdlpl_reorder_chapter_page(uuid, integer) from public, anon, authenticated;
grant execute on function public.pdlpl_reorder_chapter_page(uuid, integer) to authenticated;

revoke all on function public.pdlpl_delete_chapter_page(uuid) from public, anon, authenticated;
grant execute on function public.pdlpl_delete_chapter_page(uuid) to authenticated;
