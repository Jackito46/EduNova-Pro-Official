CREATE OR REPLACE FUNCTION public.admin_reset_password(p_user_id UUID, p_new_password TEXT, p_force_change BOOLEAN DEFAULT TRUE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_school_id UUID;
  v_target_school_id UUID;
  v_is_super_admin BOOLEAN;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Get caller info
  IF v_caller_id IS NOT NULL THEN
    SELECT role::text, school_id, is_super_admin 
    INTO v_caller_role, v_caller_school_id, v_is_super_admin
    FROM public.profiles
    WHERE id = v_caller_id;
  END IF;

  -- Get target info
  SELECT school_id INTO v_target_school_id FROM public.profiles WHERE id = p_user_id;

  -- Update password in auth.users
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
  
  -- Set force_password_change flag
  UPDATE public.profiles
  SET force_password_change = COALESCE(p_force_change, TRUE)
  WHERE id = p_user_id;

  -- Immediately invalidate existing user sessions
  PERFORM public.invalidate_user_sessions(p_user_id);

  -- Record in audit logs with PASSWORD_RESET action
  INSERT INTO public.audit_logs (user_id, school_id, action, entity_type, entity_id, details)
  VALUES (
    v_caller_id, 
    v_caller_school_id, 
    'PASSWORD_RESET', 
    'user', 
    p_user_id, 
    jsonb_build_object(
      'target_user_id', p_user_id, 
      'forced_change', COALESCE(p_force_change, TRUE),
      'invalidated_sessions', true
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_password TEXT, force_change BOOLEAN DEFAULT TRUE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  PERFORM public.admin_reset_password(target_user_id, new_password, COALESCE(force_change, TRUE));
END;
$$;

