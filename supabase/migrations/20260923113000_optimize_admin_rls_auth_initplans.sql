-- Avoid per-row auth.uid() evaluation in the existing admin-only RLS policies.
-- Access rules remain unchanged: only authenticated admins can use these policies.

DROP POLICY IF EXISTS admin_activity_admin_only ON public.admin_activity_log;
CREATE POLICY admin_activity_admin_only
ON public.admin_activity_log
AS PERMISSIVE
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS admin_notification_admin_only ON public.admin_notification_log;
CREATE POLICY admin_notification_admin_only
ON public.admin_notification_log
AS PERMISSIVE
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS manga_series_admin_manage ON public.manga_series;
CREATE POLICY manga_series_admin_manage
ON public.manga_series
AS PERMISSIVE
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = (SELECT auth.uid())));
