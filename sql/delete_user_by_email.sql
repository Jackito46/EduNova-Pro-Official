DO $$
DECLARE
    target_uid UUID;
BEGIN
    -- Trouver l'ID de l'utilisateur via son email
    SELECT id INTO target_uid FROM auth.users WHERE email = 'hebac2019@gmail.com';
    
    IF target_uid IS NULL THEN
        RAISE NOTICE 'Utilisateur introuvable.';
        RETURN;
    END IF;

    -- 1. Détacher l'utilisateur de son historique pour éviter les erreurs de contraintes
    UPDATE public.exchange_rates SET created_by = NULL WHERE created_by = target_uid;
    UPDATE public.audit_logs SET user_id = NULL WHERE user_id = target_uid;
    UPDATE public.payroll_slips SET paid_by = NULL WHERE paid_by = target_uid;
    UPDATE public.staff_attendances SET validated_by = NULL WHERE validated_by = target_uid;
    
    -- 2. Supprimer le profil public
    DELETE FROM public.profiles WHERE id = target_uid;
    
    -- 3. Supprimer les données d'authentification liées
    DELETE FROM auth.identities WHERE user_id = target_uid;
    DELETE FROM auth.sessions WHERE user_id = target_uid;
    DELETE FROM auth.refresh_tokens WHERE user_id = target_uid::varchar;
    DELETE FROM auth.mfa_factors WHERE user_id = target_uid;
    
    -- 4. Supprimer l'utilisateur principal
    DELETE FROM auth.users WHERE id = target_uid;
    
    RAISE NOTICE 'Utilisateur supprimé avec succès en cascade.';
END $$;
