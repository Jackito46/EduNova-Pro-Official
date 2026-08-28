-- Fix is_super_admin to be type-safe and robust
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $f$
DECLARE
    v_role text;
    v_email text;
BEGIN
    -- Get data from JWT
    v_email := auth.jwt() ->> 'email';
    v_role := auth.jwt() -> 'user_metadata' ->> 'role';

    -- 1. Check email fallback (Jackito)
    IF v_email = 'jackito46@gmail.com' THEN
        RETURN TRUE;
    END IF;

    -- 2. Check JWT metadata
    IF v_role IN ('super_admin', 'SUPER_ADMIN') THEN
        RETURN TRUE;
    END IF;

    -- 3. Check profiles table with explicit casting
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id::text = auth.uid()::text 
        AND role::text IN ('super_admin', 'SUPER_ADMIN')
    );
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END; $f$;

-- Fix get_my_school_id_safe to return text and be robust
CREATE OR REPLACE FUNCTION public.get_my_school_id_safe()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $f$
DECLARE 
    v_id text;
    v_profile_school_id uuid;
BEGIN
    -- Try JWT metadata first
    v_id := auth.jwt() -> 'user_metadata' ->> 'school_id';
    
    IF v_id IS NOT NULL AND v_id != '' THEN
        RETURN v_id;
    END IF;

    -- Fallback to profiles table
    SELECT school_id INTO v_profile_school_id
    FROM public.profiles
    WHERE id::text = auth.uid()::text;

    RETURN v_profile_school_id::text;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END; $f$;
