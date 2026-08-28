-- ==========================================================
-- FIX: ADD MISSING school_id COLUMNS FOR MULTI-TENANCY
-- ==========================================================

DO $$ 
BEGIN
    -- 1. student_attendances
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_attendances' AND column_name = 'school_id') THEN
        ALTER TABLE public.student_attendances ADD COLUMN school_id UUID;
        
        -- Populate school_id from students table
        UPDATE public.student_attendances sa
        SET school_id = s.school_id::uuid
        FROM public.students s
        WHERE sa.student_id = s.id;
        
        -- Fallback for those not in students (if any)
        UPDATE public.student_attendances SET school_id = public.get_my_school_id() WHERE school_id IS NULL;
        
        ALTER TABLE public.student_attendances ALTER COLUMN school_id SET NOT NULL;
    END IF;

END $$;

NOTIFY pgrst, 'reload schema';
