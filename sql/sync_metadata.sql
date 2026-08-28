-- SCRIPT DE SYNCHRONISATION FINALE
-- Ce script s'assure que les métadonnées de auth.users correspondent EXACTEMENT à public.profiles

BEGIN;

-- Synchroniser les métadonnées vers auth.users pour TOUS les utilisateurs
DO $$
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT id, school_id, is_super_admin, role, full_name FROM public.profiles LOOP
    UPDATE auth.users 
    SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'school_id', r.school_id, 
        'is_super_admin', r.is_super_admin,
        'role', r.role,
        'full_name', r.full_name
      )
    WHERE id = r.id;
  END LOOP;
END;
$$;

COMMIT;
