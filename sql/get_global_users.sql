CREATE OR REPLACE FUNCTION public.get_global_users_with_login()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    school_id UUID,
    is_super_admin BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN,
    school_name TEXT,
    last_login TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        p.role,
        p.school_id,
        p.is_super_admin,
        p.created_at,
        p.is_active,
        s.name AS school_name,
        au.last_sign_in_at AS last_login
    FROM public.profiles p
    LEFT JOIN public.schools s ON p.school_id = s.id
    LEFT JOIN auth.users au ON p.id = au.id
    ORDER BY p.created_at DESC
    LIMIT 100;
END;
$$;
