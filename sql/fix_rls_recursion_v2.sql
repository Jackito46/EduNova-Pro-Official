-- Final Fix for RLS Recursion and Login 500 Errors
-- This script ensures functions are non-recursive and policies are safe.

BEGIN;

-- 1. Non-recursive is_super_admin using JWT metadata
-- This avoids hitting the profiles table entirely for the super admin check
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Check user_metadata first, then app_metadata
  RETURN (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean, false) OR
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false)
  );
END;
$$;

-- 2. Robust get_my_school_id
-- We use a SECURITY DEFINER function to bypass RLS when querying profiles
-- We also add a check to prevent infinite recursion just in case
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- If not logged in, return null
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Query profiles table. 
  -- Since this is SECURITY DEFINER and owned by postgres (default), it bypasses RLS.
  SELECT school_id INTO v_school_id 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  RETURN v_school_id;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO public;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO public;

-- 4. Clean up profiles policies
-- We must be VERY careful with the profiles table to avoid recursion
DROP POLICY IF EXISTS "Profiles self select" ON public.profiles;
DROP POLICY IF EXISTS "Profiles super admin select" ON public.profiles;
DROP POLICY IF EXISTS "Profiles school select" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles super admin update" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read superadmin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles school access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles super admin all" ON public.profiles;
DROP POLICY IF EXISTS "Isolation profiles" ON public.profiles;

-- Policy 1: Always allow users to see their own profile (No function call = No recursion)
CREATE POLICY "Profiles self select" ON public.profiles
FOR SELECT USING (id = auth.uid());

-- Policy 2: Super Admins can see everything
-- is_super_admin() is now non-recursive (uses JWT), so this is safe
CREATE POLICY "Profiles super admin select" ON public.profiles
FOR SELECT USING (public.is_super_admin());

-- Policy 3: Users can see others in their school
-- get_my_school_id() is SECURITY DEFINER, so it bypasses RLS and avoids recursion
CREATE POLICY "Profiles school select" ON public.profiles
FOR SELECT USING (
    school_id IS NOT NULL AND 
    school_id = public.get_my_school_id()
);

-- Policy 4: Self update
CREATE POLICY "Profiles self update" ON public.profiles
FOR UPDATE USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 5: Super admin update
CREATE POLICY "Profiles super admin update" ON public.profiles
FOR UPDATE USING (public.is_super_admin());

-- 5. Fix other tables that might be using recursive policies
-- We'll update the generic isolation policy to be safer
CREATE OR REPLACE FUNCTION public.apply_safe_rls(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Isolation %I" ON public.%I', p_table_name, p_table_name);
    -- Use the SECURITY DEFINER functions which are safe
    EXECUTE format('CREATE POLICY "Isolation %I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR public.is_super_admin())', p_table_name, p_table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply to main tables (excluding profiles which we handled specifically)
SELECT public.apply_safe_rls('academic_years');
SELECT public.apply_safe_rls('classes');
SELECT public.apply_safe_rls('subjects');
SELECT public.apply_safe_rls('students');
SELECT public.apply_safe_rls('fee_plans');
SELECT public.apply_safe_rls('expense_categories');
SELECT public.apply_safe_rls('expenses');
SELECT public.apply_safe_rls('payments');
SELECT public.apply_safe_rls('staff');
SELECT public.apply_safe_rls('enrollments');
SELECT public.apply_safe_rls('staff_assignments');
SELECT public.apply_safe_rls('staff_attendances');
SELECT public.apply_safe_rls('payroll_periods');
SELECT public.apply_safe_rls('school_supplies');
SELECT public.apply_safe_rls('supply_catalog');
SELECT public.apply_safe_rls('audit_logs');
SELECT public.apply_safe_rls('payroll_slips');
SELECT public.apply_safe_rls('grades');
SELECT public.apply_safe_rls('student_attendances');
SELECT public.apply_safe_rls('salary_advances');

COMMIT;

NOTIFY pgrst, 'reload schema';
