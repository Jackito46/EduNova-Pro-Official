-- RPC to confirm a user's email from the admin panel
CREATE OR REPLACE FUNCTION public.admin_confirm_user(
    p_user_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Check if caller is SCHOOL_ADMIN, DIRECTOR, SUPER_ADMIN or has is_super_admin flag
    IF NOT (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (role = 'SCHOOL_ADMIN' OR role = 'SUPER_ADMIN' OR role = 'DIRECTOR' OR is_super_admin = true)
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    UPDATE auth.users
    SET email_confirmed_at = now()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
