
-- ==========================================================
-- MISE À JOUR TABLE STUDENTS - DOSSIER COMPLET
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL,
    class_id UUID REFERENCES public.classes(id),
    
    -- Identité
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Masculin', 'Féminin')),
    dob DATE NOT NULL,
    pob TEXT, -- Place of birth
    nif TEXT,
    address TEXT,
    
    -- Tutelle
    parent_name TEXT,
    parent_relation TEXT,
    parent_phone TEXT,
    parent_email TEXT,
    parent_job TEXT,
    
    -- Statut
    status TEXT DEFAULT 'Actif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Politique de gestion (Admins de l'école)
DROP POLICY IF EXISTS "Manage school students" ON public.students;
CREATE POLICY "Manage school students" ON public.students
    FOR ALL USING (school_id = public.get_my_school_id());

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_identity ON public.students(last_name, first_name);
