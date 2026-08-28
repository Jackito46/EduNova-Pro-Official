-- Fix the column name in seed_school_data
CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_class_id UUID;
    v_academic_year_id UUID;
    v_school_type TEXT;
BEGIN
    SELECT school_type INTO v_school_type FROM public.schools WHERE id = p_school_id;

    -- Création d'une année académique par défaut si aucune n'existe
    SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = p_school_id AND status = 'ACTIVE' LIMIT 1;
    IF v_academic_year_id IS NULL THEN
        INSERT INTO public.academic_years (school_id, label, start_date, end_date, status, is_active)
        VALUES (p_school_id, '2024-2025', '2024-09-01', '2025-06-30', 'ACTIVE', true)
        ON CONFLICT ON CONSTRAINT academic_years_school_id_label_key DO UPDATE SET is_active = EXCLUDED.is_active
        RETURNING id INTO v_academic_year_id;
        
        IF v_academic_year_id IS NULL THEN
            SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = p_school_id AND label = '2024-2025' LIMIT 1;
        END IF;
    END IF;

    IF v_school_type = 'UNIVERSITY' THEN
        INSERT INTO public.classes (school_id, name, level)
        VALUES 
            (p_school_id, 'Licence 1 - Tronc Commun', 'L1'),
            (p_school_id, 'Licence 2', 'L2'),
            (p_school_id, 'Licence 3', 'L3'),
            (p_school_id, 'Master 1', 'M1'),
            (p_school_id, 'Master 2', 'M2')
        ON CONFLICT ON CONSTRAINT classes_school_name_campus_unique DO NOTHING;

        INSERT INTO public.subjects (school_id, name, code, category)
        VALUES 
            (p_school_id, 'Méthodologie de la Recherche', 'METH-101', 'GENERAL'),
            (p_school_id, 'Statistiques Appliquées', 'STAT-201', 'SCIENCE'),
            (p_school_id, 'Gestion de Projet', 'PROJ-301', 'TECH'),
            (p_school_id, 'Anglais Académique', 'ANG-101', 'LANGUAGES')
        ON CONFLICT ON CONSTRAINT subjects_school_code_unique DO NOTHING;
    ELSIF v_school_type = 'PROFESSIONAL' THEN
        INSERT INTO public.classes (school_id, name, level)
        VALUES 
            (p_school_id, 'Plomberie', 'CERTIFICATE'),
            (p_school_id, 'Électricité Bâtiment', 'CERTIFICATE'),
            (p_school_id, 'Mécanique Auto', 'DIPLOMA'),
            (p_school_id, 'Coupe et Couture', 'CERTIFICATE'),
            (p_school_id, 'Informatique Bureautique', 'DIPLOMA')
        ON CONFLICT ON CONSTRAINT classes_school_name_campus_unique DO NOTHING;

        INSERT INTO public.subjects (school_id, name, code, category, description)
        VALUES 
            (p_school_id, 'Pratique en Atelier', 'ATELIER-1', 'TECH', 'Travaux pratiques spécifiques à la filière'),
            (p_school_id, 'Sécurité au Travail', 'SEC-01', 'GENERAL', 'Normes de sécurité et prévention des risques'),
            (p_school_id, 'Gestion de Micro-Entreprise', 'ENTREP-PRO', 'GENERAL', 'Esprit d''entreprise, plans d''affaires simples et marketing de proximité')
        ON CONFLICT ON CONSTRAINT subjects_school_code_unique DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;
    ELSE 
        -- CLASSIC SCHOOL
        -- Standard Classes
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

        -- Standard Subjects
        PERFORM public.upsert_subject(p_school_id, 'Psychomotricité', 'PSYCHOMOT', 'GENERAL');
        PERFORM public.upsert_subject(p_school_id, 'Langage et Communication', 'LANG-COMM', 'LANGUAGES');
        PERFORM public.upsert_subject(p_school_id, 'Initiation Mathématiques', 'INIT-MATH', 'SCIENCE');
        PERFORM public.upsert_subject(p_school_id, 'Arts et Dessin', 'ARTS-DESS', 'ARTS');
        PERFORM public.upsert_subject(p_school_id, 'Éveil Scientifique', 'EVEIL-SCI', 'SCIENCE');
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

        -- Maternelle
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND level = 'MATERNELLE' LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PSYCHOMOT', 1);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'LANG-COMM', 1);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'INIT-MATH', 1);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ARTS-DESS', 1);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'EVEIL-SCI', 1);
        END LOOP;

        -- Fondamentale 1-6
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND level = 'FONDAMENTALE' AND name ~ '^[1-6]' LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'FRA-STD', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'CRE-STD', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MAT-STD', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SCI-EXP', 2);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SCI-SOC', 2);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANG-STD', 1);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'EPS-STD', 1);
        END LOOP;

        -- Fondamentale 7-9
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

        -- Secondaire
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

        DELETE FROM public.subjects WHERE school_id = p_school_id AND id NOT IN (SELECT subject_id FROM public.class_subjects WHERE school_id = p_school_id);
    END IF;

    -- Tarification
    IF v_academic_year_id IS NOT NULL THEN
        INSERT INTO public.supply_catalog (school_id, academic_year_id, label, unit_price, category)
        VALUES (p_school_id, v_academic_year_id, 'Frais d''Inscription', 2500, 'Frais'),
               (p_school_id, v_academic_year_id, 'Uniforme Complet', 5000, 'Uniforme'),
               (p_school_id, v_academic_year_id, 'Badge & Assurance', 500, 'Frais'),
               (p_school_id, v_academic_year_id, 'Kit Scolaire de base', 1500, 'Fourniture')
        ON CONFLICT ON CONSTRAINT supply_catalog_school_year_label_unique DO NOTHING;
    END IF;

    UPDATE public.schools SET global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object('currency', 'HTG', 'academic_year_id', v_academic_year_id::TEXT) WHERE id = p_school_id;
END;
$function$;
