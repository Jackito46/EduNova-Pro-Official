-- ==============================================================================
-- SCRIPT DE RÉSOLUTION DÉFINITIVE : "DATABASE ERROR QUERYING SCHEMA"
-- Ce script nettoie en profondeur la base de données pour éliminer toute
-- cause possible d'erreur de schéma (vues corrompues, politiques récursives).
-- ==============================================================================

BEGIN;

-- 1. SUPPRIMER TOUTES LES VUES (Elles peuvent bloquer le cache du schéma)
DO $$ 
DECLARE v RECORD;
BEGIN
    FOR v IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') 
    LOOP 
        EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', v.table_name); 
    END LOOP; 
END $$;

-- 2. DÉSACTIVER RLS ET SUPPRIMER TOUTES LES POLITIQUES
DO $$ 
DECLARE 
    t RECORD;
    p RECORD;
BEGIN
    -- Désactiver RLS
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP 
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename); 
    END LOOP; 
    
    -- Supprimer les politiques
    FOR p IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename); 
    END LOOP; 
END $$;

-- 3. RECRÉER LES FONCTIONS DE SÉCURITÉ (SANS AUCUNE REQUÊTE SQL INTERNE)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  RETURN (COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean, false) OR
          COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_id text;
BEGIN
  v_id := auth.jwt() -> 'user_metadata' ->> 'school_id';
  IF v_id IS NULL OR v_id = '' THEN RETURN NULL; END IF;
  RETURN v_id::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

-- 4. RÉAPPLIQUER DES POLITIQUES SIMPLES ET SÉCURISÉES
-- Table profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR public.is_super_admin() OR school_id = public.get_my_school_id()
);
CREATE POLICY "profiles_write" ON public.profiles FOR ALL USING (
  id = auth.uid() OR public.is_super_admin()
);

-- Table schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schools_read" ON public.schools FOR SELECT USING (true); -- Tout le monde peut lire les écoles
CREATE POLICY "schools_write" ON public.schools FOR ALL USING (public.is_super_admin());

-- Autres tables avec school_id
DO $$ 
DECLARE t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND column_name = 'school_id' AND table_name NOT IN ('profiles', 'schools')
    LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY "access_%I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR public.is_super_admin())', t, t);
    END LOOP; 
END $$;

-- 5. SYNCHRONISER LES MÉTADONNÉES (CRITIQUE POUR LE JWT)
DO $$
DECLARE r RECORD;
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

-- 6. FORCER LE RECHARGEMENT DU SCHÉMA POSTGREST
NOTIFY pgrst, 'reload schema';
