-- Keep one canonical membership record per reader.
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_user_id_uidx
  ON public.user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS user_subscriptions_provider_status_idx
  ON public.user_subscriptions (provider, status);

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_provider_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_provider_check
  CHECK (provider IS NULL OR provider IN ('cashfree'));
