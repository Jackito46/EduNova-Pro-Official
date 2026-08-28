
-- ==========================================================
-- RECONSTRUCTION TABLE STUDENTS - EduNova Pro v4.8
-- Résolution de l'erreur "column dob not found"
-- ==========================================================

-- 1. Nettoyage complet
DROP TABLE IF EXISTS public.students CASCADE;

-- 2. Création avec typage strict
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    
    -- Identité (dob est explicitement définie ici)
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Masculin', 'Féminin')),
    dob DATE NOT NULL, -- Date of Birth
    pob TEXT,          -- Place of Birth
    nif TEXT,
    address TEXT,
    
    -- Tutelle
    parent_name TEXT NOT NULL,
    parent_relation TEXT NOT NULL,
    parent_phone TEXT NOT NULL,
    parent_email TEXT,
    parent_job TEXT,
    
    -- Statut Académique
    status TEXT DEFAULT 'Actif' CHECK (status IN ('Actif', 'Inactif', 'Suspendu')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Activation de la sécurité
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 4. Politiques d'isolation par école
CREATE POLICY "Students school isolation" ON public.students
    FOR ALL USING (school_id = public.get_my_school_id());

-- 5. Index pour fluidité de recherche
CREATE INDEX idx_students_identity_search ON public.students (last_name, first_name);
CREATE INDEX idx_students_school_class ON public.students (school_id, class_id);

-- 6. Forcer PostgREST à recharger le schéma
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.students.dob IS 'Date de naissance de l''élève - Colonne critique pour validation bio-académique';
