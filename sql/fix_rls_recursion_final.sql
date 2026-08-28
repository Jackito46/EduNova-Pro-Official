-- Fix RLS recursion and "Database error querying schema"
-- This script simplifies policies and ensures functions are accessible and non-recursive

BEGIN;

-- 1. Ensure functions are robust and accessible
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_super BOOLEAN;
BEGIN
  -- We check auth.users metadata to avoid recursion with public.profiles
  -- If auth.uid() is null (e.g. during schema introspection), this returns false
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE((raw_user_meta_data->>'is_super_admin')::boolean, false)
  INTO v_is_super
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN COALESCE(v_is_super, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- SECURITY DEFINER bypasses RLS if owner is postgres
  SELECT school_id INTO v_school_id 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  RETURN v_school_id;
END;
$$;

-- Grant execute to everyone so PostgREST can use them during schema introspection
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO public;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO public;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO anon;

-- 2. Clean up ALL possible conflicting policies on profiles
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

-- 3. Recreate clean, non-recursive policies for profiles
-- Policy 1: Everyone can see their own profile (No function call needed)
CREATE POLICY "Profiles self select" ON public.profiles
FOR SELECT USING (id = auth.uid());

-- Policy 2: Super Admins can see everything
CREATE POLICY "Profiles super admin select" ON public.profiles
FOR SELECT USING (public.is_super_admin());

-- Policy 3: Users can see others in their school
-- We use a subquery that is explicitly non-recursive by using the SECURITY DEFINER function
CREATE POLICY "Profiles school select" ON public.profiles
FOR SELECT USING (
    school_id IS NOT NULL AND 
    school_id = public.get_my_school_id()
);

-- Policy 4: Self update (Critical for impersonation)
CREATE POLICY "Profiles self update" ON public.profiles
FOR UPDATE USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 5: Super admin update all
CREATE POLICY "Profiles super admin update" ON public.profiles
FOR UPDATE USING (public.is_super_admin());

-- 4. Fix audit_logs policies too
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'audit_logs' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Audit logs select" ON public.audit_logs
FOR SELECT USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

CREATE POLICY "Audit logs insert" ON public.audit_logs
FOR INSERT WITH CHECK (true);

COMMIT;

NOTIFY pgrst, 'reload schema';
