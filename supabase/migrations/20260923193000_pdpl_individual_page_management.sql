-- PDPL individual page management hardening.
-- Page mutations remain SECURITY INVOKER and explicitly require an admin.
-- The UI uses these operations for append, single-page replacement, reorder, and deletion.

create or replace function public.pdlpl_replace_chapter_pages(
  p_chapter_id uuid,
  p_pages jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  page jsonb;
  page_count integer;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

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

  select count(*)
  into page_count
  from jsonb_array_elements(p_pages) item
  where nullif(trim(item->>'image_path'), '') is not null;

  if page_count <> jsonb_array_length(p_pages) then
    raise exception 'Every page needs a valid image path';
  end if;

  if exists (
    select 1
    from (
      select (item->>'page_number')::bigint as page_number
      from jsonb_array_elements(p_pages) item
    ) numbers
    group by page_number
    having count(*) > 1
  ) then
    raise exception 'Page numbers must be unique';
  end if;

  for page in select value from jsonb_array_elements(p_pages)
  loop
    if (page->>'page_number') is null
       or (page->>'page_number')::bigint < 1
       or nullif(trim(page->>'image_path'), '') is null then
      raise exception 'Every page needs a valid page number and image path';
    end if;
  end loop;

  delete from public.pal_do_pal_ke_lamhe_chapter_pages
  where chapter_id = p_chapter_id;

  for page in select value from jsonb_array_elements(p_pages)
  loop
    insert into public.pal_do_pal_ke_lamhe_chapter_pages (
      chapter_id,
      page_number,
      image_path
    )
    values (
      p_chapter_id,
      (page->>'page_number')::bigint,
      trim(page->>'image_path')
    );
  end loop;
end;
$function$;

create or replace function public.pdlpl_append_chapter_pages(
  p_chapter_id uuid,
  p_pages jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  page jsonb;
  next_page bigint;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

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

  perform 1
  from public.pal_do_pal_ke_lamhe_chapters
  where id = p_chapter_id
  for update;

  if exists (
    select 1
    from jsonb_array_elements(p_pages) item
    where nullif(trim(item->>'image_path'), '') is null
  ) then
    raise exception 'Every added page needs a valid image path';
  end if;

  select coalesce(max(page_number), 0)
  into next_page
  from public.pal_do_pal_ke_lamhe_chapter_pages
  where chapter_id = p_chapter_id;

  for page in select value from jsonb_array_elements(p_pages)
  loop
    next_page := next_page + 1;

    insert into public.pal_do_pal_ke_lamhe_chapter_pages (
      chapter_id,
      page_number,
      image_path
    )
    values (
      p_chapter_id,
      next_page,
      trim(page->>'image_path')
    );
  end loop;
end;
$function$;

create or replace function public.pdlpl_replace_chapter_page(
  p_page_id uuid,
  p_image_path text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_page_id is null then
    raise exception 'Page ID is required';
  end if;

  if nullif(trim(p_image_path), '') is null then
    raise exception 'Image path is required';
  end if;

  update public.pal_do_pal_ke_lamhe_chapter_pages
  set image_path = trim(p_image_path)
  where id = p_page_id;

  if not found then
    raise exception 'Page not found';
  end if;
end;
$function$;

create or replace function public.pdlpl_reorder_chapter_page(
  p_page_id uuid,
  p_direction integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  chapter_id uuid;
  current_number bigint;
  target_number bigint;
  target_id uuid;
  temporary_number bigint;
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
  into chapter_id, current_number
  from public.pal_do_pal_ke_lamhe_chapter_pages page
  where page.id = p_page_id;

  if chapter_id is null then
    raise exception 'Page not found';
  end if;

  perform 1
  from public.pal_do_pal_ke_lamhe_chapter_pages page
  where page.chapter_id = chapter_id
  order by page.page_number, page.id
  for update;

  target_number := current_number + p_direction;

  select page.id
  into target_id
  from public.pal_do_pal_ke_lamhe_chapter_pages page
  where page.chapter_id = chapter_id
    and page.page_number = target_number
  order by page.id
  limit 1;

  if target_id is null then
    return;
  end if;

  select coalesce(max(page_number), 0) + 1
  into temporary_number
  from public.pal_do_pal_ke_lamhe_chapter_pages
  where page.chapter_id = chapter_id;

  update public.pal_do_pal_ke_lamhe_chapter_pages
  set page_number = temporary_number
  where id = p_page_id;

  update public.pal_do_pal_ke_lamhe_chapter_pages
  set page_number = current_number
  where id = target_id;

  update public.pal_do_pal_ke_lamhe_chapter_pages
  set page_number = target_number
  where id = p_page_id;
end;
$function$;

create or replace function public.pdlpl_delete_chapter_page(
  p_page_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  chapter_id uuid;
  page_count bigint;
  temporary_base bigint;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  select page.chapter_id
  into chapter_id
  from public.pal_do_pal_ke_lamhe_chapter_pages page
  where page.id = p_page_id;

  if chapter_id is null then
    raise exception 'Page not found';
  end if;

  perform 1
  from public.pal_do_pal_ke_lamhe_chapter_pages page
  where page.chapter_id = chapter_id
  order by page.page_number, page.id
  for update;

  delete from public.pal_do_pal_ke_lamhe_chapter_pages
  where id = p_page_id;

  select count(*)
  into page_count
  from public.pal_do_pal_ke_lamhe_chapter_pages page
  where page.chapter_id = chapter_id;

  if page_count = 0 then
    return;
  end if;

  select coalesce(max(page_number), 0) + page_count + 1
  into temporary_base
  from public.pal_do_pal_ke_lamhe_chapter_pages page
  where page.chapter_id = chapter_id;

  with renumbered as (
    select
      page.id,
      row_number() over (order by page.page_number, page.id)::bigint as new_number
    from public.pal_do_pal_ke_lamhe_chapter_pages page
    where page.chapter_id = chapter_id
  )
  update public.pal_do_pal_ke_lamhe_chapter_pages page
  set page_number = temporary_base + renumbered.new_number
  from renumbered
  where page.id = renumbered.id;

  with renumbered as (
    select
      page.id,
      row_number() over (order by page.page_number, page.id)::bigint as new_number
    from public.pal_do_pal_ke_lamhe_chapter_pages page
    where page.chapter_id = chapter_id
  )
  update public.pal_do_pal_ke_lamhe_chapter_pages page
  set page_number = renumbered.new_number
  from renumbered
  where page.id = renumbered.id;
end;
$function$;

revoke all on function public.pdlpl_replace_chapter_pages(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.pdlpl_replace_chapter_pages(uuid, jsonb) to authenticated;

revoke all on function public.pdlpl_append_chapter_pages(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.pdlpl_append_chapter_pages(uuid, jsonb) to authenticated;

revoke all on function public.pdlpl_replace_chapter_page(uuid, text) from public, anon, authenticated;
grant execute on function public.pdlpl_replace_chapter_page(uuid, text) to authenticated;

revoke all on function public.pdlpl_reorder_chapter_page(uuid, integer) from public, anon, authenticated;
grant execute on function public.pdlpl_reorder_chapter_page(uuid, integer) to authenticated;

revoke all on function public.pdlpl_delete_chapter_page(uuid) from public, anon, authenticated;
grant execute on function public.pdlpl_delete_chapter_page(uuid) to authenticated;
