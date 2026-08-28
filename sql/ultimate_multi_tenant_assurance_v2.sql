
-- ==========================================================
-- ULTIMATE MULTI-TENANT ASSURANCE & TYPE UNIFICATION
-- EduNova Pro - 2026 Audit
-- ==========================================================

DO $$ 
DECLARE
    v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
    r RECORD;
BEGIN
    -- 1. Ensure get_my_school_id() is robust
    CREATE OR REPLACE FUNCTION public.get_my_school_id()
    RETURNS UUID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      RETURN (
        SELECT school_id 
        FROM public.profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      );
    END;
    $func$;

    -- 2. Add school_id to tables that missed it
    
    -- payroll_slips
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_slips' AND column_name = 'school_id') THEN
        ALTER TABLE public.payroll_slips ADD COLUMN school_id UUID;
        UPDATE public.payroll_slips ps
        SET school_id = pp.school_id
        FROM public.payroll_periods pp
        WHERE ps.period_id = pp.id;
        ALTER TABLE public.payroll_slips ALTER COLUMN school_id SET NOT NULL;
        ALTER TABLE public.payroll_slips ADD CONSTRAINT payroll_slips_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;

    -- supply_payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supply_payments' AND column_name = 'school_id') THEN
        ALTER TABLE public.supply_payments ADD COLUMN school_id UUID;
        UPDATE public.supply_payments sp
        SET school_id = (ss.school_id)::uuid
        FROM public.school_supplies ss
        WHERE sp.supply_id = ss.id;
        -- ALTER TABLE public.supply_payments ALTER COLUMN school_id SET NOT NULL; -- Might have some nulls if migration fails, check first
        ALTER TABLE public.supply_payments ADD CONSTRAINT supply_payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;

    -- 3. UNIFY school_id TYPES TO UUID and ensure they are NOT NULL where possible
    FOR r IN 
        SELECT table_name, column_name, data_type
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'school_id'
          AND table_name != 'schools'
    LOOP
        -- Convert to UUID if it is text
        IF r.data_type IN ('text', 'character varying', 'varchar') THEN
            EXECUTE format('
                ALTER TABLE public.%I 
                ALTER COLUMN %I TYPE UUID 
                USING CASE 
                    WHEN %I ~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' THEN %I::UUID 
                    ELSE %L::UUID 
                END
            ', r.table_name, r.column_name, r.column_name, r.column_name, v_main_school_id);
        END IF;

        -- Set NOT NULL if it's currently nullable (except for profiles where it might be null for superadmin)
        IF r.table_name NOT IN ('profiles', 'audit_logs') THEN
            -- Check for null values first and fill them
            EXECUTE format('UPDATE public.%I SET %I = %L WHERE %I IS NULL', r.table_name, r.column_name, v_main_school_id, r.column_name);
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL', r.table_name, r.column_name);
        END IF;
    END LOOP;

END $$;

-- 4. STANDARDIZE RLS POLICIES
CREATE OR REPLACE FUNCTION public.apply_universal_rls(p_table_name TEXT, p_is_admin_only BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table_name);
    
    -- Drop common legacy policy names
    EXECUTE format('DROP POLICY IF EXISTS "Isolation %I" ON public.%I', p_table_name, p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Standard Isolation" ON public.%I', p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Allow individual read" ON public.%I', p_table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Allow individual update" ON public.%I', p_table_name);
    
    -- Audit specific names
    IF p_table_name = 'audit_logs' THEN
        EXECUTE 'DROP POLICY IF EXISTS "Audit logs isolation" ON public.audit_logs';
        EXECUTE 'DROP POLICY IF EXISTS "Audit logs insert" ON public.audit_logs';
    END IF;

    -- Create new comprehensive policy
    IF p_is_admin_only THEN
        EXECUTE format('
            CREATE POLICY "Standard Isolation" ON public.%I
            FOR ALL
            USING (
                (school_id = public.get_my_school_id() AND public.is_admin())
                OR public.is_super_admin()
            )
        ', p_table_name);
    ELSE
        EXECUTE format('
            CREATE POLICY "Standard Isolation" ON public.%I
            FOR ALL
            USING (
                school_id = public.get_my_school_id()
                OR public.is_super_admin()
            )
            WITH CHECK (
                school_id = public.get_my_school_id()
                OR public.is_super_admin()
            )
        ', p_table_name);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DO $$ BEGIN
    -- Apply to ALL tenant-aware tables
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_years') THEN PERFORM public.apply_universal_rls('academic_years'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN PERFORM public.apply_universal_rls('classes'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subjects') THEN PERFORM public.apply_universal_rls('subjects'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'students') THEN PERFORM public.apply_universal_rls('students'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fee_plans') THEN PERFORM public.apply_universal_rls('fee_plans'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expense_categories') THEN PERFORM public.apply_universal_rls('expense_categories'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses') THEN PERFORM public.apply_universal_rls('expenses'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN PERFORM public.apply_universal_rls('payments'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff') THEN PERFORM public.apply_universal_rls('staff'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'enrollments') THEN PERFORM public.apply_universal_rls('enrollments'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_assignments') THEN PERFORM public.apply_universal_rls('staff_assignments'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_attendances') THEN PERFORM public.apply_universal_rls('staff_attendances'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payroll_periods') THEN PERFORM public.apply_universal_rls('payroll_periods'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payroll_slips') THEN PERFORM public.apply_universal_rls('payroll_slips'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'salary_advances') THEN PERFORM public.apply_universal_rls('salary_advances'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'school_supplies') THEN PERFORM public.apply_universal_rls('school_supplies'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supply_payments') THEN PERFORM public.apply_universal_rls('supply_payments'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disciplinary_records') THEN PERFORM public.apply_universal_rls('disciplinary_records'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'course_signatures') THEN PERFORM public.apply_universal_rls('course_signatures'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_salary_history') THEN PERFORM public.apply_universal_rls('staff_salary_history'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'communication_logs') THEN PERFORM public.apply_universal_rls('communication_logs'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'communication_settings') THEN PERFORM public.apply_universal_rls('communication_settings'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_attendances') THEN PERFORM public.apply_universal_rls('student_attendances'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'class_schedules') THEN PERFORM public.apply_universal_rls('class_schedules'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exchange_rates') THEN PERFORM public.apply_universal_rls('exchange_rates'); END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN PERFORM public.apply_universal_rls('audit_logs', TRUE); END IF;

    -- Special case for profiles (allow self-view and self-edit)
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Standard Isolation" ON public.profiles;
    CREATE POLICY "Standard Isolation" ON public.profiles
    FOR ALL
    USING (
        public.is_super_admin() 
        OR id = auth.uid() 
        OR school_id = public.get_my_school_id()
    )
    WITH CHECK (
        public.is_super_admin() 
        OR id = auth.uid()
    );

    -- Special case for schools
    ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Standard Isolation" ON public.schools;
    CREATE POLICY "Standard Isolation" ON public.schools
    FOR SELECT
    USING (
        public.is_super_admin() 
        OR id = public.get_my_school_id()
    );

    -- Clean up
    DROP FUNCTION IF EXISTS public.apply_universal_rls(TEXT, BOOLEAN);

END $$;

NOTIFY pgrst, 'reload schema';
