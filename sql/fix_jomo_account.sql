-- Comprehensive fix for jomo2004@gmail.com

DO $$
DECLARE
    v_user_id UUID;
    v_school_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- Find the school "Collège Pratique Moderne"
    SELECT id INTO v_school_id FROM public.schools WHERE name = 'Collège Pratique Moderne' LIMIT 1;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'School "Collège Pratique Moderne" not found.';
    END IF;

    -- 1. Find the user
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'jomo2004@gmail.com' LIMIT 1;

    v_encrypted_pw := extensions.crypt('admin123', extensions.gen_salt('bf', 10));

    IF v_user_id IS NULL THEN
        -- User doesn't exist, create them
        v_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', 'jomo2004@gmail.com', v_encrypted_pw, now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', 'Admin CPM', 'school_id', v_school_id),
            now(), now()
        );
    ELSE
        -- 2. Update the password with bcrypt cost 10 (GoTrue requirement)
        UPDATE auth.users
        SET 
            encrypted_password = v_encrypted_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb,
            aud = 'authenticated',
            role = 'authenticated'
        WHERE id = v_user_id;
    END IF;

    -- 3. Ensure identity exists
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
        INSERT INTO auth.identities (
            id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            v_user_id::text,
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', 'jomo2004@gmail.com', 'email_verified', true),
            'email',
            now(),
            now(),
            now()
        );
    ELSE
        -- Update existing identity just in case
        UPDATE auth.identities
        SET identity_data = jsonb_build_object('sub', v_user_id::text, 'email', 'jomo2004@gmail.com', 'email_verified', true)
        WHERE user_id = v_user_id AND provider = 'email';
    END IF;

    -- 4. Ensure profile exists and is linked to the correct school
    INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin)
    VALUES (v_user_id, 'jomo2004@gmail.com', 'Admin CPM', 'SCHOOL_ADMIN', v_school_id, FALSE)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = 'SCHOOL_ADMIN',
        school_id = v_school_id;

END $$;
