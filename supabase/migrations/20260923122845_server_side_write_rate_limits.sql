-- Server-enforced write limits for public/community actions.
create or replace function private.enforce_rate_limit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  rate_key text;
  rate_limit integer;
  rate_window integer;
  allowed boolean;
begin
  begin
    if (select private.is_admin()) then
      return new;
    end if;
  exception when others then
    null;
  end;

  if tg_table_name = 'comments' then
    rate_key := 'comment:' || coalesce(auth.uid()::text, new.user_id::text, '');
    rate_limit := 6;
    rate_window := 60;
  elsif tg_table_name = 'group_chat_messages' then
    rate_key := 'group-message:' || coalesce(auth.uid()::text, new.user_id::text, '');
    rate_limit := 12;
    rate_window := 60;
  elsif tg_table_name = 'comment_reports' then
    rate_key := 'comment-report:' || coalesce(new.viewer_key::text, '');
    rate_limit := 10;
    rate_window := 600;
  elsif tg_table_name = 'chapter_views' then
    rate_key := 'chapter-view:' || coalesce(new.viewer_key::text, '');
    rate_limit := 60;
    rate_window := 60;
  elsif tg_table_name = 'chapter_likes' then
    rate_key := 'chapter-like:' || coalesce(new.viewer_key::text, '');
    rate_limit := 30;
    rate_window := 60;
  elsif tg_table_name = 'comment_likes' then
    rate_key := 'comment-like:' || coalesce(new.viewer_key::text, '');
    rate_limit := 60;
    rate_window := 60;
  elsif tg_table_name = 'chapter_ratings' then
    rate_key := 'chapter-rating:' || coalesce(auth.uid()::text, new.user_id::text, '');
    rate_limit := 10;
    rate_window := 60;
  elsif tg_table_name = 'community_post_reactions' then
    rate_key := 'community-reaction:' || coalesce(auth.uid()::text, new.user_id::text, '');
    rate_limit := 60;
    rate_window := 60;
  else
    return new;
  end if;

  if length(rate_key) < 8 then
    raise exception 'Rate limit identity unavailable.';
  end if;

  select public.consume_rate_limit(rate_key, rate_limit, rate_window) into allowed;
  if not allowed then
    raise exception 'Too many requests. Please wait and try again.';
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_rate_limit_trigger() from public, anon, authenticated;

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
before insert on public.comments
for each row execute function private.enforce_rate_limit_trigger();

drop trigger if exists group_chat_messages_rate_limit on public.group_chat_messages;
create trigger group_chat_messages_rate_limit
before insert on public.group_chat_messages
for each row execute function private.enforce_rate_limit_trigger();

drop trigger if exists comment_reports_rate_limit on public.comment_reports;
create trigger comment_reports_rate_limit
before insert on public.comment_reports
for each row execute function private.enforce_rate_limit_trigger();

drop trigger if exists chapter_views_rate_limit on public.chapter_views;
create trigger chapter_views_rate_limit
before insert on public.chapter_views
for each row execute function private.enforce_rate_limit_trigger();

drop trigger if exists chapter_likes_rate_limit on public.chapter_likes;
create trigger chapter_likes_rate_limit
before insert on public.chapter_likes
for each row execute function private.enforce_rate_limit_trigger();

drop trigger if exists comment_likes_rate_limit on public.comment_likes;
create trigger comment_likes_rate_limit
before insert on public.comment_likes
for each row execute function private.enforce_rate_limit_trigger();

drop trigger if exists chapter_ratings_rate_limit on public.chapter_ratings;
create trigger chapter_ratings_rate_limit
before insert or update on public.chapter_ratings
for each row execute function private.enforce_rate_limit_trigger();

drop trigger if exists community_post_reactions_rate_limit on public.community_post_reactions;
create trigger community_post_reactions_rate_limit
before insert on public.community_post_reactions
for each row execute function private.enforce_rate_limit_trigger();
