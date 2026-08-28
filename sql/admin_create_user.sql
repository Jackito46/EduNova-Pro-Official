-- RPC to create a user from the admin panel
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
    INSERT INTO public.profiles (id, email, full_name, role, school_id, force_password_change)
    VALUES (v_user_id, p_email, p_full_name, p_role::user_role, p_school_id, true)
    ON CONFLICT (id) DO UPDATE 
    SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, school_id = EXCLUDED.school_id, force_password_change = true;

    -- If staff_id is provided, link the user to the staff member
    IF p_staff_id IS NOT NULL THEN
        -- We might want to add user_id to staff table, or just keep the link via email.
        -- For now, we can update the staff member's email to match if needed, or just rely on the fact that they are linked conceptually.
        -- Let's add user_id to staff table if it exists, or just update the email.
        UPDATE public.staff SET email = p_email WHERE id = p_staff_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
