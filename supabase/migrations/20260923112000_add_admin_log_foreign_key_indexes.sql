-- Add covering indexes for the existing admin log foreign keys.
create index if not exists admin_activity_log_admin_user_id_idx
  on public.admin_activity_log (admin_user_id);

create index if not exists admin_notification_log_admin_user_id_idx
  on public.admin_notification_log (admin_user_id);
