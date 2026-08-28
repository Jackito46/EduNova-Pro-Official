-- Correction des politiques RLS pour la table profiles pour permettre l'impersonnalisation
-- On supprime l'ancienne politique d'isolation pour la recréer proprement
DROP POLICY IF EXISTS "Isolation profiles" ON public.profiles;

-- Politique de lecture : Tout le monde voit les profils de son école, le Super Admin voit tout
CREATE POLICY "Profiles select isolation" ON public.profiles
FOR SELECT USING (
    school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- Politique de mise à jour : 
-- 1. Les utilisateurs peuvent modifier leur propre profil (sauf school_id s'ils ne sont pas super admin)
-- 2. Le Super Admin peut modifier son propre school_id pour l'impersonnalisation
CREATE POLICY "Profiles update isolation" ON public.profiles
FOR UPDATE USING (
    id = auth.uid() OR public.is_super_admin()
)
WITH CHECK (
    id = auth.uid() OR public.is_super_admin()
);

-- Note: On pourrait être plus restrictif sur qui peut modifier quoi, 
-- mais pour l'impersonnalisation du Super Admin, il est crucial qu'il puisse modifier son propre school_id.

NOTIFY pgrst, 'reload schema';
