-- CLEAN UP ALL REDUNDANT POLICIES AND FUNCTIONS
DO $$ 
DECLARE
    tbl_name text;
    pol_name text;
BEGIN
    -- 1. Drop all policies that are not "Standard Isolation" or "Schools Isolation"
    FOR tbl_name, pol_name IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND policyname NOT IN ('Standard Isolation', 'Schools Isolation', 'Maintenance Mode Access', 'Allow public read')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, tbl_name);
    END LOOP;

    -- 2. Drop specific problematic functions
    DROP FUNCTION IF EXISTS public.get_my_school_id_text() CASCADE;
    DROP FUNCTION IF EXISTS public.get_my_school_id_safe_text() CASCADE;

    -- 3. Re-ensure our standard policies are correct and exclusive
    -- (We already ran v14, but let's make sure no others are left)
    
END $$;
