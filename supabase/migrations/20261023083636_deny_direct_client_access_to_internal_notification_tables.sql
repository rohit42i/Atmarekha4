DROP POLICY IF EXISTS "Deny direct client access" ON public.email_marketing_preferences;
CREATE POLICY "Deny direct client access"
ON public.email_marketing_preferences
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client access" ON public.notification_event_dispatches;
CREATE POLICY "Deny direct client access"
ON public.notification_event_dispatches
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
