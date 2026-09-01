-- Repository mirror of the production public_badge hardening applied on 2026-09-01.
-- This migration is intentionally idempotent so a fresh environment can reproduce
-- the live protection without changing unrelated profile fields.

CREATE OR REPLACE FUNCTION public.lock_profile_public_badge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF current_setting('app.allow_public_badge_write', true) = 'on' THEN
      RETURN NEW;
    END IF;
    NEW.public_badge := OLD.public_badge;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.lock_profile_public_badge_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.allow_public_badge_write', true) = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.public_badge := NULL;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.sync_public_badge_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM set_config('app.allow_public_badge_write', 'on', true);
  UPDATE public.profiles p SET public_badge = (
    SELECT CASE WHEN sp.amount_inr >= 99 THEN 'premium' ELSE 'supporter' END
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
      AND (us.current_period_end IS NULL OR us.current_period_end > now())
      AND sp.active = true
      AND us.plan_id <> 'free'
    ORDER BY CASE WHEN sp.amount_inr >= 99 THEN 2 ELSE 1 END DESC,
             us.current_period_end DESC NULLS FIRST
    LIMIT 1
  )
  WHERE p.id = p_user_id;
END;
$function$;

DROP TRIGGER IF EXISTS profile_public_badge_lock ON public.profiles;
CREATE TRIGGER profile_public_badge_lock
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.lock_profile_public_badge();

DROP TRIGGER IF EXISTS profile_public_badge_lock_insert ON public.profiles;
CREATE TRIGGER profile_public_badge_lock_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.lock_profile_public_badge_on_insert();

REVOKE ALL ON FUNCTION private.sync_public_badge_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_public_badge_for_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION private.sync_public_badge_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.sync_public_badge_for_user(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION private.sync_public_badge_for_user(uuid) TO service_role;
