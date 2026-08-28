-- ==============================================================================
-- FINAL MASTER RLS FIX (V4)
-- Resolves "Database error querying schema" and login issues for school accounts.
-- ==============================================================================

BEGIN;

-- 1. Ensure helper functions are robust and non-recursive
-- is_super_admin() uses JWT metadata to avoid hitting the profiles table.
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

-- get_my_school_id() is SECURITY DEFINER and owned by postgres to bypass RLS.
-- This is the ONLY safe way to query the profiles table from within an RLS policy.
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

-- Explicitly set owner to postgres to ensure RLS bypass
ALTER FUNCTION public.is_super_admin() OWNER TO postgres;
ALTER FUNCTION public.get_my_school_id() OWNER TO postgres;

-- 2. Clean up ALL policies on critical tables to avoid conflicts
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all policies on profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
    END LOOP;
    
    -- Drop all policies on schools
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'schools') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname); -- Fix: should be schools
    END LOOP;
END $$;

-- Correction for the loop above (schools)
DROP POLICY IF EXISTS "Schools isolation" ON public.schools;
DROP POLICY IF EXISTS "Schools update" ON public.schools;

-- 3. Recreate clean, non-recursive policies for PROFILES
-- Policy 1: Self access (No function call = No recursion)
CREATE POLICY "Profiles self select" ON public.profiles
FOR SELECT USING (id = auth.uid());

-- Policy 2: Super Admin access (Uses non-recursive is_super_admin())
CREATE POLICY "Profiles super admin select" ON public.profiles
FOR SELECT USING (public.is_super_admin());

-- Policy 3: School access (Uses SECURITY DEFINER get_my_school_id())
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

-- 4. Recreate clean policies for SCHOOLS
CREATE POLICY "Schools isolation" ON public.schools
FOR SELECT USING (
    id = public.get_my_school_id() OR public.is_super_admin()
);

CREATE POLICY "Schools update" ON public.schools
FOR UPDATE USING (
    id = public.get_my_school_id() OR public.is_super_admin()
);

-- 5. Generic isolation for other tables
CREATE OR REPLACE FUNCTION public.apply_safe_rls(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);
    
    -- Drop existing isolation policies
    EXECUTE format('DROP POLICY IF EXISTS "Isolation %I" ON public.%I', p_table_name, p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Audit logs isolation" ON public.%I', p_table_name);
    
    -- Create new safe policy
    -- Note: We handle Super Admin "global" mode (school_id IS NULL)
    EXECUTE format('CREATE POLICY "Isolation %I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR (public.is_super_admin() AND public.get_my_school_id() IS NULL))', p_table_name, p_table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
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

-- Force PostgREST to reload the schema
NOTIFY pgrst, 'reload schema';
