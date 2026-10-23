DROP POLICY IF EXISTS "Readers can submit own email change requests"
  ON public.email_change_requests;

CREATE POLICY "Readers can submit own email change requests"
ON public.email_change_requests
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND status = 'pending'
  AND lower(current_email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
  AND lower(current_email) <> lower(requested_email)
);
