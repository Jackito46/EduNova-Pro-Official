-- Fix enrollments school_id type and RLS policy
DO $$ 
BEGIN
    -- Alter school_id to UUID
    ALTER TABLE public.enrollments ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error altering enrollments school_id: %', SQLERRM;
END $$;

-- Drop and recreate RLS policy
DROP POLICY IF EXISTS "Enrollments isolation" ON public.enrollments;
CREATE POLICY "Enrollments isolation" ON public.enrollments
    FOR ALL USING (school_id = public.get_my_school_id());
