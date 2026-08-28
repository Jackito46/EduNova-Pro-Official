-- Script to forcefully align all school_id data and types
DO $$ 
DECLARE
    v_real_school_id UUID;
    v_col_type TEXT;
BEGIN
    -- 1. Find the actual school ID (we take the first one, assuming single-tenant or primary school)
    SELECT id INTO v_real_school_id FROM public.schools LIMIT 1;
    
    IF v_real_school_id IS NULL THEN
        RAISE NOTICE 'No school found in database!';
        RETURN;
    END IF;

    RAISE NOTICE 'Using real school_id: %', v_real_school_id;

    -- Helper function to fix a table
    -- We can't easily use dynamic SQL with exception handling for the whole block in a loop,
    -- so we do it table by table.

    -- 2. Fix fee_plans
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'fee_plans' AND column_name = 'school_id' AND table_schema = 'public';
    IF v_col_type = 'text' THEN
        UPDATE public.fee_plans SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        ALTER TABLE public.fee_plans ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        UPDATE public.fee_plans SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

    -- 3. Fix payments
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'school_id' AND table_schema = 'public';
    IF v_col_type = 'text' THEN
        UPDATE public.payments SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        ALTER TABLE public.payments ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        UPDATE public.payments SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

    -- 4. Fix enrollments
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'enrollments' AND column_name = 'school_id' AND table_schema = 'public';
    IF v_col_type = 'text' THEN
        UPDATE public.enrollments SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        ALTER TABLE public.enrollments ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        UPDATE public.enrollments SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

    -- 5. Fix students
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'school_id' AND table_schema = 'public';
    IF v_col_type = 'text' THEN
        UPDATE public.students SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        ALTER TABLE public.students ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        UPDATE public.students SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

    -- 6. Fix classes
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'school_id' AND table_schema = 'public';
    IF v_col_type = 'text' THEN
        UPDATE public.classes SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        ALTER TABLE public.classes ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        UPDATE public.classes SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

    -- 7. Fix academic_years
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_name = 'academic_years' AND column_name = 'school_id' AND table_schema = 'public';
    IF v_col_type = 'text' THEN
        UPDATE public.academic_years SET school_id = v_real_school_id::text WHERE school_id NOT LIKE '%-%-%-%-%';
        ALTER TABLE public.academic_years ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    ELSE
        UPDATE public.academic_years SET school_id = v_real_school_id WHERE school_id != v_real_school_id;
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error during data alignment: %', SQLERRM;
END $$;

-- Recreate RLS policies for fee_plans to ensure they use the correct type
DROP POLICY IF EXISTS "FP View" ON public.fee_plans;
DROP POLICY IF EXISTS "FP Manage" ON public.fee_plans;

CREATE POLICY "FP View" ON public.fee_plans FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "FP Manage" ON public.fee_plans FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);

-- Recreate RLS policies for payments
DROP POLICY IF EXISTS "Payments read" ON public.payments;
DROP POLICY IF EXISTS "Payments manage" ON public.payments;

CREATE POLICY "Payments read" ON public.payments FOR SELECT USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
CREATE POLICY "Payments manage" ON public.payments FOR ALL USING (
  school_id = public.get_my_school_id() OR public.is_super_admin()
);
