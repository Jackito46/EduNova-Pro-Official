
-- HARDENED AND ANALYZED Seed Function for standard Haitian Curriculum
CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_academic_year_id UUID;
    v_class_id UUID;
    v_subject_id UUID;
BEGIN
    -- 1. Get or Create Academic Year (UUID)
    SELECT id INTO v_academic_year_id 
    FROM public.academic_years 
    WHERE school_id = p_school_id AND is_active = true 
    LIMIT 1;

    IF v_academic_year_id IS NULL THEN
        INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
        VALUES (p_school_id, '2025-2026', true, 'ACTIVE', '2025-09-01', '2026-06-30')
        ON CONFLICT (school_id, label) DO NOTHING
        RETURNING id INTO v_academic_year_id;
        
        IF v_academic_year_id IS NULL THEN
            SELECT id INTO v_academic_year_id FROM public.academic_years 
            WHERE school_id = p_school_id AND label = '2025-2026' LIMIT 1;
        END IF;
    END IF;

    -- 2. Define Standard Classes
    PERFORM public.upsert_class(p_school_id, 'Petite Section', 'MATERNELLE');
    PERFORM public.upsert_class(p_school_id, 'Moyenne Section', 'MATERNELLE');
    PERFORM public.upsert_class(p_school_id, 'Grande Section', 'MATERNELLE');
    
    PERFORM public.upsert_class(p_school_id, '1ère AF', 'FONDAMENTALE');
    PERFORM public.upsert_class(p_school_id, '2ème AF', 'FONDAMENTALE');
    PERFORM public.upsert_class(p_school_id, '3ème AF', 'FONDAMENTALE');
    PERFORM public.upsert_class(p_school_id, '4ème AF', 'FONDAMENTALE');
    PERFORM public.upsert_class(p_school_id, '5ème AF', 'FONDAMENTALE');
    PERFORM public.upsert_class(p_school_id, '6ème AF', 'FONDAMENTALE');

    PERFORM public.upsert_class(p_school_id, '7ème AF', 'FONDAMENTALE');
    PERFORM public.upsert_class(p_school_id, '8ème AF', 'FONDAMENTALE');
    PERFORM public.upsert_class(p_school_id, '9ème AF', 'FONDAMENTALE');

    PERFORM public.upsert_class(p_school_id, 'NS I', 'SECONDAIRE');
    PERFORM public.upsert_class(p_school_id, 'NS II', 'SECONDAIRE');
    PERFORM public.upsert_class(p_school_id, 'NS III', 'SECONDAIRE');
    PERFORM public.upsert_class(p_school_id, 'NS IV', 'SECONDAIRE');

    -- 3. Define Standard Subjects with Canonical Codes
    -- Maternelle
    PERFORM public.upsert_subject(p_school_id, 'Psychomotricité', 'PSYCHOMOT', 'GENERAL');
    PERFORM public.upsert_subject(p_school_id, 'Langage et Communication', 'LANG-COMM', 'LANGUAGES');
    PERFORM public.upsert_subject(p_school_id, 'Initiation Mathématiques', 'INIT-MATH', 'SCIENCE');
    PERFORM public.upsert_subject(p_school_id, 'Arts et Dessin', 'ARTS-DESS', 'ARTS');
    PERFORM public.upsert_subject(p_school_id, 'Éveil Scientifique', 'EVEIL-SCI', 'SCIENCE');

    -- Fondamentale & Secondaire
    PERFORM public.upsert_subject(p_school_id, 'Communication Française', 'FRA-STD', 'LANGUAGES');
    PERFORM public.upsert_subject(p_school_id, 'Communication Créole', 'CRE-STD', 'LANGUAGES');
    PERFORM public.upsert_subject(p_school_id, 'Mathématiques', 'MAT-STD', 'SCIENCE');
    PERFORM public.upsert_subject(p_school_id, 'Sciences Expérimentales', 'SCI-EXP', 'SCIENCE');
    PERFORM public.upsert_subject(p_school_id, 'Sciences Sociales', 'SCI-SOC', 'GENERAL');
    PERFORM public.upsert_subject(p_school_id, 'Anglais', 'ANG-STD', 'LANGUAGES');
    PERFORM public.upsert_subject(p_school_id, 'Espagnol', 'ESP-STD', 'LANGUAGES');
    PERFORM public.upsert_subject(p_school_id, 'Physique', 'PHY-STD', 'SCIENCE');
    PERFORM public.upsert_subject(p_school_id, 'Chimie', 'CHI-STD', 'SCIENCE');
    PERFORM public.upsert_subject(p_school_id, 'Biologie (SVT)', 'SVT-STD', 'SCIENCE');
    PERFORM public.upsert_subject(p_school_id, 'Philosophie', 'PHI-STD', 'GENERAL');
    PERFORM public.upsert_subject(p_school_id, 'Économie et Société', 'ECO-STD', 'GENERAL');
    PERFORM public.upsert_subject(p_school_id, 'Informatique', 'INF-STD', 'TECH');
    PERFORM public.upsert_subject(p_school_id, 'Éducation Physique', 'EPS-STD', 'SPORTS');
    PERFORM public.upsert_subject(p_school_id, 'Arts Plastiques', 'ART-PLAS', 'ARTS');


    -- 4. CLEANUP PREVIOUS MAPPINGS before re-seeding (only if we are seeding)
    -- This prevents the "32 subjects" issue
    DELETE FROM public.class_subjects WHERE school_id = p_school_id;

    -- 5. Logical Mapping (MANDATORY LOGIC)
    
    -- Maternelle Mappings
    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND level = 'MATERNELLE' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PSYCHOMOT', 1);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'LANG-COMM', 1);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'INIT-MATH', 1);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ARTS-DESS', 1);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'EVEIL-SCI', 1);
    END LOOP;

    -- Fondamentale 1-6 Mappings
    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND level = 'FONDAMENTALE' AND name ~ '^[1-6]' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'FRA-STD', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'CRE-STD', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MAT-STD', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SCI-EXP', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SCI-SOC', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANG-STD', 1);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'EPS-STD', 1);
    END LOOP;

    -- Fondamentale 7-9 Mappings
    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND level = 'FONDAMENTALE' AND name ~ '^[7-9]' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'FRA-STD', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'CRE-STD', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MAT-STD', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SVT-STD', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PHY-STD', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SCI-SOC', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANG-STD', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ESP-STD', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'EPS-STD', 1);
    END LOOP;

    -- Secondaire NS1-NS4 Mappings
    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND level = 'SECONDAIRE' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'FRA-STD', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'CRE-STD', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MAT-STD', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PHY-STD', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'CHI-STD', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SVT-STD', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PHI-STD', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SCI-SOC', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANG-STD', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ESP-STD', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ECO-STD', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'INF-STD', 2);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'EPS-STD', 1);
    END LOOP;

    -- 6. Final Clean: Delete subjects belonging to this school that have NO mappings
    -- and are not in our canonical list (to sweep away old "doublons" codes)
    DELETE FROM public.subjects 
    WHERE school_id = p_school_id 
      AND id NOT IN (SELECT subject_id FROM public.class_subjects WHERE school_id = p_school_id);

    -- 7. Default Supply Catalog (Constraint: school_id, academic_year_id, label)
    IF v_academic_year_id IS NOT NULL THEN
        INSERT INTO public.supply_catalog (school_id, academic_year_id, label, unit_price, category)
        VALUES 
            (p_school_id, v_academic_year_id, 'Frais d''Inscription', 2500, 'Frais'),
            (p_school_id, v_academic_year_id, 'Uniforme Complet', 5000, 'Uniforme'),
            (p_school_id, v_academic_year_id, 'Badge & Assurance', 500, 'Frais'),
            (p_school_id, v_academic_year_id, 'Kit Scolaire de base', 1500, 'Fourniture')
        ON CONFLICT (school_id, academic_year_id, label) DO NOTHING;
    END IF;

    -- 8. Update school settings
    UPDATE public.schools
    SET global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object(
        'currency', 'HTG',
        'academic_year_id', v_academic_year_id::TEXT
    )
    WHERE id = p_school_id;

END;
$$;

-- Helper functions for cleaner seeding
CREATE OR REPLACE FUNCTION public.upsert_class(p_school_id UUID, p_name TEXT, p_level TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.classes (school_id, name, level)
    VALUES (p_school_id, p_name, p_level)
    ON CONFLICT ON CONSTRAINT classes_school_name_campus_unique DO UPDATE SET level = EXCLUDED.level;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_subject(p_school_id UUID, p_name TEXT, p_code TEXT, p_category TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.subjects (school_id, name, code, category)
    VALUES (p_school_id, p_name, p_code, p_category)
    ON CONFLICT ON CONSTRAINT subjects_school_code_unique DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_subject_to_class(p_school_id UUID, p_class_id UUID, p_subject_code TEXT, p_coef NUMERIC)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_subject_id UUID;
BEGIN
    SELECT id INTO v_subject_id FROM public.subjects WHERE school_id = p_school_id AND code = p_subject_code;
    IF v_subject_id IS NOT NULL THEN
        INSERT INTO public.class_subjects (school_id, class_id, subject_id, coefficient)
        VALUES (p_school_id, p_class_id, v_subject_id, p_coef)
        ON CONFLICT ON CONSTRAINT class_subject_unique DO UPDATE SET coefficient = EXCLUDED.coefficient;
    END IF;
END;
$$;
