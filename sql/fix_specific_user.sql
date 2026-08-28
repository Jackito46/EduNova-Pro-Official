-- SCRIPT DE RÉPARATION SPÉCIFIQUE POUR paulnerjoseph@gmail.com
-- À exécuter dans l'éditeur SQL de Supabase

BEGIN;

-- 1. S'assurer que le profil existe
INSERT INTO public.profiles (id, email, full_name, role, is_super_admin, is_active)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 'SCHOOL_ADMIN'::public.user_role, false, true
FROM auth.users
WHERE email = 'paulnerjoseph@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
  role = 'SCHOOL_ADMIN'::public.user_role,
  is_active = true;

-- 2. Lier l'utilisateur à son école (ID valide trouvé dans la table schools)
UPDATE public.profiles
SET school_id = 'a0ed9087-0554-40ae-ac26-86599a183b16' -- ID pour "Collège Pratique Moderne"
WHERE email = 'paulnerjoseph@gmail.com';

-- 3. Synchroniser les métadonnées pour que le JWT soit correct
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, school_id, is_super_admin FROM public.profiles WHERE email = 'paulnerjoseph@gmail.com' LOOP
    UPDATE auth.users
    SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object('school_id', r.school_id, 'is_super_admin', r.is_super_admin)
    WHERE id = r.id;
  END LOOP;
END;
$$;

COMMIT;
