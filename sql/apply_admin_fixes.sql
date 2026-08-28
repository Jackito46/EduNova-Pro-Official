-- 1. Update the user's role to SUPER_ADMIN
UPDATE public.profiles
SET role = 'SUPER_ADMIN'
WHERE email = 'jackito46@gmail.com';

-- 2. Update admin_create_user to enforce max 2 SCHOOL_ADMINs and check is_super_admin
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_school_id UUID,
    p_staff_id UUID DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- Check if caller is SCHOOL_ADMIN, DIRECTOR, SUPER_ADMIN or has is_super_admin flag
    IF NOT (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (role = 'SCHOOL_ADMIN' OR role = 'SUPER_ADMIN' OR role = 'DIRECTOR' OR is_super_admin = true)
            AND (school_id = p_school_id OR role = 'SUPER_ADMIN' OR is_super_admin = true)
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    -- Check if email exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cet email est déjà utilisé.');
    END IF;

    -- Enforce max 2 SCHOOL_ADMINs per school
    IF p_role = 'SCHOOL_ADMIN' THEN
        IF (SELECT COUNT(*) FROM public.profiles WHERE school_id = p_school_id AND role = 'SCHOOL_ADMIN' AND is_active = true) >= 2 THEN
            RETURN jsonb_build_object('success', false, 'error', 'La limite de 2 administrateurs par école est atteinte.');
        END IF;
    END IF;

    v_user_id := gen_random_uuid();
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));
    
    -- Insert into auth.users
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_email, v_encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', p_full_name, 'school_id', p_school_id),
        now(), now()
    );

    -- Create identity for the user to allow login
    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', p_email),
        'email',
        now(), now(), now()
    );

    -- Insert into profiles (if not already created by trigger)
    -- We use ON CONFLICT DO UPDATE just in case the trigger already created it
    INSERT INTO public.profiles (id, email, full_name, role, school_id)
    VALUES (v_user_id, p_email, p_full_name, p_role::user_role, p_school_id)
    ON CONFLICT (id) DO UPDATE 
    SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, school_id = EXCLUDED.school_id;

    -- If staff_id is provided, link the user to the staff member
    IF p_staff_id IS NOT NULL THEN
        UPDATE public.staff SET email = p_email WHERE id = p_staff_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Update admin_delete_user to check is_super_admin
CREATE OR REPLACE FUNCTION public.admin_delete_user(
    p_user_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
    DECLARE
        v_caller_role TEXT;
        v_caller_school_id UUID;
        v_caller_is_super_admin BOOLEAN;
        v_target_role TEXT;
        v_target_school_id UUID;
        v_target_is_super_admin BOOLEAN;
    BEGIN
        -- Get caller info
        SELECT role, school_id, is_super_admin INTO v_caller_role, v_caller_school_id, v_caller_is_super_admin
        FROM public.profiles
        WHERE id = auth.uid();

        -- Check if caller has permission
        IF v_caller_role NOT IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR') AND v_caller_is_super_admin != true THEN
            RETURN jsonb_build_object('success', false, 'error', 'Accès refusé. Privilèges insuffisants.');
        END IF;

        -- Get target user info
        SELECT role, school_id, is_super_admin INTO v_target_role, v_target_school_id, v_target_is_super_admin
        FROM public.profiles
        WHERE id = p_user_id;

        -- Prevent deleting oneself
        IF p_user_id = auth.uid() THEN
            RETURN jsonb_build_object('success', false, 'error', 'Vous ne pouvez pas supprimer votre propre compte.');
        END IF;

        -- Prevent deleting a SUPER_ADMIN
        IF v_target_role = 'SUPER_ADMIN' OR v_target_is_super_admin = true THEN
            RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer un Super Administrateur.');
        END IF;

        -- Check school isolation
        IF v_caller_role != 'SUPER_ADMIN' AND v_caller_is_super_admin != true AND v_caller_school_id != v_target_school_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Accès refusé. L''utilisateur n''appartient pas à votre école.');
        END IF;

    -- Delete from public.profiles (if not cascaded)
    DELETE FROM public.profiles WHERE id = p_user_id;

    -- Delete from auth.identities
    DELETE FROM auth.identities WHERE user_id = p_user_id;

    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
