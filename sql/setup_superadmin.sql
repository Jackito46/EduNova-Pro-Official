-- Script pour configurer le Super Admin (création ou réinitialisation)
DO $$
DECLARE
    super_admin_email TEXT := 'jackito46@gmail.com';
    super_admin_password TEXT := 'admin123';
    super_admin_id UUID;
BEGIN
    -- Vérifier si l'utilisateur existe déjà dans auth.users
    SELECT id INTO super_admin_id FROM auth.users WHERE email = super_admin_email;

    IF super_admin_id IS NULL THEN
        -- Créer l'utilisateur s'il n'existe pas
        super_admin_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            super_admin_id,
            '00000000-0000-0000-0000-000000000000',
            super_admin_email,
            crypt(super_admin_password, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"role":"SUPER_ADMIN"}',
            now(),
            now(),
            'authenticated',
            '',
            '',
            '',
            ''
        );
        
        RAISE NOTICE 'Utilisateur Super Admin créé avec succès.';
    ELSE
        -- Mettre à jour le mot de passe s'il existe déjà
        UPDATE auth.users 
        SET encrypted_password = crypt(super_admin_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_user_meta_data = '{"role":"SUPER_ADMIN"}'
        WHERE id = super_admin_id;
        
        RAISE NOTICE 'Mot de passe du Super Admin réinitialisé avec succès.';
    END IF;

    -- Vérifier si le profil existe
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = super_admin_id) THEN
        -- Créer le profil s'il n'existe pas
        INSERT INTO public.profiles (
            id,
            email,
            first_name,
            last_name,
            role,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            super_admin_id,
            super_admin_email,
            'Super',
            'Admin',
            'SUPER_ADMIN',
            true,
            now(),
            now()
        );
        RAISE NOTICE 'Profil Super Admin créé avec succès.';
    ELSE
        -- S'assurer que le rôle est bien SUPER_ADMIN
        UPDATE public.profiles
        SET role = 'SUPER_ADMIN',
            is_active = true
        WHERE id = super_admin_id;
        RAISE NOTICE 'Profil Super Admin mis à jour avec succès.';
    END IF;

END $$;
