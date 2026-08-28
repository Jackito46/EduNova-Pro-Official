CREATE OR REPLACE FUNCTION public.admin_toggle_user_status(p_user_id UUID, p_new_status BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- In case metadata is missing, check with safe function
    IF v_caller_is_super_admin IS NULL OR v_caller_is_super_admin = false THEN
        v_caller_is_super_admin := public.is_super_admin_safe(auth.uid());
    END IF;

    -- Check if caller has permission
    IF lower(v_caller_role) NOT IN ('super_admin', 'school_admin', 'director', 'admin') AND v_caller_is_super_admin != true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé. Privilèges insuffisants.');
    END IF;

    -- Get target user info
    SELECT role, school_id, is_super_admin INTO v_target_role, v_target_school_id, v_target_is_super_admin
    FROM public.profiles
    WHERE id = p_user_id;

    -- Prevent disabling oneself
    IF p_user_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vous ne pouvez pas modifier votre propre statut d''accès.');
    END IF;

    -- Prevent disabling a SUPER_ADMIN
    IF lower(v_target_role) = 'super_admin' OR v_target_is_super_admin = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier le statut d''un Super Administrateur.');
    END IF;

    -- Check school isolation
    IF v_caller_is_super_admin != true AND v_caller_school_id != v_target_school_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé. L''utilisateur n''appartient pas à votre école.');
    END IF;

    -- Update the profile
    UPDATE public.profiles 
    SET is_active = p_new_status
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
