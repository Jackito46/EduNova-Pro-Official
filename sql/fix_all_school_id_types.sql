-- Comprehensive script to ensure ALL school_id columns are UUID
-- This fixes the "operator does not exist: text = uuid" error in RLS policies

DO $$ 
BEGIN
    -- 1. fee_plans
    BEGIN
        ALTER TABLE public.fee_plans ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'fee_plans: %', SQLERRM; END;

    -- 2. academic_years
    BEGIN
        ALTER TABLE public.academic_years ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'academic_years: %', SQLERRM; END;

    -- 3. classes
    BEGIN
        ALTER TABLE public.classes ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'classes: %', SQLERRM; END;

    -- 4. subjects
    BEGIN
        ALTER TABLE public.subjects ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'subjects: %', SQLERRM; END;

    -- 5. students
    BEGIN
        ALTER TABLE public.students ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'students: %', SQLERRM; END;

    -- 6. supply_catalog
    BEGIN
        ALTER TABLE public.supply_catalog ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'supply_catalog: %', SQLERRM; END;

    -- 7. expense_categories
    BEGIN
        ALTER TABLE public.expense_categories ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'expense_categories: %', SQLERRM; END;

    -- 8. expenses
    BEGIN
        ALTER TABLE public.expenses ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'expenses: %', SQLERRM; END;

    -- 9. payments
    BEGIN
        ALTER TABLE public.payments ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'payments: %', SQLERRM; END;

    -- 10. staff
    BEGIN
        ALTER TABLE public.staff ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'staff: %', SQLERRM; END;

    -- 11. school_supplies
    BEGIN
        ALTER TABLE public.school_supplies ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'school_supplies: %', SQLERRM; END;

    -- 12. enrollments
    BEGIN
        ALTER TABLE public.enrollments ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enrollments: %', SQLERRM; END;

    -- 13. class_schedules
    BEGIN
        ALTER TABLE public.class_schedules ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'class_schedules: %', SQLERRM; END;

    -- 14. disciplinary_records
    BEGIN
        ALTER TABLE public.disciplinary_records ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'disciplinary_records: %', SQLERRM; END;

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
