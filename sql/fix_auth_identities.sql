-- Script to fix missing identities in auth.users
-- This will create an identity for users who don't have one, allowing them to log in.

INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    extensions.uuid_generate_v4(),
    u.id::text,
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    now(),
    now(),
    now()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
);

-- Update admin_create_tenant to include identity creation
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
    p_school_name TEXT,
    p_admin_email TEXT,
    p_admin_password TEXT,
    p_admin_name TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_school_id UUID;
    v_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    IF NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé. Seul un Super Admin peut créer un établissement.');
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cet email est déjà utilisé par un autre utilisateur.');
    END IF;

    v_school_id := extensions.uuid_generate_v4();

    INSERT INTO public.schools (id, name, status, subscription_plan)
    VALUES (v_school_id, p_school_name, 'ACTIVE', 'trial');

    v_user_id := extensions.uuid_generate_v4();
    v_encrypted_pw := extensions.crypt(p_admin_password, extensions.gen_salt('bf'));
    
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_admin_email, v_encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', p_admin_name, 'school_id', v_school_id),
        now(), now()
    );

    -- Create identity for the user to allow login
    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        extensions.uuid_generate_v4(),
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', p_admin_email),
        'email',
        now(),
        now(),
        now()
    );

    INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin)
    VALUES (v_user_id, p_admin_email, p_admin_name, 'SCHOOL_ADMIN', v_school_id, FALSE)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        school_id = EXCLUDED.school_id,
        is_super_admin = EXCLUDED.is_super_admin;

    RETURN jsonb_build_object(
        'success', true, 
        'school_id', v_school_id, 
        'admin_id', v_user_id,
        'message', 'Établissement et administrateur créés avec succès.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
