-- Harden PDPKL publishing so every publish path records a publication time, verifies admin access, and refuses empty chapters.
create or replace function public.pdlpl_set_chapter_status(
  p_chapter_id uuid,
  p_status text,
  p_release_date timestamptz default null
)
returns table (
  id uuid,
  status text,
  release_date timestamptz
)
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_status text;
  v_release_date timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_chapter_id is null then
    raise exception 'Chapter ID is required';
  end if;

  v_status := lower(trim(coalesce(p_status, '')));
  v_status := case v_status
    when 'draft' then 'Draft'
    when 'published' then 'Published'
    when 'archived' then 'Archived'
    when 'scheduled' then 'Scheduled'
    when 'pre-uploaded' then 'Pre-uploaded'
    else null
  end;

  if v_status is null then
    raise exception 'Invalid chapter status';
  end if;

  if not exists (
    select 1
    from public.pal_do_pal_ke_lamhe_chapters
    where id = p_chapter_id
  ) then
    raise exception 'Chapter not found';
  end if;

  if v_status = 'Published'
     and not exists (
       select 1
       from public.pal_do_pal_ke_lamhe_chapter_pages
       where chapter_id = p_chapter_id
     )
  then
    raise exception 'Cannot publish a chapter without manga pages';
  end if;

  select coalesce(
    p_release_date,
    case when v_status = 'Published' then release_date end,
    case when v_status = 'Published' then now() end
  )
  into v_release_date
  from public.pal_do_pal_ke_lamhe_chapters
  where id = p_chapter_id;

  update public.pal_do_pal_ke_lamhe_chapters as chapter
  set
    status = v_status,
    release_date = case
      when v_status = 'Published' then v_release_date
      when p_release_date is not null then p_release_date
      else chapter.release_date
    end
  where chapter.id = p_chapter_id;

  return query
  select chapter.id, chapter.status, chapter.release_date
  from public.pal_do_pal_ke_lamhe_chapters as chapter
  where chapter.id = p_chapter_id;
end;
$function$;

revoke all on function public.pdlpl_set_chapter_status(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pdlpl_set_chapter_status(uuid, text, timestamptz) to authenticated;