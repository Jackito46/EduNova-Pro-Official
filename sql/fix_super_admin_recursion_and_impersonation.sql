-- Fix recursion in helper functions and ensure Super Admin impersonation works
BEGIN;

-- 1. Robust and non-recursive is_super_admin
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
  SELECT COALESCE((raw_user_meta_data->>'is_super_admin')::boolean, false)
  INTO v_is_super
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN COALESCE(v_is_super, false);
END;
$$;

-- 2. Robust get_my_school_id
-- This one still needs to read from profiles because that's where impersonation happens
-- But we make it SECURITY DEFINER to bypass RLS and avoid recursion
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
  WHERE id = auth.uid();
  
  RETURN v_school_id;
END;
$$;

-- 3. Clean up profiles policies to ensure impersonation and reset work
DROP POLICY IF EXISTS "Profiles select isolation" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update isolation" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;
DROP POLICY IF EXISTS "Isolation profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update school admin" ON public.profiles;

-- Permissive policy for Super Admins (Global access)
CREATE POLICY "Profiles super admin all" ON public.profiles
FOR ALL USING (public.is_super_admin());

-- Policy for users to see their own profile and others in their school
CREATE POLICY "Profiles school access" ON public.profiles
FOR SELECT USING (
    id = auth.uid() OR 
    school_id = public.get_my_school_id()
);

-- Policy for users to update their own profile
-- This is critical for Super Admins to switch/reset school_id
CREATE POLICY "Profiles self update" ON public.profiles
FOR UPDATE USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 4. Ensure audit_logs is also fixed
ALTER TABLE public.audit_logs ALTER COLUMN school_id DROP NOT NULL;

DROP POLICY IF EXISTS "Audit logs select" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs insert" ON public.audit_logs;
DROP POLICY IF EXISTS "Isolation audit_logs" ON public.audit_logs;

CREATE POLICY "Audit logs select" ON public.audit_logs
FOR SELECT USING (
    public.is_super_admin() OR 
    school_id = public.get_my_school_id()
);

CREATE POLICY "Audit logs insert" ON public.audit_logs
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
);

COMMIT;

NOTIFY pgrst, 'reload schema';
