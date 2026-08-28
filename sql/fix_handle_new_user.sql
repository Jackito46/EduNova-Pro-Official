-- Fix handle_new_user to correctly propogate school_id and other metadata to profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insertion du profil avec des valeurs par défaut sécurisées
  -- On récupère school_id depuis raw_user_meta_data SI présent
  INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, is_active)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'STUDENT')::public.user_role,
    (new.raw_user_meta_data->>'school_id')::uuid,
    COALESCE((new.raw_user_meta_data->>'is_super_admin')::boolean, false),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    school_id = COALESCE(public.profiles.school_id, EXCLUDED.school_id),
    role = CASE WHEN EXCLUDED.role != 'STUDENT' THEN EXCLUDED.role ELSE public.profiles.role END,
    last_activity_at = now();

  -- Sync metadata back to auth.users (ensure school_id and is_super_admin are present for JWT)
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'school_id', COALESCE(new.raw_user_meta_data->>'school_id', public.profiles.school_id::text),
      'is_super_admin', COALESCE((new.raw_user_meta_data->>'is_super_admin')::boolean, public.profiles.is_super_admin)
    )
  WHERE id = new.id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
