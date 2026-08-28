-- RPC to fire a staff member
CREATE OR REPLACE FUNCTION public.admin_fire_staff(
    p_staff_id UUID,
    p_reason TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
    DECLARE
        v_caller_role TEXT;
        v_caller_school_id UUID;
        v_staff_email TEXT;
        v_staff_school_id UUID;
        v_staff_name TEXT;
    BEGIN
        -- Get caller info
        SELECT role, school_id INTO v_caller_role, v_caller_school_id
        FROM public.profiles
        WHERE id = auth.uid();

        -- Check if caller has permission
        IF v_caller_role NOT IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only admins can fire staff.');
        END IF;

        -- Get staff info
        SELECT email, school_id, first_name || ' ' || last_name INTO v_staff_email, v_staff_school_id, v_staff_name
        FROM public.staff
        WHERE id = p_staff_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Staff member not found.');
        END IF;

        -- Check school match
        IF v_caller_role != 'SUPER_ADMIN' AND v_caller_school_id != v_staff_school_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Staff member belongs to a different school.');
        END IF;

        -- Update staff status
        UPDATE public.staff
        SET status = 'Licencié'
        WHERE id = p_staff_id;

        -- If staff has an email, try to disable their user profile
        IF v_staff_email IS NOT NULL AND v_staff_email != '' THEN
            UPDATE public.profiles
            SET is_active = false
            WHERE email = v_staff_email AND school_id = v_staff_school_id;
        END IF;

        -- Log the action
        INSERT INTO public.audit_logs (
            school_id,
            user_id,
            action,
            entity_type,
            entity_id,
            details
        ) VALUES (
            v_staff_school_id,
            auth.uid(),
            'FIRE_STAFF',
            'staff',
            p_staff_id,
            jsonb_build_object(
                'name', v_staff_name,
                'reason', p_reason
            )
        );

        RETURN jsonb_build_object('success', true);
    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
$$;
