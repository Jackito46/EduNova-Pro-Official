
-- ==========================================================
-- ARCHITECTURE ACADÉMIQUE - EduNova Pro
-- FIX : DÉPENDANCES DE POLITIQUES + STRUCTURE DES CLASSES
-- ==========================================================

-- 1. SUPPRESSION DES POLITIQUES BLOQUANTES (Pour permettre l'ALTER TYPE)
-- On nettoie tout ce qui pourrait utiliser school_id dans une condition
DROP POLICY IF EXISTS "Subjects read" ON public.subjects;
DROP POLICY IF EXISTS "Subjects manage" ON public.subjects;
DROP POLICY IF EXISTS "Classes read" ON public.classes;
DROP POLICY IF EXISTS "Classes manage" ON public.classes;
DROP POLICY IF EXISTS "Staff roles read" ON public.staff_roles;

-- 2. RÉPARATION DES TYPES (UUID -> TEXT)
DO $$ 
BEGIN
    -- Table Subjects
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'school_id') THEN
        ALTER TABLE public.subjects ALTER COLUMN school_id TYPE TEXT;
    END IF;
    -- Table Classes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'school_id') THEN
        ALTER TABLE public.classes ALTER COLUMN school_id TYPE TEXT;
    END IF;
    -- Table Staff Roles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_roles' AND column_name = 'school_id') THEN
        ALTER TABLE public.staff_roles ALTER COLUMN school_id TYPE TEXT;
    END IF;
END $$;

-- 3. CRÉATION / MISE À JOUR DES TABLES
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT DEFAULT 'school-2025-premium',
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    school_id TEXT DEFAULT 'school-2025-premium',
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    teacher_name TEXT,
    room TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SÉCURISATION DES CONTRAINTES D'UNICITÉ
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subjects_school_code_unique') THEN
        ALTER TABLE public.subjects ADD CONSTRAINT subjects_school_code_unique UNIQUE (school_id, code);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_school_name_unique') THEN
        ALTER TABLE public.classes ADD CONSTRAINT classes_school_name_unique UNIQUE (school_id, name);
    END IF;
END $$;

-- 5. INJECTION DE LA LISTE DES CLASSES (16 CLASSES)
-- Note : school-2025-premium est l'ID utilisé par défaut dans votre application

-- MATERNELLE
INSERT INTO public.classes (school_id, name, level) VALUES 
('school-2025-premium', 'Petite Section', 'MATERNELLE'),
('school-2025-premium', 'Moyenne Section', 'MATERNELLE'),
('school-2025-premium', 'Grande Section', 'MATERNELLE')
ON CONFLICT (school_id, name) DO NOTHING;

-- FONDAMENTALE
INSERT INTO public.classes (school_id, name, level) VALUES 
('school-2025-premium', '1ère AF', 'FONDAMENTALE'),
('school-2025-premium', '2ème AF', 'FONDAMENTALE'),
('school-2025-premium', '3ème AF', 'FONDAMENTALE'),
('school-2025-premium', '4ème AF', 'FONDAMENTALE'),
('school-2025-premium', '5ème AF', 'FONDAMENTALE'),
('school-2025-premium', '6ème AF', 'FONDAMENTALE'),
('school-2025-premium', '7ème AF', 'FONDAMENTALE'),
('school-2025-premium', '8ème AF', 'FONDAMENTALE'),
('school-2025-premium', '9ème AF', 'FONDAMENTALE')
ON CONFLICT (school_id, name) DO NOTHING;

-- SECONDAIRE
INSERT INTO public.classes (school_id, name, level) VALUES 
('school-2025-premium', 'NS I', 'SECONDAIRE'),
('school-2025-premium', 'NS II', 'SECONDAIRE'),
('school-2025-premium', 'NS III', 'SECONDAIRE'),
('school-2025-premium', 'NS IV', 'SECONDAIRE')
ON CONFLICT (school_id, name) DO NOTHING;

-- 6. MATIÈRES DE BASE (Optionnel)
INSERT INTO public.subjects (school_id, name, code) VALUES 
('school-2025-premium', 'Mathématiques', 'MATH'),
('school-2025-premium', 'Français', 'FRAN'),
('school-2025-premium', 'Créole', 'CREO'),
('school-2025-premium', 'Anglais', 'ANGL'),
('school-2025-premium', 'Informatique', 'INFO')
ON CONFLICT (school_id, code) DO NOTHING;

-- 7. RÉINSTALLATION DES POLITIQUES DE SÉCURITÉ (RLS)
-- On utilise ici des politiques simplifiées qui vérifient le school_id de l'utilisateur

CREATE POLICY "Subjects read" ON public.subjects 
    FOR SELECT USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Subjects manage" ON public.subjects 
    FOR ALL USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Classes read" ON public.classes 
    FOR SELECT USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Classes manage" ON public.classes 
    FOR ALL USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- Activation globale
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
