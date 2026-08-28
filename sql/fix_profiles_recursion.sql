-- Fix RLS recursion causing "Database error querying schema"

-- 1. Drop all existing policies on profiles to start fresh
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;

-- 2. Create non-recursive policies for profiles
-- A user can always read their own profile
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (id = auth.uid());

-- A user can always update their own profile
CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (id = auth.uid());

-- Allow reading all profiles in the same school, using a subquery that avoids the function call
CREATE POLICY "Profiles read school" ON public.profiles
FOR SELECT USING (
    school_id = (SELECT p2.school_id FROM public.profiles p2 WHERE p2.id = auth.uid())
);

-- Super admins can read everything (we check the JWT claim instead of querying the table to avoid recursion)
CREATE POLICY "Profiles read superadmin" ON public.profiles
FOR SELECT USING (
    (auth.jwt() ->> 'is_super_admin')::boolean = true
);

-- 3. Fix the functions to ensure they don't cause infinite recursion if used elsewhere
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- We use a direct query that bypasses RLS because of SECURITY DEFINER
  SELECT school_id INTO v_school_id
  FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
  
  RETURN v_school_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- We use a direct query that bypasses RLS because of SECURITY DEFINER
  SELECT is_super_admin INTO v_is_super_admin
  FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
  
  RETURN COALESCE(v_is_super_admin, FALSE);
END; 
$$;

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
