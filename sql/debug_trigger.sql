CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE
  v_school_id UUID;
  v_is_super_admin BOOLEAN := FALSE;
BEGIN
  IF new.raw_user_meta_data->>'school_id' IS NOT NULL THEN
    v_school_id := (new.raw_user_meta_data->>'school_id')::uuid;
  ELSE
    SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF new.raw_user_meta_data->>'is_super_admin' = 'true' THEN
    v_is_super_admin := TRUE;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(new.id::text, 1, 5)), 
    COALESCE(new.raw_user_meta_data->>'role', 'SCHOOL_ADMIN'),
    v_school_id,
    v_is_super_admin
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    school_id = EXCLUDED.school_id,
    is_super_admin = EXCLUDED.is_super_admin;
  
  RETURN new;
END;
$$;
