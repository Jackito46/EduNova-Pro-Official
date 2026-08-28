-- Script pour s'assurer que tous les super admins ont les bonnes métadonnées

BEGIN;

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Synchroniser les métadonnées pour tous les super admins
  FOR r IN SELECT id, is_super_admin, role FROM public.profiles WHERE is_super_admin = true OR role = 'SUPER_ADMIN' LOOP
    UPDATE auth.users 
    SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'is_super_admin', true,
        'role', 'SUPER_ADMIN'
      )
    WHERE id = r.id;
    RAISE NOTICE 'Métadonnées synchronisées pour le super admin %', r.id;
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
