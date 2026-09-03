-- Blank chapter numbers are intentionally stored as NULL for intro/side-story/info content.
-- Such published chapters must remain readable without membership.

DROP POLICY IF EXISTS "Readers can read free or member chapters" ON public.chapter_pages;

CREATE POLICY "Readers can read free or member chapters"
ON public.chapter_pages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chapters c
    WHERE c.id = chapter_pages.chapter_id
      AND (
        c.chapter_number IS NULL
        OR c.chapter_number <= 5
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
