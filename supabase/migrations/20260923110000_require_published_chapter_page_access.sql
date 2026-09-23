-- Protect chapter page access from unpublished chapters and close an exposed trigger RPC.
-- Free/member access still follows the Chapter 1–8 rule and subscription period checks.

DROP POLICY IF EXISTS "Readers can read free or member chapters" ON public.chapter_pages;

CREATE POLICY "Readers can read free or member chapters"
ON public.chapter_pages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chapters c
    WHERE c.id = chapter_pages.chapter_id
      AND lower(coalesce(c.status, '')) = 'published'
      AND (
        c.chapter_number IS NULL
        OR c.chapter_number <= 8
        OR EXISTS (
          SELECT 1
          FROM public.user_subscriptions us
          WHERE us.user_id = (SELECT auth.uid())
            AND us.plan_id <> 'free'::text
            AND (
              (us.status = 'active'::text AND (us.current_period_end IS NULL OR us.current_period_end > now()))
              OR
              (us.status = 'cancelled'::text AND us.current_period_end IS NOT NULL AND us.current_period_end > now())
            )
        )
      )
  )
);

REVOKE EXECUTE ON FUNCTION public.enforce_announcements_limit() FROM PUBLIC, anon, authenticated;
