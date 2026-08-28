DO $$ 
BEGIN
    -- Alter school_id to UUID for fee_plans
    ALTER TABLE public.fee_plans ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error altering fee_plans school_id: %', SQLERRM;
END $$;

DO $$ 
BEGIN
    -- Alter school_id to UUID for academic_years
    ALTER TABLE public.academic_years ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error altering academic_years school_id: %', SQLERRM;
END $$;
