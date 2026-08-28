-- Fix for "permission denied for table users" error
BEGIN;

-- 1. Create a safe SECURITY DEFINER function to check if a user is super admin
-- This avoids querying auth.users directly in policies, which causes permission errors
CREATE OR REPLACE FUNCTION public.is_super_admin_safe(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  BEGIN
    SELECT COALESCE((raw_user_meta_data->>'is_super_admin')::boolean, false)
    INTO v_is_super_admin
    FROM auth.users
    WHERE id = p_user_id LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_is_super_admin := false;
  END;
  RETURN COALESCE(v_is_super_admin, false);
END;
$$;

-- Ensure the function is owned by postgres so it bypasses RLS
ALTER FUNCTION public.is_super_admin_safe(UUID) OWNER TO postgres;

-- 2. Drop the problematic policies that query auth.users directly
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;
DROP POLICY IF EXISTS "Schools read superadmin" ON public.schools;
DROP POLICY IF EXISTS "Schools update superadmin" ON public.schools;

-- 3. Recreate the policies using the safe function
CREATE POLICY "Profiles read superadmin" ON public.profiles
FOR SELECT USING (public.is_super_admin_safe(auth.uid()));

CREATE POLICY "Schools read superadmin" ON public.schools
FOR SELECT USING (public.is_super_admin_safe(auth.uid()));

CREATE POLICY "Schools update superadmin" ON public.schools
FOR UPDATE USING (public.is_super_admin_safe(auth.uid()));

COMMIT;
