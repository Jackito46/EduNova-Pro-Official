-- Script pour supprimer l'utilisateur jobpardieu@gmail.com et corriger les erreurs de schéma

BEGIN;

-- 1. Supprimer jobpardieu@gmail.com
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Trouver l'ID de l'utilisateur (gère la faute de frappe gmil.com et gmail.com)
    FOR v_user_id IN SELECT id FROM auth.users WHERE email IN ('jobpardieu@gmail.com', 'jobpardieu@gmil.com') LOOP
        -- Supprimer le profil (si existant)
        DELETE FROM public.profiles WHERE id = v_user_id;
        -- Supprimer l'utilisateur de l'authentification
        DELETE FROM auth.users WHERE id = v_user_id;
        RAISE NOTICE 'Utilisateur supprimé avec succès.';
    END LOOP;
END $$;

-- 2. Vérifier et mettre à jour l'enum user_role
-- L'erreur "Database error querying schema" est souvent causée par une valeur dans la table 
-- qui n'existe pas dans le type ENUM (par exemple, si on a forcé une valeur via un cast).
DO $$
BEGIN
    -- Ajouter les valeurs manquantes à l'enum (PostgreSQL 12+ permet d'ajouter des valeurs avec IF NOT EXISTS)
    -- On utilise un bloc d'exception car ALTER TYPE ne peut pas être exécuté dans un bloc PL/pgSQL standard
    -- Donc on le fait en dehors.
END $$;
COMMIT;

-- Exécuter les ALTER TYPE en dehors de la transaction
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
-- 3. S'assurer que le profil de paulnerjoseph@gmail.com est parfaitement valide
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

-- 4. Forcer le rechargement du schéma PostgREST
NOTIFY pgrst, 'reload schema';
