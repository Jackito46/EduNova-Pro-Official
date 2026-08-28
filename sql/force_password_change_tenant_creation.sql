-- Migration script: Force password change on tenant creation
-- This updates admin_create_tenant to set force_password_change = TRUE when creating new school admins.

CREATE OR REPLACE FUNCTION public.admin_create_tenant(
    p_school_name TEXT,
    p_admin_email TEXT,
    p_admin_password TEXT,
    p_admin_name TEXT,
    p_school_type TEXT DEFAULT 'CLASSIC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $f$
DECLARE
    v_school_id UUID;
    v_user_id UUID;
    v_encrypted_pw TEXT;
    v_instance_id UUID;
BEGIN
    -- 1. Check permissions utilizing the bulletproof function
    IF NOT public.is_super_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé. Seul un Super Admin peut créer un établissement.');
    END IF;

    -- 2. Check if email exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cet email est déjà utilisé par un autre utilisateur.');
    END IF;

    -- 3. Get instance_id
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
    IF v_instance_id IS NULL THEN
        v_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    v_school_id := extensions.uuid_generate_v4();
    v_user_id := extensions.uuid_generate_v4();
    v_encrypted_pw := extensions.crypt(p_admin_password, extensions.gen_salt('bf'));

    -- 4. Create school with type
    INSERT INTO public.schools (id, name, status, subscription_plan, school_type)
    VALUES (v_school_id, p_school_name, 'ACTIVE', 'trial', COALESCE(p_school_type, 'CLASSIC'));

    -- 5. Create auth user
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        v_instance_id, v_user_id, 'authenticated', 'authenticated', p_admin_email, v_encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', p_admin_name, 'school_id', v_school_id::text, 'role', 'SCHOOL_ADMIN'),
        now(), now()
    );

    -- 6. Create identity
    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        extensions.uuid_generate_v4(),
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', p_admin_email, 'email_verified', true),
        'email',
        now(),
        now(),
        now()
    );

    -- 7. Create profile with force_password_change = TRUE
    INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, force_password_change)
    VALUES (v_user_id, p_admin_email, p_admin_name, 'SCHOOL_ADMIN', v_school_id, FALSE, TRUE)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        school_id = EXCLUDED.school_id,
        is_super_admin = EXCLUDED.is_super_admin,
        force_password_change = TRUE;

    -- 8. Seed standard data
    PERFORM public.seed_school_data(v_school_id);

    RETURN jsonb_build_object(
        'success', true, 
        'school_id', v_school_id, 
        'admin_id', v_user_id,
        'message', 'Établissement et administrateur créés avec succès. Modification du mot de passe requise à la première connexion.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $f$;
