
-- Script pour synchroniser les métadonnées auth.users avec les profils publics
-- Indispensable pour que get_my_school_id() fonctionne via le JWT

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT p.id, p.school_id, p.full_name, p.role, p.is_super_admin 
            FROM public.profiles p) 
  LOOP
    UPDATE auth.users 
    SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'school_id', r.school_id,
        'full_name', r.full_name,
        'role', r.role,
        'is_super_admin', r.is_super_admin
      )
    WHERE id = r.id;
  END LOOP;
  
  RAISE NOTICE 'Métadonnées synchronisées pour tous les utilisateurs.';
END $$;

-- Forcer le rechargement du cache
NOTIFY pgrst, 'reload schema';
