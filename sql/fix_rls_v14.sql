-- COMPREHENSIVE FIX FOR UUID VS TEXT AND RLS ERRORS
-- Version: 14.0
-- Target: Resolve 'operator does not exist: uuid = text'

DO $$ 
BEGIN
    -- 1. Create helper to check if column exists
    CREATE OR REPLACE FUNCTION public.check_col_exists(t_name text, c_name text) RETURNS boolean AS $f$
    BEGIN
        RETURN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t_name AND column_name = c_name);
    END; $f$ LANGUAGE plpgsql;

    -- 2. Drop dependent views to avoid "cannot alter type" errors
    DROP VIEW IF EXISTS v_schools_with_counts CASCADE;
    DROP VIEW IF EXISTS v_active_fee_plans CASCADE;

    -- 3. Unified get_my_school_id_safe (Returns TEXT for safety)
    CREATE OR REPLACE FUNCTION public.get_my_school_id_safe()
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
    DECLARE 
        v_id text;
        v_profile_school_id uuid;
    BEGIN
        -- Try JWT metadata first
        v_id := auth.jwt() -> 'user_metadata' ->> 'school_id';
        
        IF v_id IS NOT NULL AND v_id != '' THEN
            RETURN v_id;
        END IF;

        -- Fallback to profiles table
        SELECT school_id INTO v_profile_school_id
        FROM public.profiles
        WHERE id = auth.uid();

        RETURN v_profile_school_id::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END; $f$;

    -- 4. Unified is_super_admin
    CREATE OR REPLACE FUNCTION public.is_super_admin()
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
    BEGIN
        -- 1. Check email fallback (Jackito)
        IF (auth.jwt() ->> 'email') = 'jackito46@gmail.com' THEN
            RETURN TRUE;
        END IF;

        -- 2. Check JWT metadata
        IF (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin' THEN
            RETURN TRUE;
        END IF;

        -- 3. Check profiles table
        RETURN EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END; $f$;

    -- 5. Force column types to UUID where possible (with safe casting)
    -- We use a loop for multiple tables
    DECLARE
        t record;
    BEGIN
        FOR t IN (
            SELECT table_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND column_name = 'school_id' 
            AND data_type = 'text'
        ) LOOP
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id TYPE uuid USING (CASE WHEN school_id = '''' THEN NULL ELSE school_id::uuid END)', t.table_name);
        END LOOP;
    END;

    -- 6. Recreate views with explicit casting
    CREATE OR REPLACE VIEW v_schools_with_counts AS
    SELECT 
        s.*,
        (SELECT count(*) FROM public.students st WHERE st.school_id::text = s.id::text) as student_count,
        (SELECT count(*) FROM public.profiles p WHERE p.school_id::text = s.id::text AND p.role::text NOT IN ('STUDENT', 'PARENT')) as staff_count
    FROM public.schools s;

    -- 7. Reset ALL RLS Policies to use "Systematic Casting"
    -- This avoids the "operator does not exist: uuid = text" error
    
    -- Special case for 'profiles'
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        DROP POLICY IF EXISTS "Standard Isolation" ON public.profiles;
        DROP POLICY IF EXISTS "Profiles Isolation" ON public.profiles;
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Profiles Isolation" ON public.profiles
        FOR ALL
        USING (public.is_super_admin() OR id = auth.uid() OR school_id::text = public.get_my_school_id_safe())
        WITH CHECK (public.is_super_admin() OR id = auth.uid());
    END IF;

    -- Standard isolation for other tables
    DECLARE
        target_tables text[] := ARRAY[
            'academic_years', 'classes', 'subjects', 'students', 
            'enrollments', 'fee_plans', 'payments', 'supply_catalog', 
            'expenses', 'staff_assignments', 'global_settings', 
            'communication_settings', 'staff_attendances', 'staff_roles',
            'disciplinary_records', 'course_signatures', 'payment_gateways',
            'exchange_rates', 'payroll_slips', 'payroll_periods', 'salary_advances',
            'communication_logs', 'school_supplies', 'subscription_reminders',
            'class_schedules', 'subscription_history', 'audit_logs', 'resource_locks'
        ];
        tbl text;
    BEGIN
        FOREACH tbl IN ARRAY target_tables
        LOOP
            IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
                EXECUTE format('DROP POLICY IF EXISTS "Standard Isolation" ON public.%I', tbl);
                EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', tbl);
                EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
                
                -- Check if table has school_id column
                IF public.check_col_exists(tbl, 'school_id') THEN
                    EXECUTE format('
                        CREATE POLICY "Standard Isolation" ON public.%I
                        FOR ALL
                        USING (public.is_super_admin() OR school_id::text = public.get_my_school_id_safe())
                        WITH CHECK (public.is_super_admin() OR school_id::text = public.get_my_school_id_safe())
                    ', tbl);
                END IF;
            END IF;
        END LOOP;
    END;

    -- Special case for 'schools' table (uses 'id' instead of 'school_id')
    DROP POLICY IF EXISTS "Schools Isolation" ON public.schools;
    DROP POLICY IF EXISTS "Standard Isolation" ON public.schools;
    ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Schools Isolation" ON public.schools
    FOR ALL
    USING (public.is_super_admin() OR id::text = public.get_my_school_id_safe())
    WITH CHECK (public.is_super_admin()); -- Only super admin can modify school metadata generally

    -- Allow super admins to see all schools
    -- Allow admins to see their own school

END $$;

NOTIFY pgrst, 'reload schema';
