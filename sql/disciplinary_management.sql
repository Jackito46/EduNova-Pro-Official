
-- Disciplinary Management Module
-- EduNova Pro v4.0

CREATE TABLE IF NOT EXISTS public.disciplinary_records (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('CONDUITE', 'RETARD', 'ABSENCE_NON_JUSTIFIEE', 'TRAVAIL_NON_FAIT', 'AUTRE')),
    description TEXT NOT NULL,
    sanction_type TEXT NOT NULL DEFAULT 'AUCUNE' CHECK (sanction_type IN ('AVERTISSEMENT', 'BLAME', 'RETENUE', 'EXCLUSION_TEMPORAIRE', 'EXCLUSION_DEFINITIVE', 'AUCUNE')),
    sanction_duration INTEGER DEFAULT 0, -- Duration in days if applicable
    status TEXT NOT NULL DEFAULT 'SIGNALÉ' CHECK (status IN ('SIGNALÉ', 'EN_COURS', 'CLOS', 'ANNULÉ')),
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_disciplinary_school_id ON public.disciplinary_records(school_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_student_id ON public.disciplinary_records(student_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_academic_year ON public.disciplinary_records(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_date ON public.disciplinary_records(incident_date);

-- RLS
ALTER TABLE public.disciplinary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Disciplinary view policy" ON public.disciplinary_records;
CREATE POLICY "Disciplinary view policy" ON public.disciplinary_records
    FOR SELECT USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Disciplinary insert policy" ON public.disciplinary_records;
CREATE POLICY "Disciplinary insert policy" ON public.disciplinary_records
    FOR INSERT WITH CHECK (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Disciplinary update policy" ON public.disciplinary_records;
CREATE POLICY "Disciplinary update policy" ON public.disciplinary_records
    FOR UPDATE USING (school_id = public.get_my_school_id());

DROP POLICY IF EXISTS "Disciplinary delete policy" ON public.disciplinary_records;
CREATE POLICY "Disciplinary delete policy" ON public.disciplinary_records
    FOR DELETE USING (public.is_admin() AND school_id = public.get_my_school_id());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_disciplinary_updated_at ON public.disciplinary_records;
CREATE TRIGGER tr_disciplinary_updated_at
    BEFORE UPDATE ON public.disciplinary_records
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.disciplinary_records IS 'Table de suivi disciplinaire des élèves.';
