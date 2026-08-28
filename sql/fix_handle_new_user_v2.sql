-- Fix handle_new_user syntax error and improve robustness
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_school_id_text text;
  v_is_super_admin boolean;
BEGIN
  -- 1. Extract values from new metadata
  v_school_id_text := new.raw_user_meta_data->>'school_id';
  v_is_super_admin := COALESCE((new.raw_user_meta_data->>'is_super_admin')::boolean, false);

  -- 2. Insertion du profil
  INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, is_active)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'STUDENT')::public.user_role,
    v_school_id_text::uuid,
    v_is_super_admin,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    school_id = COALESCE(public.profiles.school_id, EXCLUDED.school_id),
    role = CASE WHEN EXCLUDED.role != 'STUDENT' THEN EXCLUDED.role ELSE public.profiles.role END,
    last_activity_at = now();

  -- 3. Sync metadata back to auth.users (ensure school_id and is_super_admin are present for JWT)
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'school_id', v_school_id_text,
      'is_super_admin', v_is_super_admin
    )
  WHERE id = new.id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
