-- =========================================================================
-- MODULE DE GESTION CENTRALISÉE DES DEVOIRS & CAHIER DE TEXTES (EDUNOVA PRO)
-- Version 2.0 Corrigée & Résiliente (Résout l'erreur 42P01 campuses)
-- Idempotent : Peut être exécuté plusieurs fois sans aucune erreur.
-- =========================================================================

-- 1. Table principale : Devoirs & Exercices prescrits (homework_assignments)
CREATE TABLE IF NOT EXISTS public.homework_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL,
    campus_id UUID DEFAULT NULL,
    academic_year_id UUID DEFAULT NULL,
    class_id UUID NOT NULL,
    subject_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    
    -- Contenu pédagogique & Consignes
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb, -- [{ name, url, type, size }]
    
    -- Calendrier & Charge de travail
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    due_time TIME DEFAULT '08:00:00',
    estimated_duration_minutes INT DEFAULT 30,
    
    -- Modalité de contrôle & notation
    submission_type VARCHAR(50) DEFAULT 'IN_CLASS' 
        CHECK (submission_type IN ('IN_CLASS', 'ONLINE_TEXT', 'ONLINE_FILE', 'NONE_READ_ONLY')),
    is_graded BOOLEAN DEFAULT false,
    max_score NUMERIC(5,2) DEFAULT NULL,
    
    -- Statut de publication
    status VARCHAR(20) DEFAULT 'PUBLISHED' 
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'CANCELLED')),
    
    -- Métadonnées de traçabilité
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_homework_school_class ON public.homework_assignments (school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_homework_teacher ON public.homework_assignments (teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_due_date ON public.homework_assignments (class_id, due_date);
CREATE INDEX IF NOT EXISTS idx_homework_subject ON public.homework_assignments (subject_id);


-- 2. Table de Traçabilité des Lectures & Accusés de Réception (homework_student_reads)
CREATE TABLE IF NOT EXISTS public.homework_student_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    school_id UUID NOT NULL,
    
    -- Traçabilité de consultation (Tracking)
    is_read BOOLEAN DEFAULT false,
    first_read_at TIMESTAMPTZ,
    last_read_at TIMESTAMPTZ,
    read_count INT DEFAULT 0,
    read_by_role VARCHAR(20) DEFAULT 'STUDENT' CHECK (read_by_role IN ('STUDENT', 'PARENT', 'BOTH')),
    
    -- Validation par l'élève ou le parent
    work_status VARCHAR(20) DEFAULT 'TODO' 
        CHECK (work_status IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'EXCUSED')),
    work_completed_at TIMESTAMPTZ,
    
    -- Accusé de signature parentale (Fin des contestations)
    parent_acknowledged BOOLEAN DEFAULT false,
    parent_acknowledged_at TIMESTAMPTZ,
    parent_notes TEXT,
    
    -- Pointage / Contrôle par le professeur en classe
    teacher_checked BOOLEAN DEFAULT false,
    teacher_check_status VARCHAR(20) DEFAULT NULL 
        CHECK (teacher_check_status IS NULL OR teacher_check_status IN ('FAIT', 'NON_FAIT', 'PARTIEL', 'EXCUSE')),
    teacher_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_homework_student_read UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_homework_reads_student ON public.homework_student_reads (student_id);
CREATE INDEX IF NOT EXISTS idx_homework_reads_assignment ON public.homework_student_reads (assignment_id);


-- 3. Table de Remise de Devoirs en Ligne (Optionnel si submission_type != IN_CLASS)
CREATE TABLE IF NOT EXISTS public.homework_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    school_id UUID NOT NULL,
    
    submission_text TEXT,
    submitted_files JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    
    status VARCHAR(20) DEFAULT 'SUBMITTED' 
        CHECK (status IN ('SUBMITTED', 'LATE', 'RESUBMITTED', 'GRADED')),
    grade NUMERIC(5,2) DEFAULT NULL,
    teacher_feedback TEXT,
    graded_at TIMESTAMPTZ,
    graded_by UUID DEFAULT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_homework_student_submission UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_assignment ON public.homework_submissions (assignment_id);


-- =========================================================================
-- CONTRAINTES ÉTRANGÈRES CONDITIONNELLES SÉCURISÉES (ANTI-ERREUR 42P01)
-- =========================================================================
DO $$
BEGIN
    -- Clé vers schools si existante
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schools') THEN
        BEGIN
            ALTER TABLE public.homework_assignments 
            DROP CONSTRAINT IF EXISTS fk_homework_school,
            ADD CONSTRAINT fk_homework_school FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- Clé vers classes si existante
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'classes') THEN
        BEGIN
            ALTER TABLE public.homework_assignments 
            DROP CONSTRAINT IF EXISTS fk_homework_class,
            ADD CONSTRAINT fk_homework_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- Clé vers subjects si existante
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subjects') THEN
        BEGIN
            ALTER TABLE public.homework_assignments 
            DROP CONSTRAINT IF EXISTS fk_homework_subject,
            ADD CONSTRAINT fk_homework_subject FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- Clé vers profiles (enseignant) si existante
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        BEGIN
            ALTER TABLE public.homework_assignments 
            DROP CONSTRAINT IF EXISTS fk_homework_teacher,
            ADD CONSTRAINT fk_homework_teacher FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- Clé vers students si existante
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') THEN
        BEGIN
            ALTER TABLE public.homework_student_reads 
            DROP CONSTRAINT IF EXISTS fk_homework_reads_student,
            ADD CONSTRAINT fk_homework_reads_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
            
            ALTER TABLE public.homework_submissions 
            DROP CONSTRAINT IF EXISTS fk_homework_submissions_student,
            ADD CONSTRAINT fk_homework_submissions_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- Clé vers school_campuses OU campuses si l'une ou l'autre existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_campuses') THEN
        BEGIN
            ALTER TABLE public.homework_assignments 
            DROP CONSTRAINT IF EXISTS fk_homework_campus,
            ADD CONSTRAINT fk_homework_campus FOREIGN KEY (campus_id) REFERENCES public.school_campuses(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campuses') THEN
        BEGIN
            ALTER TABLE public.homework_assignments 
            DROP CONSTRAINT IF EXISTS fk_homework_campus,
            ADD CONSTRAINT fk_homework_campus FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- Clé vers academic_years si existante
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_years') THEN
        BEGIN
            ALTER TABLE public.homework_assignments 
            DROP CONSTRAINT IF EXISTS fk_homework_academic_year,
            ADD CONSTRAINT fk_homework_academic_year FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;


-- =========================================================================
-- TRIGGERS POUR MISE À JOUR DU CHAMP updated_at
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_homework_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_homework_assignments_updated_at ON public.homework_assignments;
CREATE TRIGGER trg_homework_assignments_updated_at
    BEFORE UPDATE ON public.homework_assignments
    FOR EACH ROW EXECUTE FUNCTION public.set_homework_updated_at();

DROP TRIGGER IF EXISTS trg_homework_reads_updated_at ON public.homework_student_reads;
CREATE TRIGGER trg_homework_reads_updated_at
    BEFORE UPDATE ON public.homework_student_reads
    FOR EACH ROW EXECUTE FUNCTION public.set_homework_updated_at();

DROP TRIGGER IF EXISTS trg_homework_submissions_updated_at ON public.homework_submissions;
CREATE TRIGGER trg_homework_submissions_updated_at
    BEFORE UPDATE ON public.homework_submissions
    FOR EACH ROW EXECUTE FUNCTION public.set_homework_updated_at();


-- =========================================================================
-- FONCTIONS STOCKÉES RPC : TRAÇABILITÉ RAPIDE & STATISTIQUES
-- =========================================================================

-- RPC 1 : Enregistrer automatiquement la consultation par un élève ou parent
CREATE OR REPLACE FUNCTION public.mark_homework_read(
    p_assignment_id UUID,
    p_student_id UUID,
    p_reader_role VARCHAR DEFAULT 'STUDENT'
)
RETURNS JSONB AS $$
DECLARE
    v_school_id UUID;
    v_result RECORD;
BEGIN
    SELECT school_id INTO v_school_id 
    FROM public.homework_assignments 
    WHERE id = p_assignment_id;

    IF v_school_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Devoir introuvable');
    END IF;

    INSERT INTO public.homework_student_reads (
        assignment_id,
        student_id,
        school_id,
        is_read,
        first_read_at,
        last_read_at,
        read_count,
        read_by_role
    )
    VALUES (
        p_assignment_id,
        p_student_id,
        v_school_id,
        true,
        NOW(),
        NOW(),
        1,
        p_reader_role
    )
    ON CONFLICT (assignment_id, student_id) DO UPDATE SET
        is_read = true,
        last_read_at = NOW(),
        read_count = public.homework_student_reads.read_count + 1,
        read_by_role = CASE 
            WHEN public.homework_student_reads.read_by_role <> p_reader_role THEN 'BOTH'
            ELSE public.homework_student_reads.read_by_role
        END,
        updated_at = NOW()
    RETURNING * INTO v_result;

    RETURN jsonb_build_object(
        'success', true, 
        'read_count', v_result.read_count, 
        'first_read_at', v_result.first_read_at,
        'last_read_at', v_result.last_read_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 2 : Statistiques en temps réel d'un devoir (Taux de lecture & achèvement)
CREATE OR REPLACE FUNCTION public.get_homework_audience_stats(p_assignment_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_class_id UUID;
    v_total_students INT := 0;
    v_read_count INT := 0;
    v_completed_count INT := 0;
    v_parent_ack_count INT := 0;
BEGIN
    SELECT class_id INTO v_class_id 
    FROM public.homework_assignments 
    WHERE id = p_assignment_id;

    IF v_class_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Devoir introuvable');
    END IF;

    -- Compter les élèves de la classe
    BEGIN
        SELECT COUNT(DISTINCT id) INTO v_total_students
        FROM public.students
        WHERE class_id = v_class_id AND (status IS NULL OR status = 'Actif' OR status = 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN
        v_total_students := 0;
    END;

    -- Fallback si students vide ou table enrollments présente
    IF v_total_students = 0 THEN
        BEGIN
            SELECT COUNT(DISTINCT student_id) INTO v_total_students
            FROM public.enrollments
            WHERE class_id = v_class_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- Compter les consultations et achèvements
    SELECT 
        COUNT(CASE WHEN is_read = true THEN 1 END),
        COUNT(CASE WHEN work_status = 'COMPLETED' THEN 1 END),
        COUNT(CASE WHEN parent_acknowledged = true THEN 1 END)
    INTO v_read_count, v_completed_count, v_parent_ack_count
    FROM public.homework_student_reads
    WHERE assignment_id = p_assignment_id;

    RETURN jsonb_build_object(
        'total_students', v_total_students,
        'read_count', v_read_count,
        'read_percentage', CASE WHEN v_total_students > 0 THEN ROUND((v_read_count::NUMERIC / v_total_students::NUMERIC) * 100, 1) ELSE 0 END,
        'completed_count', v_completed_count,
        'completed_percentage', CASE WHEN v_total_students > 0 THEN ROUND((v_completed_count::NUMERIC / v_total_students::NUMERIC) * 100, 1) ELSE 0 END,
        'parent_acknowledged_count', v_parent_ack_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS) - IDEMPOTENTES
-- =========================================================================
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_student_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- Politiques pour homework_assignments
DROP POLICY IF EXISTS "homework_select_policy" ON public.homework_assignments;
CREATE POLICY "homework_select_policy" ON public.homework_assignments
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "homework_insert_policy" ON public.homework_assignments;
CREATE POLICY "homework_insert_policy" ON public.homework_assignments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "homework_update_policy" ON public.homework_assignments;
CREATE POLICY "homework_update_policy" ON public.homework_assignments
    FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "homework_delete_policy" ON public.homework_assignments;
CREATE POLICY "homework_delete_policy" ON public.homework_assignments
    FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Politiques pour homework_student_reads
DROP POLICY IF EXISTS "homework_reads_select_policy" ON public.homework_student_reads;
CREATE POLICY "homework_reads_select_policy" ON public.homework_student_reads
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "homework_reads_insert_policy" ON public.homework_student_reads;
CREATE POLICY "homework_reads_insert_policy" ON public.homework_student_reads
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "homework_reads_update_policy" ON public.homework_student_reads;
CREATE POLICY "homework_reads_update_policy" ON public.homework_student_reads
    FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "homework_reads_delete_policy" ON public.homework_student_reads;
CREATE POLICY "homework_reads_delete_policy" ON public.homework_student_reads
    FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Politiques pour homework_submissions
DROP POLICY IF EXISTS "homework_submissions_select_policy" ON public.homework_submissions;
CREATE POLICY "homework_submissions_select_policy" ON public.homework_submissions
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "homework_submissions_insert_policy" ON public.homework_submissions;
CREATE POLICY "homework_submissions_insert_policy" ON public.homework_submissions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "homework_submissions_update_policy" ON public.homework_submissions;
CREATE POLICY "homework_submissions_update_policy" ON public.homework_submissions
    FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Permissions accordées
GRANT ALL ON public.homework_assignments TO anon, authenticated, service_role;
GRANT ALL ON public.homework_student_reads TO anon, authenticated, service_role;
GRANT ALL ON public.homework_submissions TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_homework_read(UUID, UUID, VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_homework_audience_stats(UUID) TO anon, authenticated, service_role;
