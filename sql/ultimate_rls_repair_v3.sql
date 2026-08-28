-- ===============================================================
-- ULTIMATE REPAIR: FIX RLS RECURSION AND SCHEMA ERRORS (V3)
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
        school_id = (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid())
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
        id = (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid())
    );

    -- 3. APPLY ISOLATION TO ALL OTHER TABLES ONLY IF school_id EXISTS
    FOR t IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('schools', 'profiles', 'global_settings')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Standard Isolation" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "isolation_%I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Isolation %I" ON public.%I', t, t);
        
        -- Check if school_id column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'school_id') THEN
            EXECUTE format('CREATE POLICY "isolation_%I" ON public.%I FOR ALL USING (school_id = public.get_my_school_id() OR public.is_super_admin())', t, t);
        END IF;
    END LOOP;
END $$;
