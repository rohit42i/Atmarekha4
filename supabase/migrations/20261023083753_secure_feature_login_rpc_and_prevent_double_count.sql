CREATE OR REPLACE FUNCTION public.record_feature_login()
RETURNS public.feature_unlock_config
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_config public.feature_unlock_config;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.feature_login_users (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_config
  FROM public.feature_unlock_config
  WHERE id = true;

  RETURN v_config;
END;
$function$;

GRANT INSERT ON TABLE public.feature_login_users TO authenticated;
REVOKE ALL ON FUNCTION public.record_feature_login() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_feature_login() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_feature_login() TO service_role;
