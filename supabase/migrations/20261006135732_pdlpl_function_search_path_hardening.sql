create or replace function public.set_pdlpl_comment_updated_at()
returns trigger
language plpgsql
set search_path=public,pg_catalog
as $function$
begin
  new.updated_at=now();
  return new;
end;
$function$;

create or replace function public.set_pdlpl_reading_history_updated_at()
returns trigger
language plpgsql
set search_path=public,pg_catalog
as $function$
begin
  new.updated_at=now();
  return new;
end;
$function$;