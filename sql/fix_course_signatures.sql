
-- 1. FIX STAFF_ASSIGNMENTS
-- Add school_id to staff_assignments if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_assignments' AND column_name='school_id') THEN
        ALTER TABLE public.staff_assignments ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update existing assignments to have school_id from staff table
UPDATE public.staff_assignments sa
SET school_id = s.school_id
FROM public.staff s
WHERE sa.staff_id = s.id AND sa.school_id IS NULL;

-- Make school_id NOT NULL if we want to enforce it
-- ALTER TABLE public.staff_assignments ALTER COLUMN school_id SET NOT NULL;

-- Update policies for staff_assignments
DROP POLICY IF EXISTS "Assignments view policy" ON public.staff_assignments;
CREATE POLICY "Assignments view policy" ON public.staff_assignments
    FOR SELECT USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Assignments manage policy" ON public.staff_assignments;
CREATE POLICY "Assignments manage policy" ON public.staff_assignments
    FOR ALL USING (public.is_admin() AND school_id = public.get_my_school_id());


-- 2. CREATE COURSE_SIGNATURES
CREATE TABLE IF NOT EXISTS public.course_signatures (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    class_name TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    subject_name TEXT,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours NUMERIC,
    topic_covered TEXT NOT NULL,
    present_students_count INTEGER DEFAULT 0,
    signature_status TEXT NOT NULL CHECK (signature_status IN ('SIGNED', 'VALIDATED', 'REJECTED')),
    recorded_by UUID REFERENCES auth.users(id),
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist and class_id is nullable if table already existed
DO $$ 
BEGIN
    ALTER TABLE public.course_signatures ALTER COLUMN class_id DROP NOT NULL;
    ALTER TABLE public.course_signatures ADD COLUMN IF NOT EXISTS class_name TEXT;
    ALTER TABLE public.course_signatures ADD COLUMN IF NOT EXISTS subject_name TEXT;
    ALTER TABLE public.course_signatures ADD COLUMN IF NOT EXISTS duration_hours NUMERIC;
    ALTER TABLE public.course_signatures ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Indexation
CREATE INDEX IF NOT EXISTS idx_signatures_school_id ON public.course_signatures(school_id);
CREATE INDEX IF NOT EXISTS idx_signatures_staff_id ON public.course_signatures(staff_id);
CREATE INDEX IF NOT EXISTS idx_signatures_date ON public.course_signatures(date);

-- RLS
ALTER TABLE public.course_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signatures view policy" ON public.course_signatures;
CREATE POLICY "Signatures view policy" ON public.course_signatures
    FOR SELECT USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Signatures insert policy" ON public.course_signatures;
CREATE POLICY "Signatures insert policy" ON public.course_signatures
    FOR INSERT WITH CHECK (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Signatures update policy" ON public.course_signatures;
CREATE POLICY "Signatures update policy" ON public.course_signatures
    FOR UPDATE USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Signatures delete policy" ON public.course_signatures;
CREATE POLICY "Signatures delete policy" ON public.course_signatures
    FOR DELETE USING (public.is_admin() AND school_id = public.get_my_school_id());
