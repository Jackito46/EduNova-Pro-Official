-- ==========================================================
-- SCRIPT DE SUPPRESSION DÉFINITIVE D'UTILISATEURS
-- ==========================================================

DO $$
DECLARE
    -- Liste des IDs des utilisateurs à supprimer
    user_ids UUID[] := ARRAY[
        'eeb76ef3-54aa-4d62-9a1f-0c22eee92af2'::UUID,
        'c760a7db-f1dc-4195-9663-1da843bf7066'::UUID,
        '7f24958b-d962-4eda-89e4-70014c7d106c'::UUID
    ];
    uid UUID;
BEGIN
    FOREACH uid IN ARRAY user_ids
    LOOP
        -- 1. Supprimer les dépendances dans le schéma public (qui bloquent souvent la suppression)
        -- Si vous avez d'autres tables liées à l'utilisateur, ajoutez-les ici.
        DELETE FROM public.profiles WHERE id = uid;
        
        -- 2. Supprimer les dépendances dans le schéma auth (Normalement géré par CASCADE, mais forcé par sécurité)
        DELETE FROM auth.identities WHERE user_id = uid;
        DELETE FROM auth.sessions WHERE user_id = uid;
        DELETE FROM auth.refresh_tokens WHERE user_id = uid::varchar;
        DELETE FROM auth.mfa_factors WHERE user_id = uid;
        
        -- 3. Supprimer l'utilisateur principal
        DELETE FROM auth.users WHERE id = uid;
        
        RAISE NOTICE 'Utilisateur % supprimé avec succès en cascade.', uid;
    END LOOP;
END $$;
