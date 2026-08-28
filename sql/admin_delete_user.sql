-- RPC to delete a user from the admin panel
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
