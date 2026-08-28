-- ===============================================================
-- ULTIMATE REPAIR: FIX RLS RECURSION AND SCHEMA ERRORS (V2 REPAIR)
-- ===============================================================

DO $$ 
DECLARE
    t TEXT;
BEGIN
    -- 1. PROFILES
    EXECUTE 'DROP POLICY IF EXISTS "profiles_standard_access" ON public.profiles';
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

    -- 2. SCHOOLS
    EXECUTE 'DROP POLICY IF EXISTS "schools_standard_access" ON public.schools';
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

    -- 3. APPLY ISOLATION TO ALL OTHER TABLES
    FOR t IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('schools', 'profiles', 'global_settings')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Standard Isolation" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "isolation_%I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Isolation %I" ON public.%I', t, t);
        
        -- Apply the most robust isolation
        EXECUTE format('CREATE POLICY "isolation_%I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR public.is_super_admin())', t, t);
    END LOOP;
END $$;
