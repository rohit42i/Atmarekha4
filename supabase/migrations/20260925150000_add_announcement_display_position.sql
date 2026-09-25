alter table public.announcements
  add column if not exists display_position smallint;

alter table public.announcements
  drop constraint if exists announcements_display_position_check;

alter table public.announcements
  add constraint announcements_display_position_check
  check (display_position is null or (display_position >= 1 and display_position <= 10));

create index if not exists announcements_pinned_position_idx
  on public.announcements (is_pinned desc, display_position, published_at desc, created_at desc);
