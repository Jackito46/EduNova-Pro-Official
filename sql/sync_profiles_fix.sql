-- ==============================================================================
-- SYNC PROFILES FIX
-- Ensures all users have a profile and a school_id.
-- ==============================================================================

BEGIN;

-- 1. Ensure all users in auth.users have a profile in public.profiles
INSERT INTO public.profiles (id, email, full_name, role, school_id, is_super_admin, force_password_change)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'full_name', 'Utilisateur ' || substring(au.id::text, 1, 5)), 
    COALESCE(au.raw_user_meta_data->>'role', 'SCHOOL_ADMIN'),
    COALESCE((au.raw_user_meta_data->>'school_id')::uuid, (SELECT id FROM public.schools ORDER BY created_at ASC LIMIT 1)),
    COALESCE((au.raw_user_meta_data->>'is_super_admin')::boolean, false),
    TRUE
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure all profiles have a school_id if they are not super admins
UPDATE public.profiles
SET school_id = (SELECT id FROM public.schools ORDER BY created_at ASC LIMIT 1)
WHERE school_id IS NULL AND is_super_admin = FALSE;

-- 3. Ensure super admins have is_super_admin = TRUE in profiles
UPDATE public.profiles
SET is_super_admin = TRUE
WHERE role = 'SUPER_ADMIN' OR (id IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'is_super_admin' = 'true'));

-- 4. Update auth.users metadata to match profiles (important for non-recursive RLS)
-- This requires a SECURITY DEFINER function to update auth.users
CREATE OR REPLACE FUNCTION public.sync_auth_metadata()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, school_id, is_super_admin FROM public.profiles LOOP
        UPDATE auth.users
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('school_id', r.school_id, 'is_super_admin', r.is_super_admin)
        WHERE id = r.id;
    END LOOP;
END;
$$;

SELECT public.sync_auth_metadata();
DROP FUNCTION public.sync_auth_metadata();

COMMIT;
