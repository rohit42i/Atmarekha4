-- Keep PDPKL comments live for all readers with the comments sheet open.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pdlpl_comments'
  ) then
    alter publication supabase_realtime add table public.pdlpl_comments;
  end if;
end
$$;
