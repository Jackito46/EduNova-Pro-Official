-- Script pour forcer les permissions de mise à jour sur les écoles

BEGIN;

-- 1. S'assurer que jackito46@gmail.com est bien super admin dans la base
UPDATE public.profiles 
SET is_super_admin = true, role = 'SUPER_ADMIN'::public.user_role 
WHERE email = 'jackito46@gmail.com';

UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('is_super_admin', true, 'role', 'SUPER_ADMIN')
WHERE email = 'jackito46@gmail.com';

-- 2. Recréer les politiques sur la table schools de manière explicite
DROP POLICY IF EXISTS "schools_read" ON public.schools;
DROP POLICY IF EXISTS "schools_write" ON public.schools;
DROP POLICY IF EXISTS "schools_update" ON public.schools;
DROP POLICY IF EXISTS "schools_delete" ON public.schools;
DROP POLICY IF EXISTS "schools_insert" ON public.schools;

-- Tout le monde peut lire
CREATE POLICY "schools_read" ON public.schools FOR SELECT USING (true);

-- Seuls les super admins peuvent insérer
CREATE POLICY "schools_insert" ON public.schools FOR INSERT WITH CHECK (public.is_super_admin());

-- Seuls les super admins peuvent mettre à jour
CREATE POLICY "schools_update" ON public.schools FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Seuls les super admins peuvent supprimer
CREATE POLICY "schools_delete" ON public.schools FOR DELETE USING (public.is_super_admin());

COMMIT;

NOTIFY pgrst, 'reload schema';
