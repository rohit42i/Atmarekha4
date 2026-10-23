CREATE INDEX IF NOT EXISTS email_change_request_events_actor_user_id_idx
  ON public.email_change_request_events (actor_user_id);

CREATE INDEX IF NOT EXISTS email_change_request_events_user_id_idx
  ON public.email_change_request_events (user_id);

CREATE INDEX IF NOT EXISTS email_change_requests_last_admin_resend_by_idx
  ON public.email_change_requests (last_admin_resend_by);
