-- ==============================================================================
-- SCRIPT DE RÉSOLUTION FINALE
-- 1. Supprime jobpardieu@gmail.com
-- 2. Corrige les types ENUM manquants
-- 3. Rend les fonctions de sécurité 100% invulnérables aux crashs
-- 4. Répare le profil de paulnerjoseph@gmail.com
-- ==============================================================================

BEGIN;

-- 1. Supprimer jobpardieu@gmail.com (gère les fautes de frappe)
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    FOR v_user_id IN SELECT id FROM auth.users WHERE email IN ('jobpardieu@gmail.com', 'jobpardieu@gmil.com') LOOP
        DELETE FROM public.profiles WHERE id = v_user_id;
        DELETE FROM auth.users WHERE id = v_user_id;
        RAISE NOTICE 'Utilisateur jobpardieu supprimé.';
    END LOOP;
END $$;
COMMIT;

-- 2. Ajouter les valeurs manquantes à l'enum user_role (doit être hors transaction)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SCHOOL_ADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'DIRECTOR';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SECRETARY';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'TEACHER';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SUPERVISOR';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'LIBRARIAN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'STUDENT';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'PARENT';

BEGIN;

-- 3. Fonctions de sécurité ultra-sécurisées (ne plantent JAMAIS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_meta_val text;
  v_app_val text;
BEGIN
  v_meta_val := auth.jwt() -> 'user_metadata' ->> 'is_super_admin';
  v_app_val := auth.jwt() -> 'app_metadata' ->> 'is_super_admin';
  IF v_meta_val = 'true' OR v_app_val = 'true' THEN RETURN true; END IF;
  RETURN false;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_id text;
BEGIN
  v_id := auth.jwt() -> 'user_metadata' ->> 'school_id';
  IF v_id IS NULL OR v_id = '' OR length(v_id) != 36 THEN RETURN NULL; END IF;
  RETURN v_id::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

-- 4. S'assurer que les politiques sur profiles sont propres
DO $$ 
DECLARE 
    p RECORD;
BEGIN
    FOR p IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles') 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p.policyname); 
    END LOOP; 
END $$;

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR public.is_super_admin() OR school_id = public.get_my_school_id()
);
CREATE POLICY "profiles_write" ON public.profiles FOR ALL USING (
  id = auth.uid() OR public.is_super_admin()
);

-- 5. S'assurer que le profil de paulnerjoseph@gmail.com est parfaitement valide
DO $$
DECLARE
    v_paul_id UUID;
    v_school_id UUID := '81550b40-0a70-4bfb-904f-48429a27f10b'::uuid;
BEGIN
    SELECT id INTO v_paul_id FROM auth.users WHERE email = 'paulnerjoseph@gmail.com';
    
    IF v_paul_id IS NOT NULL THEN
        -- Mettre à jour le profil avec des valeurs strictes
        UPDATE public.profiles 
        SET 
            role = 'SCHOOL_ADMIN'::public.user_role,
            school_id = v_school_id,
            full_name = COALESCE(full_name, 'Paulner Joseph'),
            is_super_admin = false
        WHERE id = v_paul_id;
        
        -- Synchroniser les métadonnées
        UPDATE auth.users 
        SET raw_user_meta_data = jsonb_build_object(
            'school_id', v_school_id, 
            'is_super_admin', false,
            'role', 'SCHOOL_ADMIN',
            'full_name', COALESCE((SELECT full_name FROM public.profiles WHERE id = v_paul_id), 'Paulner Joseph')
        )
        WHERE id = v_paul_id;
        
        RAISE NOTICE 'Profil de paulnerjoseph@gmail.com mis à jour et synchronisé.';
    END IF;
END $$;

COMMIT;

-- 6. Forcer le rechargement du schéma PostgREST
NOTIFY pgrst, 'reload schema';
