-- ==============================================================================
-- ULTIMATE FIX FOR "Database error querying schema"
-- This script cleans up everything that could possibly break the schema cache
-- ==============================================================================

-- 1. Drop any views that might be broken and blocking the schema cache
DROP VIEW IF EXISTS public.v_active_fee_plans CASCADE;

-- 2. Ensure all columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID;

-- 3. Drop all policies on profiles and schools to clear any bad state
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;
DROP POLICY IF EXISTS "Schools isolation" ON public.schools;

-- 4. Recreate the helper functions with absolute safety
-- Using SECURITY DEFINER to bypass RLS and prevent infinite recursion
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
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
  SELECT is_super_admin INTO v_is_super_admin
  FROM public.profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
  
  RETURN COALESCE(v_is_super_admin, FALSE);
END; 
$$;

-- 5. Create the simplest, non-recursive policies
-- Profiles: Users can only read and update their own profile
CREATE POLICY "Profiles read own" ON public.profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE USING (id = auth.uid());

-- Schools: Users can read their own school, super admins can read all
CREATE POLICY "Schools isolation" ON public.schools
FOR SELECT USING (
    public.is_super_admin() 
    OR id = public.get_my_school_id()
);

-- 6. Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
