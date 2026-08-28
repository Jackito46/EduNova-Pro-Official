-- ==============================================================================
-- NETTOYAGE COMPLET ET DÉFINITIF DU SCHÉMA (Database error querying schema)
-- Ce script va détruire tout ce qui peut bloquer le cache de Supabase
-- ==============================================================================

-- 1. Supprimer TOUTES les vues (souvent la cause #1 des erreurs de schéma après un changement de type)
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') 
    LOOP 
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE'; 
    END LOOP; 
END $$;

-- 2. Supprimer TOUTES les règles de sécurité (RLS) sur profiles et schools dynamiquement
-- (Cela garantit qu'aucune ancienne règle avec un nom bizarre ne reste active)
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.profiles'; 
    END LOOP; 
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'schools' AND schemaname = 'public') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.schools'; 
    END LOOP; 
END $$;

-- 3. S'assurer que les colonnes critiques existent bien
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID;

-- 4. Recréer les fonctions d'aide de manière ultra-sécurisée (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  SELECT school_id INTO v_school_id
  FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
  
  RETURN v_school_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  SELECT is_super_admin INTO v_is_super_admin
  FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
  
  RETURN COALESCE(v_is_super_admin, FALSE);
END; 
$$;

-- 5. Recréer les règles de sécurité minimales et non-récursives
-- L'utilisateur ne peut lire et modifier que son propre profil
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (id = auth.uid());

-- L'utilisateur peut lire son école, le super admin peut tout lire
CREATE POLICY "Schools isolation" ON public.schools
FOR SELECT USING (
    public.is_super_admin() 
    OR id = public.get_my_school_id()
);

-- 6. Forcer le rechargement du cache de l'API Supabase
NOTIFY pgrst, 'reload schema';
