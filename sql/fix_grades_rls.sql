-- ==========================================================
-- SCRIPT DE RÉPARATION RLS POUR LA TABLE GRADES
-- Focus : Déblocage des erreurs "new row violates row-level security policy"
-- ==========================================================

-- 1. S'assurer que la table a bien RLS d'activé
ALTER TABLE IF EXISTS public.grades ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques potentiellement bloquantes
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'grades' AND schemaname = 'public') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.grades'; 
    END LOOP; 
END $$;

-- 3. Créer une politique d'accès total pour l'école de l'utilisateur
-- Utilisation de get_my_school_id() qui est le standard dans ce projet
CREATE POLICY "Grades access for school" ON public.grades
    FOR ALL 
    USING (school_id = public.get_my_school_id() OR public.is_super_admin())
    WITH CHECK (school_id = public.get_my_school_id() OR public.is_super_admin());

-- Si les fonctions get_my_school_id() ou is_super_admin() n'existent pas ou posent problème,
-- voici une politique de secours (décommentez si la précédente échoue) :
/*
CREATE POLICY "Grades fallback access" ON public.grades
    FOR ALL 
    USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
*/

-- 4. Recharger le cache du schéma
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.grades IS 'Table des notes - RLS réparé pour autoriser les upserts';
