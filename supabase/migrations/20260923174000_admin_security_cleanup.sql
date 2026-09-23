-- Harden admin RPC permissions and optimize report review lookups.
create index if not exists comment_reports_reviewed_by_idx
  on public.comment_reports (reviewed_by);

create or replace function public.replace_chapter_pages(p_chapter_id uuid, p_pages jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  page jsonb;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_chapter_id is null then
    raise exception 'Chapter ID is required';
  end if;
  if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) = 0 then
    raise exception 'At least one chapter page is required';
  end if;
  if not exists (select 1 from public.chapters where id = p_chapter_id) then
    raise exception 'Chapter not found';
  end if;

  delete from public.chapter_pages where chapter_id = p_chapter_id;

  for page in select value from jsonb_array_elements(p_pages)
  loop
    if nullif(trim(page->>'image_url'), '') is null then
      raise exception 'Every chapter page must have an image URL';
    end if;
    insert into public.chapter_pages (chapter_id, page_number, image_url)
    values (p_chapter_id, (page->>'page_number')::bigint, page->>'image_url');
  end loop;
end;
$function$;

revoke execute on function public.get_admin_user_stats() from public, anon, authenticated;
grant execute on function public.get_admin_user_stats() to service_role;
