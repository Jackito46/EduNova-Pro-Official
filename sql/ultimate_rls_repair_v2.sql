-- ===============================================================
-- ULTIMATE REPAIR: FIX RLS RECURSION AND SCHEMA ERRORS
-- ===============================================================

-- 1. Ensure helper functions are SECURITY DEFINER and recursion-safe
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role TEXT;
    v_email TEXT;
BEGIN
    v_email := auth.jwt() ->> 'email';
    -- Hardcoded fallback
    IF v_email = 'jackito46@gmail.com' THEN RETURN TRUE; END IF;

    -- JWT checks (No recursion)
    v_role := auth.jwt() -> 'user_metadata' ->> 'role';
    IF v_role IN ('super_admin', 'SUPER_ADMIN') THEN RETURN TRUE; END IF;
    
    v_role := auth.jwt() -> 'app_metadata' ->> 'role';
    IF v_role IN ('super_admin', 'SUPER_ADMIN') THEN RETURN TRUE; END IF;

    -- DB Fallback (Safe because SECURITY DEFINER postgres bypasses RLS)
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'SUPER_ADMIN')
    );
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- JWT checks (No recursion)
    v_role := auth.jwt() -> 'user_metadata' ->> 'role';
    IF v_role IN ('super_admin', 'SUPER_ADMIN', 'school_admin', 'SCHOOL_ADMIN', 'director', 'DIRECTOR') THEN RETURN TRUE; END IF;

    -- DB Fallback
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR')
    );
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END; $$;

-- 2. RESET POLICIES FOR CRITICAL TABLES
DO $$ 
DECLARE
    t TEXT;
BEGIN
    -- profiles
    EXECUTE 'DROP POLICY IF EXISTS "Standard Isolation" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "profiles_isolation" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "profiles_school_select" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Profiles read school" ON public.profiles';
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
    
    CREATE POLICY "profiles_standard_access" ON public.profiles
    FOR ALL USING (
        public.is_super_admin() OR 
        id = auth.uid() OR 
        school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    );

    -- schools
    EXECUTE 'DROP POLICY IF EXISTS "Standard Isolation" ON public.schools';
    EXECUTE 'DROP POLICY IF EXISTS "Schools Isolation" ON public.schools';
    EXECUTE 'DROP POLICY IF EXISTS "Schools read own" ON public.schools';
    EXECUTE 'ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY';
    
    CREATE POLICY "schools_standard_access" ON public.schools
    FOR SELECT USING (
        public.is_super_admin() OR 
        id::text = (auth.jwt() -> 'user_metadata' ->> 'school_id') OR
        id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    );

    -- 3. APPLY ISOLATION TO ALL OTHER TABLES AUTOMATICALLY
    FOR t IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('schools', 'profiles', 'global_settings')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Standard Isolation" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "isolation_%I" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Isolation %I" ON public.%I', t);
        
        -- Apply the most robust isolation
        -- Use plain public.get_my_school_id() which is now optimized
        EXECUTE format('CREATE POLICY "isolation_%I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR public.is_super_admin())', t, t);
    END LOOP;
END $$;

-- 4. Fix view owner to postgres to ensure RLS-immune introspection
ALTER VIEW public.v_schools_with_counts OWNER TO postgres;

-- 5. Fix permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
-- But RLS will restrict them anyway
