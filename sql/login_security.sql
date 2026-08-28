-- Script to add failed login tracking and account locking

-- 1. Ensure `profiles` has the necessary columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Create the RPC function to handle failed logins
CREATE OR REPLACE FUNCTION public.handle_failed_login(p_email TEXT, p_max_attempts INT DEFAULT 3)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_attempts int;
  v_is_active boolean;
BEGIN
  -- Trouver l'utilisateur par email
  SELECT id, failed_login_attempts, is_active
  INTO v_user_id, v_attempts, v_is_active
  FROM public.profiles
  WHERE email = p_email
  LIMIT 1;

  -- Si l'utilisateur n'existe pas, on retourne null pour ne pas révéler d'infos
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Si le compte est déjà désactivé
  IF v_is_active = false THEN
    RETURN json_build_object('status', 'already_inactive', 'attempts', v_attempts);
  END IF;

  -- Incrémenter les tentatives
  v_attempts := COALESCE(v_attempts, 0) + 1;

  -- Vérifier si le compte doit être désactivé
  IF v_attempts >= p_max_attempts THEN
    UPDATE public.profiles
    SET failed_login_attempts = v_attempts,
        is_active = false
    WHERE id = v_user_id;
    
    RETURN json_build_object('status', 'deactivated', 'attempts', v_attempts);
  ELSE
    UPDATE public.profiles
    SET failed_login_attempts = v_attempts
    WHERE id = v_user_id;
    
    RETURN json_build_object('status', 'incremented', 'attempts', v_attempts);
  END IF;
END;
$$;

-- 3. Create the RPC function to reset failed login attempts (on successful login)
CREATE OR REPLACE FUNCTION public.reset_failed_login(p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET failed_login_attempts = 0
  WHERE email = p_email AND failed_login_attempts > 0;
END;
$$;

-- Grant execute permissions to anon and authenticated
GRANT EXECUTE ON FUNCTION public.handle_failed_login(TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_failed_login(TEXT) TO anon, authenticated, service_role;
