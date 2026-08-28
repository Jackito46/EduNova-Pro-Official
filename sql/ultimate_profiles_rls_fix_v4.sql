-- ==============================================================================
-- SCRIPT DE RÉPARATION DÉFINITIVE DES PROFILS ET RLS (V3)
-- À EXÉCUTER DANS LE SQL EDITOR DE SUPABASE
-- ==============================================================================

BEGIN;

-- 1. S'assurer que les rôles existent dans l'enum
DO $$
DECLARE
    role_name text;
    roles text[] := ARRAY['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'SECRETARY', 'ACCOUNTANT', 'TEACHER', 'SUPERVISOR', 'LIBRARIAN', 'STUDENT', 'PARENT'];
BEGIN
    FOREACH role_name IN ARRAY roles
    LOOP
        BEGIN
            EXECUTE format('ALTER TYPE user_role ADD VALUE IF NOT EXISTS %L', role_name);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN RAISE NOTICE 'Type user_role might not exist';
        END;
    END LOOP;
END $$;

-- 2. Supprimer TOUTES les politiques existantes sur profiles
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles super admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles school admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;

-- 3. Créer une fonction SECURITY DEFINER robuste pour obtenir le school_id
CREATE OR REPLACE FUNCTION public.get_user_school_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = p_user_id LIMIT 1;
$$;

ALTER FUNCTION public.get_user_school_id(UUID) OWNER TO postgres;

-- 4. Recréer les politiques de base (SIMPLES ET ROBUSTES)
-- 4.1 L'utilisateur peut TOUJOURS lire son propre profil
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- 4.2 L'utilisateur peut TOUJOURS mettre à jour son propre profil
CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- 4.3 Les super admins peuvent tout lire
CREATE POLICY "Profiles read superadmin" ON public.profiles
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'is_super_admin' = 'true'
    )
);

-- 4.4 Les utilisateurs peuvent lire les profils de leur école
CREATE POLICY "Profiles read school" ON public.profiles
FOR SELECT USING (
    school_id = public.get_user_school_id(auth.uid())
    AND school_id IS NOT NULL
);

-- 4.5 Les admins peuvent mettre à jour les profils de leur école
CREATE POLICY "Profiles update school admin" ON public.profiles
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND (role = 'SCHOOL_ADMIN' OR role = 'SUPER_ADMIN' OR role = 'DIRECTOR')
        AND (school_id = public.profiles.school_id OR role = 'SUPER_ADMIN')
    )
);

-- 5. S'assurer que le trigger de création de profil fonctionne pour tous les rôles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE
  v_school_id UUID;
  v_is_super_admin BOOLEAN := FALSE;
  v_role TEXT;
BEGIN
  -- Récupération de l'ID de l'école
  IF new.raw_user_meta_data->>'school_id' IS NOT NULL THEN
    v_school_id := (new.raw_user_meta_data->>'school_id')::uuid;
  ELSE
    SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- Vérification du flag super admin
  IF new.raw_user_meta_data->>'is_super_admin' = 'true' THEN
    v_is_super_admin := TRUE;
  END IF;

  -- Récupération du rôle (avec fallback)
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'TEACHER');

  -- Insertion ou mise à jour du profil
  INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, force_password_change)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(new.id::text, 1, 5)), 
    v_role::user_role,
    v_school_id,
    v_is_super_admin,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    school_id = EXCLUDED.school_id,
    is_super_admin = EXCLUDED.is_super_admin,
    force_password_change = TRUE;
  
  RETURN new;
END;
$$;

-- 6. Synchroniser les profils manquants au cas où
CREATE OR REPLACE FUNCTION public.sync_missing_profiles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user RECORD;
  v_count INTEGER := 0;
  v_school_id UUID;
  v_is_super_admin BOOLEAN;
  v_role TEXT;
BEGIN
  FOR v_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
  LOOP
    IF v_user.raw_user_meta_data->>'school_id' IS NOT NULL THEN
      v_school_id := (v_user.raw_user_meta_data->>'school_id')::uuid;
    ELSE
      SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
    END IF;

    v_is_super_admin := COALESCE((v_user.raw_user_meta_data->>'is_super_admin') = 'true', FALSE);
    v_role := COALESCE(v_user.raw_user_meta_data->>'role', 'TEACHER');

    BEGIN
      INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, force_password_change)
      VALUES (
        v_user.id, 
        v_user.email, 
        COALESCE(v_user.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(v_user.id::text, 1, 5)), 
        v_role::user_role,
        v_school_id,
        v_is_super_admin,
        TRUE
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erreur lors de la création du profil pour %: %', v_user.email, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'profiles_created', v_count);
END;
$$;

SELECT public.sync_missing_profiles();

COMMIT;
