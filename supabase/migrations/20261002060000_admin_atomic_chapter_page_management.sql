create or replace function public.reorder_chapter_page(
  p_page_id uuid,
  p_direction integer
)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v_chapter_id uuid;
  v_current_number bigint;
  v_target_id uuid;
  v_target_number bigint;
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
  from public.chapter_pages page
  where page.id = p_page_id;

  if v_chapter_id is null then
    raise exception 'Page not found';
  end if;

  perform 1
  from public.chapter_pages page
  where page.chapter_id = v_chapter_id
  order by page.page_number, page.id
  for update;

  if p_direction = -1 then
    select page.id, page.page_number
    into v_target_id, v_target_number
    from public.chapter_pages page
    where page.chapter_id = v_chapter_id
      and (page.page_number, page.id) < (v_current_number, p_page_id)
    order by page.page_number desc, page.id desc
    limit 1;
  else
    select page.id, page.page_number
    into v_target_id, v_target_number
    from public.chapter_pages page
    where page.chapter_id = v_chapter_id
      and (page.page_number, page.id) > (v_current_number, p_page_id)
    order by page.page_number asc, page.id asc
    limit 1;
  end if;

  if v_target_id is null then
    return;
  end if;

  select coalesce(max(page.page_number), 0) + 1
  into v_temporary_number
  from public.chapter_pages page
  where page.chapter_id = v_chapter_id;

  update public.chapter_pages
  set page_number = v_temporary_number
  where id = p_page_id;

  update public.chapter_pages
  set page_number = v_current_number
  where id = v_target_id;

  update public.chapter_pages
  set page_number = v_target_number
  where id = p_page_id;
end;
$function$;

revoke execute on function public.reorder_chapter_page(uuid, integer) from public, anon;
grant execute on function public.reorder_chapter_page(uuid, integer) to authenticated;

create or replace function public.delete_chapter_page(
  p_page_id uuid
)
returns void
language plpgsql
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
  from public.chapter_pages page
  where page.id = p_page_id;

  if v_chapter_id is null then
    raise exception 'Page not found';
  end if;

  perform 1
  from public.chapter_pages page
  where page.chapter_id = v_chapter_id
  order by page.page_number, page.id
  for update;

  delete from public.chapter_pages
  where id = p_page_id;

  select count(*)
  into v_page_count
  from public.chapter_pages page
  where page.chapter_id = v_chapter_id;

  if v_page_count = 0 then
    return;
  end if;

  select coalesce(max(page.page_number), 0) + v_page_count + 1
  into v_temporary_base
  from public.chapter_pages page
  where page.chapter_id = v_chapter_id;

  with renumbered as (
    select
      page.id,
      row_number() over (order by page.page_number, page.id)::bigint as new_number
    from public.chapter_pages page
    where page.chapter_id = v_chapter_id
  )
  update public.chapter_pages page
  set page_number = v_temporary_base + renumbered.new_number
  from renumbered
  where page.id = renumbered.id;

  with renumbered as (
    select
      page.id,
      row_number() over (order by page.page_number, page.id)::bigint as new_number
    from public.chapter_pages page
    where page.chapter_id = v_chapter_id
  )
  update public.chapter_pages page
  set page_number = renumbered.new_number
  from renumbered
  where page.id = renumbered.id;
end;
$function$;

revoke execute on function public.delete_chapter_page(uuid) from public, anon;
grant execute on function public.delete_chapter_page(uuid) to authenticated;
