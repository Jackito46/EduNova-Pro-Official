-- ==========================================================
-- SCRIPT DE SUPPRESSION D'UN SEUL UTILISATEUR
-- ==========================================================

DO $$
DECLARE
    -- Remplacez l'UUID ci-dessous par celui de l'utilisateur à supprimer
    target_uid UUID := 'VOTRE-UUID-ICI'::UUID;
BEGIN
    -- 1. Supprimer les dépendances dans le schéma public
    DELETE FROM public.profiles WHERE id = target_uid;
    
    -- 2. Supprimer les dépendances dans le schéma auth
    DELETE FROM auth.identities WHERE user_id = target_uid;
    DELETE FROM auth.sessions WHERE user_id = target_uid;
    DELETE FROM auth.refresh_tokens WHERE user_id = target_uid::varchar;
    DELETE FROM auth.mfa_factors WHERE user_id = target_uid;
    
    -- 3. Supprimer l'utilisateur principal
    DELETE FROM auth.users WHERE id = target_uid;
    
    RAISE NOTICE 'Utilisateur % supprimé avec succès en cascade.', target_uid;
END $$;
