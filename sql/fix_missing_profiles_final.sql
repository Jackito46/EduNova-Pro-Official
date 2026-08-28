-- ==============================================================================
-- SCRIPT DE RÉPARATION DES PROFILS UTILISATEURS
-- À EXÉCUTER DANS LE SQL EDITOR DE SUPABASE
-- ==============================================================================

-- 1. Remplacement du trigger handle_new_user pour ne plus masquer les erreurs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE
  v_school_id UUID;
  v_is_super_admin BOOLEAN := FALSE;
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

  -- Insertion ou mise à jour du profil
  INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, force_password_change)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(new.id::text, 1, 5)), 
    COALESCE(new.raw_user_meta_data->>'role', 'SCHOOL_ADMIN'),
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
  -- NOTE: Nous avons retiré la clause EXCEPTION WHEN OTHERS THEN RETURN new;
  -- pour que les erreurs (comme la limite de 2 admins) soient visibles et ne
  -- créent pas d'utilisateurs fantômes.
END;
$$;

-- 2. Création d'une fonction pour synchroniser les profils manquants
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
BEGIN
  -- Parcourir tous les utilisateurs dans auth.users qui n'ont pas de profil
  FOR v_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
  LOOP
    -- Déterminer school_id
    IF v_user.raw_user_meta_data->>'school_id' IS NOT NULL THEN
      v_school_id := (v_user.raw_user_meta_data->>'school_id')::uuid;
    ELSE
      SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- Déterminer is_super_admin
    v_is_super_admin := COALESCE((v_user.raw_user_meta_data->>'is_super_admin') = 'true', FALSE);

    -- Insérer le profil manquant
    BEGIN
      INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, force_password_change)
      VALUES (
        v_user.id, 
        v_user.email, 
        COALESCE(v_user.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(v_user.id::text, 1, 5)), 
        COALESCE(v_user.raw_user_meta_data->>'role', 'TEACHER'), -- Défaut plus sûr que SCHOOL_ADMIN
        v_school_id,
        v_is_super_admin,
        TRUE
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorer les erreurs individuelles (ex: limite d'admins) pour continuer la boucle
      RAISE NOTICE 'Erreur lors de la création du profil pour %: %', v_user.email, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'profiles_created', v_count);
END;
$$;

-- 3. Exécution immédiate de la synchronisation
SELECT public.sync_missing_profiles();
