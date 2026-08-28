
-- 1. Ensure jackito46@gmail.com is a Super Admin in both profiles and auth.users metadata
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get user ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'jackito46@gmail.com';
    
    IF v_user_id IS NOT NULL THEN
        -- Update auth.users metadata
        UPDATE auth.users 
        SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('is_super_admin', true, 'role', 'SUPER_ADMIN')
        WHERE id = v_user_id;
        
        -- Update public.profiles
        UPDATE public.profiles
        SET is_super_admin = TRUE,
            role = 'SUPER_ADMIN'
        WHERE id = v_user_id;
        
        RAISE NOTICE 'User jackito46@gmail.com updated to Super Admin successfully.';
    ELSE
        RAISE NOTICE 'User jackito46@gmail.com not found.';
    END IF;
END $$;

-- 2. Fix admin_reset_password logic to be more inclusive
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
    RAISE EXCEPTION 'Unauthorized: You do not have permission to reset this user password. (Role: %, Super: %, SameSchool: %)', 
      v_caller_role, v_is_super_admin, (v_caller_school_id = v_target_school_id);
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

-- 3. Ensure admin_reset_user_password (alias) is also updated if needed (it just calls the above)
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  PERFORM public.admin_reset_password(target_user_id, new_password);
END;
$$;
