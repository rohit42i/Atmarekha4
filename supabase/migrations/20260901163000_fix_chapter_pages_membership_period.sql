-- Keep chapter access consistent with active membership state.
-- Active subscriptions remain readable when Razorpay has not populated current_period_end yet.
-- Cancelled subscriptions retain access only through their recorded period end.

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
        c.chapter_number <= 5
        OR EXISTS (
          SELECT 1
          FROM public.user_subscriptions us
          WHERE us.user_id = (SELECT auth.uid())
            AND us.plan_id <> 'free'::text
            AND (
              (
                us.status = 'active'::text
                AND (us.current_period_end IS NULL OR us.current_period_end > now())
              )
              OR (
                us.status = 'cancelled'::text
                AND us.current_period_end IS NOT NULL
                AND us.current_period_end > now()
              )
            )
        )
      )
  )
);

-- Repair active membership rows that were created without a period end.
-- Use the subscription start when available; otherwise fall back to creation time.
UPDATE public.user_subscriptions
SET current_period_end = COALESCE(current_period_start, created_at) + interval '30 days',
    updated_at = now()
WHERE status = 'active'
  AND current_period_end IS NULL
  AND COALESCE(current_period_start, created_at) IS NOT NULL;
