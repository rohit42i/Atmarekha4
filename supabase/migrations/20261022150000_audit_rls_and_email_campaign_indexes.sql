-- Safe performance cleanup from the 2026-10-22 cross-service audit.
-- No tables or user data are deleted; existing access semantics are preserved.

-- Add covering indexes for both existing email campaign foreign keys.
CREATE INDEX IF NOT EXISTS email_campaigns_created_by_idx
  ON public.email_campaigns (created_by);
CREATE INDEX IF NOT EXISTS email_campaigns_template_id_idx
  ON public.email_campaigns (template_id);

-- Remove duplicate/overlapping SELECT policies.
-- The remaining consent and nomination policies retain the same owner-only checks.
DROP POLICY IF EXISTS "Readers can view own consent records"
  ON public.dpdp_consent_records;
DROP POLICY IF EXISTS "Readers can view own nomination"
  ON public.dpdp_nominations;

-- This remaining policy includes both a reader's own requests and admin access,
-- so the owner-only policy is redundant.
DROP POLICY IF EXISTS "Readers can view own deletion requests"
  ON public.dpdp_deletion_requests;

-- Evaluate auth.uid() once per statement rather than per row in RLS checks.
ALTER POLICY "Readers can view own notification preferences"
  ON public.notification_preferences
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Readers can insert own notification preferences"
  ON public.notification_preferences
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY "Readers can update own notification preferences"
  ON public.notification_preferences
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Admins can view email delivery events"
  ON public.email_delivery_events
  USING (
    EXISTS (
      SELECT 1
      FROM public.admins AS a
      WHERE a.user_id = (SELECT auth.uid())
        AND lower(COALESCE(a.role, '')) IN ('owner', 'admin')
    )
  );

ALTER POLICY "Admins can manage email templates"
  ON public.email_templates
  USING (
    EXISTS (
      SELECT 1
      FROM public.admins AS a
      WHERE a.user_id = (SELECT auth.uid())
        AND lower(COALESCE(a.role, '')) IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admins AS a
      WHERE a.user_id = (SELECT auth.uid())
        AND lower(COALESCE(a.role, '')) IN ('owner', 'admin')
    )
  );

ALTER POLICY "Admins can view email campaigns"
  ON public.email_campaigns
  USING (
    EXISTS (
      SELECT 1
      FROM public.admins AS a
      WHERE a.user_id = (SELECT auth.uid())
        AND lower(COALESCE(a.role, '')) IN ('owner', 'admin')
    )
  );
