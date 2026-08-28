-- Add force_password_change column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;

-- RPC to reset user password by Admin (School Admin or Super Admin)
CREATE OR REPLACE FUNCTION public.admin_reset_password(p_user_id UUID, p_new_password TEXT)
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
BEGIN
  -- Get caller info
  SELECT role::text, school_id, is_super_admin 
  INTO v_caller_role, v_caller_school_id, v_is_super_admin
  FROM public.profiles
  WHERE id = auth.uid();

  -- Get target info
  SELECT school_id INTO v_target_school_id FROM public.profiles WHERE id = p_user_id;

  -- Check authorization: 
  -- 1. Super Admin (via flag or role)
  -- 2. School Admin or Director (must be in the same school)
  IF NOT (
    COALESCE(v_is_super_admin, FALSE) OR 
    v_caller_role = 'SUPER_ADMIN' OR 
    ((v_caller_role = 'SCHOOL_ADMIN' OR v_caller_role = 'DIRECTOR') AND v_caller_school_id = v_target_school_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to reset this user password.';
  END IF;

  -- Update password in auth.users
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
  
  -- Set force_password_change flag
  UPDATE public.profiles
  SET force_password_change = TRUE
  WHERE id = p_user_id;

  -- Record in audit logs
  INSERT INTO public.audit_logs (user_id, school_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), v_caller_school_id, 'RESET_PASSWORD', 'user', p_user_id, jsonb_build_object('target_user_id', p_user_id, 'forced_change', true));
END;
$$;

-- Create admin_reset_user_password (used by Super Admin in dashboard)
-- This is an alias for Super Admins
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Re-use the main logic
  PERFORM public.admin_reset_password(target_user_id, new_password);
END;
$$;

ALTER FUNCTION public.admin_reset_password(UUID, TEXT) OWNER TO postgres;
ALTER FUNCTION public.admin_reset_user_password(UUID, TEXT) OWNER TO postgres;
