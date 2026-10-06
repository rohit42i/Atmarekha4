create or replace function public.pdlpl_upsert_chapter(
  p_chapter_id uuid,
  p_chapter_number bigint,
  p_language text,
  p_title text,
  p_description text default '',
  p_status text default 'Draft',
  p_release_date timestamptz default null
)
returns table(
  id uuid,
  chapter_number bigint,
  language text,
  title text,
  description text,
  status text,
  release_date timestamptz,
  cover_path text
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  normalized_language text := lower(trim(coalesce(p_language, 'hi')));
  normalized_status text := initcap(lower(trim(coalesce(p_status, 'Draft'))));
  chapter_id_value uuid := p_chapter_id;
begin
  if not private.is_admin() then
    raise exception 'Admin access required.';
  end if;

  if chapter_id_value is null then
    chapter_id_value := gen_random_uuid();
  end if;

  if normalized_language not in ('hi', 'en') then
    raise exception 'Unsupported PDPKL language.';
  end if;

  if p_chapter_number is not null and p_chapter_number < 1 then
    raise exception 'Chapter number must be at least 1.';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Chapter title is required.';
  end if;

  if normalized_status not in ('Draft', 'Published', 'Archived', 'Scheduled', 'Pre-uploaded') then
    raise exception 'Invalid PDPKL chapter status.';
  end if;

  if normalized_status = 'Scheduled' and p_release_date is null then
    raise exception 'Scheduled chapters need a release date.';
  end if;

  if exists (
    select 1
    from public.pal_do_pal_ke_lamhe_chapters as existing_chapter
    where existing_chapter.id = chapter_id_value
  ) then
    update public.pal_do_pal_ke_lamhe_chapters as c
    set
      chapter_number = p_chapter_number,
      language = normalized_language,
      title = trim(p_title),
      description = coalesce(p_description, ''),
      status = normalized_status,
      release_date = p_release_date,
      updated_at = now()
    where c.id = chapter_id_value;
  else
    insert into public.pal_do_pal_ke_lamhe_chapters (
      id, chapter_number, language, title, description, status, release_date
    )
    values (
      chapter_id_value,
      p_chapter_number,
      normalized_language,
      trim(p_title),
      coalesce(p_description, ''),
      normalized_status,
      p_release_date
    );
  end if;

  return query
  select
    c.id,
    c.chapter_number,
    c.language,
    c.title,
    c.description,
    c.status,
    c.release_date,
    c.cover_path
  from public.pal_do_pal_ke_lamhe_chapters as c
  where c.id = chapter_id_value;
end;
$function$;

revoke all on function public.pdlpl_upsert_chapter(uuid, bigint, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pdlpl_upsert_chapter(uuid, bigint, text, text, text, text, timestamptz) to authenticated;
