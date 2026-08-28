
-- Add academic_year_id to student_attendances and course_signatures
-- This allows better data integrity and session-based filtering

-- 1. Update student_attendances
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_attendances' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.student_attendances ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Update course_signatures
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'course_signatures' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.course_signatures ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Update staff_assignments
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_assignments' AND column_name = 'academic_year_id') THEN
        ALTER TABLE public.staff_assignments ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_attendances_academic_year ON public.student_attendances(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_course_signatures_academic_year ON public.course_signatures(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_academic_year ON public.staff_assignments(academic_year_id);

-- 5. Attempt to backfill academic_year_id for student_attendances based on enrollments
-- This is a best-effort backfill
UPDATE public.student_attendances sa
SET academic_year_id = e.academic_year_id
FROM public.enrollments e
WHERE sa.student_id = e.student_id 
AND sa.academic_year_id IS NULL;

-- 6. Backfill for staff_assignments based on active year if null
DO $$
DECLARE
    v_active_year_id UUID;
BEGIN
    SELECT id INTO v_active_year_id FROM public.academic_years WHERE is_active = true LIMIT 1;
    IF v_active_year_id IS NOT NULL THEN
        UPDATE public.staff_assignments SET academic_year_id = v_active_year_id WHERE academic_year_id IS NULL;
        UPDATE public.course_signatures SET academic_year_id = v_active_year_id WHERE academic_year_id IS NULL;
    END IF;
END $$;
