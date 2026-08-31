-- Atma Rekha production audit hardening.
-- The live project was remediated with these statements on 2026-08-31.
-- This file is the reproducible schema record for the applied hardening.

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_badge text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_public_badge_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_public_badge_check CHECK (public_badge IS NULL OR public_badge IN ('supporter','premium'));

CREATE OR REPLACE FUNCTION private.sync_public_badge_for_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles p SET public_badge = (
    SELECT CASE WHEN sp.amount_inr >= 99 THEN 'premium' ELSE 'supporter' END
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = p_user_id AND us.status = 'active'
      AND (us.current_period_end IS NULL OR us.current_period_end > now())
      AND sp.active = true AND us.plan_id <> 'free'
    ORDER BY CASE WHEN sp.amount_inr >= 99 THEN 2 ELSE 1 END DESC,
             us.current_period_end DESC NULLS FIRST LIMIT 1
  ) WHERE p.id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_public_badge_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.sync_public_badge_for_user(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.sync_public_badge_subscription_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.sync_public_badge_for_user(COALESCE(NEW.user_id, OLD.user_id));
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN PERFORM private.sync_public_badge_for_user(OLD.user_id); END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.sync_public_badge_subscription_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sync_public_badge_subscription_trigger() TO service_role;
DROP TRIGGER IF EXISTS sync_public_badge_on_subscription ON public.user_subscriptions;
CREATE TRIGGER sync_public_badge_on_subscription AFTER INSERT OR UPDATE OR DELETE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION private.sync_public_badge_subscription_trigger();

CREATE OR REPLACE FUNCTION private.sync_public_badge_profile_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN PERFORM private.sync_public_badge_for_user(NEW.id); RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION private.sync_public_badge_profile_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sync_public_badge_profile_trigger() TO service_role;
DROP TRIGGER IF EXISTS sync_public_badge_on_profile_insert ON public.profiles;
CREATE TRIGGER sync_public_badge_on_profile_insert AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.sync_public_badge_profile_trigger();

UPDATE public.profiles p SET public_badge = (
  SELECT CASE WHEN sp.amount_inr >= 99 THEN 'premium' ELSE 'supporter' END
  FROM public.user_subscriptions us JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p.id AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
    AND sp.active = true AND us.plan_id <> 'free'
  ORDER BY CASE WHEN sp.amount_inr >= 99 THEN 2 ELSE 1 END DESC,
           us.current_period_end DESC NULLS FIRST LIMIT 1
);

DROP FUNCTION IF EXISTS public.get_public_reader_tiers(uuid[]);

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  rate_key text PRIMARY KEY,
  window_started timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edge_rate_limits FROM anon, authenticated;
GRANT ALL ON TABLE public.edge_rate_limits TO service_role;
DROP POLICY IF EXISTS "No client access to edge rate limits" ON public.edge_rate_limits;
CREATE POLICY "No client access to edge rate limits" ON public.edge_rate_limits FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_rate_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer; v_now timestamptz := now();
BEGIN
  IF p_rate_key IS NULL OR length(p_rate_key) < 8 OR p_limit < 1 OR p_window_seconds < 1 THEN RETURN false; END IF;
  INSERT INTO public.edge_rate_limits(rate_key,window_started,request_count,updated_at)
  VALUES(p_rate_key,v_now,1,v_now)
  ON CONFLICT(rate_key) DO UPDATE SET
    request_count=CASE WHEN v_now >= public.edge_rate_limits.window_started + make_interval(secs=>p_window_seconds) THEN 1 ELSE public.edge_rate_limits.request_count+1 END,
    window_started=CASE WHEN v_now >= public.edge_rate_limits.window_started + make_interval(secs=>p_window_seconds) THEN v_now ELSE public.edge_rate_limits.window_started END,
    updated_at=v_now
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.lock_user_subscription_creation(p_user_id uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$ SELECT pg_advisory_xact_lock(hashtextextended(p_user_id::text,0)); $$;
REVOKE ALL ON FUNCTION public.lock_user_subscription_creation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_user_subscription_creation(uuid) TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_one_pending_per_user_idx ON public.user_subscriptions(user_id) WHERE status='pending';

DROP POLICY IF EXISTS admins_delete_group_chat_likes ON public.group_chat_likes;
DROP POLICY IF EXISTS "group chat likes delete own" ON public.group_chat_likes;
CREATE POLICY "group chat likes delete authorized" ON public.group_chat_likes FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS admins_delete_group_chat_reactions ON public.group_chat_reactions;
DROP POLICY IF EXISTS group_chat_reactions_delete_own ON public.group_chat_reactions;
CREATE POLICY group_chat_reactions_delete_authorized ON public.group_chat_reactions FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "admins can read moderation status" ON public.user_moderation;
DROP POLICY IF EXISTS "users can read own moderation status" ON public.user_moderation;
CREATE POLICY "admins or owners can read moderation status" ON public.user_moderation FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS "Allow public push subscription registration" ON public.push_subscriptions;
CREATE POLICY "Allow anonymous push subscription registration" ON public.push_subscriptions FOR INSERT TO anon WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "admins can manage member content" ON public.member_content;
DROP POLICY IF EXISTS "current members read published member content" ON public.member_content;
CREATE POLICY "members or admins read member content" ON public.member_content FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR (is_published=true AND EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.user_id=(SELECT auth.uid()) AND us.plan_id<>'free' AND us.status=ANY(ARRAY['active','cancelled']) AND (us.current_period_end IS NULL OR us.current_period_end>now()))));
CREATE POLICY "admins insert member content" ON public.member_content FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "admins update member content" ON public.member_content FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "admins delete member content" ON public.member_content FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins manage member messages" ON public.member_messages;
DROP POLICY IF EXISTS "current members send private messages" ON public.member_messages;
DROP POLICY IF EXISTS "current members read own messages" ON public.member_messages;
CREATE POLICY "members or admins read private messages" ON public.member_messages FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR user_id=(SELECT auth.uid()));
CREATE POLICY "members or admins send private messages" ON public.member_messages FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) OR (user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.user_id=(SELECT auth.uid()) AND us.plan_id<>'free' AND us.status=ANY(ARRAY['active','cancelled']) AND (us.current_period_end IS NULL OR us.current_period_end>now()))));
CREATE POLICY "admins update member messages" ON public.member_messages FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "admins delete member messages" ON public.member_messages FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow authenticated subscription update" ON public.push_subscriptions;
CREATE POLICY "Users can read own push subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR (SELECT auth.uid())=user_id);
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id IS NULL OR (SELECT auth.uid())=user_id) WITH CHECK (user_id IS NULL OR (SELECT auth.uid())=user_id);
CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated USING ((SELECT auth.uid())=user_id);

REVOKE EXECUTE ON FUNCTION public.get_current_memberships(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_currently_subscribed_user_ids(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_user_directory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_user_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
