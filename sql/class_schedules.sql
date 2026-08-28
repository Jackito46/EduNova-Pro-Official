-- ==========================================================
-- SCRIPT DE CRÉATION DE L'EMPLOI DU TEMPS (TIMETABLE)
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.class_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Lundi, 7=Dimanche
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Enable RLS
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Class schedules view policy" ON public.class_schedules;
CREATE POLICY "Class schedules view policy" 
ON public.class_schedules FOR SELECT 
USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Class schedules insert policy" ON public.class_schedules;
CREATE POLICY "Class schedules insert policy" 
ON public.class_schedules FOR INSERT 
WITH CHECK (
  public.is_admin() AND school_id = public.get_my_school_id()
);

DROP POLICY IF EXISTS "Class schedules update policy" ON public.class_schedules;
CREATE POLICY "Class schedules update policy" 
ON public.class_schedules FOR UPDATE 
USING (
  public.is_admin() AND school_id = public.get_my_school_id()
);

DROP POLICY IF EXISTS "Class schedules delete policy" ON public.class_schedules;
CREATE POLICY "Class schedules delete policy" 
ON public.class_schedules FOR DELETE 
USING (
  public.is_admin() AND school_id = public.get_my_school_id()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_schedules_class_id ON public.class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_staff_id ON public.class_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_school_id ON public.class_schedules(school_id);
