-- DEFINITIVE FIX FOR "Database error querying schema" AND RLS RECURSION
-- This script simplifies policies and functions to eliminate any possibility of infinite recursion.

-- 1. Robust helper functions (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_super boolean;
BEGIN
  -- Check JWT first (fastest)
  IF (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean = true THEN
    RETURN true;
  END IF;
  
  IF (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true THEN
    RETURN true;
  END IF;

  -- Fallback to DB check (bypasses RLS because of SECURITY DEFINER)
  SELECT is_super_admin INTO v_is_super FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_is_super, false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  -- Try JWT first
  v_school_id := (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid;
  IF v_school_id IS NOT NULL THEN
    RETURN v_school_id;
  END IF;

  -- Fallback to DB check
  SELECT school_id INTO v_school_id FROM public.profiles WHERE id = auth.uid();
  RETURN v_school_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 2. Clean up and recreate Profiles policies
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_v2" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write_v2" ON public.profiles;

-- Simple, non-recursive read policy
CREATE POLICY "profiles_read_v3" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid() OR 
  is_super_admin() OR 
  (school_id = get_my_school_id() AND is_super_admin = false)
);

-- Simple, non-recursive write policy
CREATE POLICY "profiles_write_v3" ON public.profiles
FOR ALL TO authenticated
USING (
  id = auth.uid() OR 
  is_super_admin()
)
WITH CHECK (
  id = auth.uid() OR 
  is_super_admin()
);

-- 3. Ensure Schools policies are safe
DROP POLICY IF EXISTS "schools_read" ON public.schools;
DROP POLICY IF EXISTS "schools_read_v2" ON public.schools;
CREATE POLICY "schools_read_v3" ON public.schools
FOR SELECT TO authenticated
USING (true); -- Schools are public for authenticated users to allow profile linking

-- 4. Fix specific user metadata if needed
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"is_super_admin": false}'::jsonb
WHERE email = 'jobpardieu2000@gmail.com' AND (raw_user_meta_data->>'is_super_admin') IS NULL;

-- 5. Force schema reload
NOTIFY pgrst, 'reload schema';

