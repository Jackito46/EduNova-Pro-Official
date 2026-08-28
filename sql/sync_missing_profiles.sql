-- Function to sync missing profiles for users in auth.users
CREATE OR REPLACE FUNCTION public.sync_missing_profiles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user RECORD;
    v_count INTEGER := 0;
    v_school_id UUID;
    v_is_super_admin BOOLEAN;
BEGIN
    -- Check if caller is SUPER_ADMIN or SCHOOL_ADMIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'SUPER_ADMIN' OR role = 'SCHOOL_ADMIN' OR is_super_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé');
    END IF;

    FOR v_user IN 
        SELECT id, email, raw_user_meta_data 
        FROM auth.users 
        WHERE id NOT IN (SELECT id FROM public.profiles)
    LOOP
        -- Determine school_id
        IF v_user.raw_user_meta_data->>'school_id' IS NOT NULL AND v_user.raw_user_meta_data->>'school_id' != '' THEN
            v_school_id := (v_user.raw_user_meta_data->>'school_id')::uuid;
        ELSE
            SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
        END IF;

        -- Determine is_super_admin
        IF v_user.raw_user_meta_data->>'is_super_admin' = 'true' THEN
            v_is_super_admin := TRUE;
        ELSE
            v_is_super_admin := FALSE;
        END IF;

        -- Insert missing profile
        BEGIN
            INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin)
            VALUES (
                v_user.id, 
                v_user.email, 
                COALESCE(v_user.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(v_user.id::text, 1, 5)), 
                COALESCE(v_user.raw_user_meta_data->>'role', 'SCHOOL_ADMIN'),
                v_school_id,
                v_is_super_admin
            );
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Log error or ignore
            RAISE NOTICE 'Error inserting profile for user %: %', v_user.id, SQLERRM;
        END;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'synced_count', v_count);
END;
$$;
