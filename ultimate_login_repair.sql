
-- ==============================================================================
-- ULTIMATE LOGIN AND SCHEMA REPAIR
-- Resolves "Database error querying schema" by eliminating recursion
-- ==============================================================================

-- 1. DROP ALL POTENTIALLY CONFLICTING POLICIES
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('profiles', 'schools')) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. RECREATE HELPER FUNCTIONS WITH ZERO RECURSION POTENTIAL
-- These functions use SECURITY DEFINER and SET search_path to be bulletproof.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
    v_role TEXT;
    v_is_super BOOLEAN;
BEGIN
    -- 1. Check hardcoded dev email (jackito46@gmail.com)
    v_email := auth.jwt() ->> 'email';
    IF v_email = 'jackito46@gmail.com' THEN
        RETURN TRUE;
    END IF;

    -- 2. Check JWT metadata (fastest)
    v_role := auth.jwt() -> 'user_metadata' ->> 'role';
    IF v_role IN ('super_admin', 'SUPER_ADMIN') THEN
        RETURN TRUE;
    END IF;

    -- 3. Database fallback (Security Definer ensures no RLS recursion)
    -- We use a direct query with LIMIT 1
    SELECT is_super_admin INTO v_is_super
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN COALESCE(v_is_super, FALSE);
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_id_text TEXT;
    v_school_id UUID;
BEGIN
    -- 1. Check JWT metadata (fastest)
    v_id_text := auth.jwt() -> 'user_metadata' ->> 'school_id';
    IF v_id_text IS NOT NULL AND v_id_text != '' THEN
        RETURN v_id_text::UUID;
    END IF;

    -- 2. Database fallback (Security Definer ensures no RLS recursion)
    SELECT school_id INTO v_school_id
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN v_school_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- 3. APPLY CLEAN, NON-RECURSIVE POLICIES

-- PROFILES: Extremely safe. Read own, or superadmin read all.
-- We avoid calling get_my_school_id() here to stay away from the same-table cycle.
-- If an admin needs to see others, they should have school_id in their JWT.
CREATE POLICY "profiles_read_v1" ON public.profiles FOR SELECT 
USING (
    id = auth.uid() 
    OR is_super_admin()
    OR (school_id::text = auth.jwt() -> 'user_metadata' ->> 'school_id')
);

CREATE POLICY "profiles_update_v1" ON public.profiles FOR UPDATE
USING (id = auth.uid() OR is_super_admin());

CREATE POLICY "profiles_insert_v1" ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid() OR is_super_admin());

-- SCHOOLS: Safe isolation
CREATE POLICY "schools_read_v1" ON public.schools FOR SELECT
USING (
    is_super_admin()
    OR id = get_my_school_id()
);

-- 4. FIX OTHER TABLES THAT MIGHT BE CAUSING STALLS
-- Ensure all common tables use the helper functions instead of subqueries
DO $$ 
DECLARE 
    t_name TEXT;
    tables_to_fix TEXT[] := ARRAY[
        'academic_years', 'classes', 'subjects', 'students', 'enrollments', 
        'fee_plans', 'payments', 'expenses', 'staff', 'audit_logs'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_to_fix
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'isolation_' || t_name, t_name);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'isolation_' || t_name || '_v2', t_name);
        
        EXECUTE format('
            CREATE POLICY %I ON %I FOR ALL 
            USING (school_id = get_my_school_id() OR is_super_admin())
            WITH CHECK (school_id = get_my_school_id() OR is_super_admin())
        ', 'isolation_' || t_name || '_v2', t_name);
    END LOOP;
END $$;

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
