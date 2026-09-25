alter table public.announcements
  add column if not exists pin_target text;

alter table public.announcements
  drop constraint if exists announcements_pin_target_check;

alter table public.announcements
  add constraint announcements_pin_target_check
  check (pin_target is null or pin_target in ('atma','pdpkl'));

update public.announcements
set pin_target = case when is_pinned then 'atma' else null end
where pin_target is null;