-- Auditable account email changes with confirmation at both the current and requested addresses.
BEGIN;

CREATE TABLE IF NOT EXISTS public.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  current_email text NOT NULL CHECK (current_email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'),
  requested_email text NOT NULL CHECK (requested_email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'superseded', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  closed_at timestamptz,
  last_admin_resend_at timestamptz,
  last_admin_resend_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resend_count integer NOT NULL DEFAULT 0 CHECK (resend_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_change_requests_different_emails CHECK (lower(current_email) <> lower(requested_email))
);

CREATE INDEX IF NOT EXISTS email_change_requests_requested_at_idx
  ON public.email_change_requests (requested_at DESC);
CREATE INDEX IF NOT EXISTS email_change_requests_user_status_idx
  ON public.email_change_requests (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS email_change_requests_one_pending_per_user_idx
  ON public.email_change_requests (user_id)
  WHERE status = 'pending' AND user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_change_request_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.email_change_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('requested', 'verification_resent', 'verified', 'superseded', 'cancelled')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_change_request_events_request_created_idx
  ON public.email_change_request_events (request_id, created_at DESC);

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_change_request_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_change_requests FROM anon, authenticated;
GRANT SELECT ON public.email_change_requests TO authenticated;
GRANT INSERT (user_id, current_email, requested_email) ON public.email_change_requests TO authenticated;
GRANT ALL ON public.email_change_requests TO service_role;

DROP POLICY IF EXISTS "Readers can view own email change requests" ON public.email_change_requests;
CREATE POLICY "Readers can view own email change requests"
  ON public.email_change_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Readers can submit own email change requests" ON public.email_change_requests;
CREATE POLICY "Readers can submit own email change requests"
  ON public.email_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND lower(current_email) = lower(COALESCE((SELECT auth.jwt()->>'email'), ''))
    AND lower(current_email) <> lower(requested_email)
  );

REVOKE ALL ON public.email_change_request_events FROM anon, authenticated;
GRANT SELECT ON public.email_change_request_events TO authenticated;
GRANT ALL ON public.email_change_request_events TO service_role;

DROP POLICY IF EXISTS "Admins can view email change request history" ON public.email_change_request_events;
CREATE POLICY "Admins can view email change request history"
  ON public.email_change_request_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = (SELECT auth.uid())
        AND lower(COALESCE(a.role, '')) IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION public.supersede_previous_email_change_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
  prior_request record;
  action_time timestamptz := pg_catalog.now();
BEGIN
  FOR prior_request IN
    UPDATE public.email_change_requests
    SET status = 'superseded', closed_at = action_time
    WHERE user_id = NEW.user_id AND status = 'pending'
    RETURNING id
  LOOP
    INSERT INTO public.email_change_request_events
      (request_id, user_id, actor_user_id, event_type, details)
    VALUES (
      prior_request.id,
      NEW.user_id,
      NEW.user_id,
      'superseded',
      pg_catalog.jsonb_build_object('reason', 'new_email_change_request')
    );
  END LOOP;
  RETURN NEW;
END;
$;

REVOKE ALL ON FUNCTION public.supersede_previous_email_change_requests() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS email_change_request_supersede_previous ON public.email_change_requests;
CREATE TRIGGER email_change_request_supersede_previous
  BEFORE INSERT ON public.email_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.supersede_previous_email_change_requests();

CREATE OR REPLACE FUNCTION public.log_email_change_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.email_change_request_events
    (request_id, user_id, actor_user_id, event_type, details)
  VALUES (
    NEW.id,
    NEW.user_id,
    NEW.user_id,
    'requested',
    pg_catalog.jsonb_build_object(
      'current_email', NEW.current_email,
      'requested_email', NEW.requested_email
    )
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_email_change_request_created() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS email_change_request_created_log ON public.email_change_requests;
CREATE TRIGGER email_change_request_created_log
  AFTER INSERT ON public.email_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_email_change_request_created();

COMMIT;
