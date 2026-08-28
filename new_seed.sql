CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ 

DECLARE
    v_class_id UUID;
    v_academic_year_id UUID;
    v_school_type TEXT;
    v_session_config JSONB;
    v_session_mode TEXT;
    v_session_label TEXT;
    v_session_start DATE;
    v_session_end DATE;
    v_current_year INTEGER;
    v_current_month INTEGER;
BEGIN
    SELECT school_type INTO v_school_type FROM public.schools WHERE id = p_school_id;
    
    -- Load session config from global_settings
    SELECT value INTO v_session_config FROM public.global_settings WHERE key = 'session_config' LIMIT 1;
    
    IF v_session_config IS NOT NULL THEN
        v_session_mode := v_session_config->>'mode';
        v_session_label := v_session_config->>'label';
        
        IF v_session_config->>'start_date' IS NOT NULL AND v_session_config->>'start_date' != '' THEN
            v_session_start := (v_session_config->>'start_date')::DATE;
        END IF;
        
        IF v_session_config->>'end_date' IS NOT NULL AND v_session_config->>'end_date' != '' THEN
            v_session_end := (v_session_config->>'end_date')::DATE;
        END IF;
    END IF;
    
    -- Defaults if nothing is set or auto mode
    IF v_session_mode IS NULL OR v_session_mode = 'auto' THEN
        v_current_year := extract(year from current_date);
        v_current_month := extract(month from current_date);
        
        -- If we are before August, we consider it's the end of the previous academic year
        IF v_current_month < 8 THEN
            v_session_label := (v_current_year - 1)::TEXT || '-' || v_current_year::TEXT;
            v_session_start := MAKE_DATE(v_current_year - 1, 9, 1);
            v_session_end := MAKE_DATE(v_current_year, 6, 30);
        ELSE
            v_session_label := v_current_year::TEXT || '-' || (v_current_year + 1)::TEXT;
            v_session_start := MAKE_DATE(v_current_year, 9, 1);
            v_session_end := MAKE_DATE(v_current_year + 1, 6, 30);
        END IF;
    END IF;
    
    -- Fallbacks just in case
    IF v_session_label IS NULL OR v_session_label = '' THEN
        v_session_label := extract(year from current_date)::TEXT || '-' || (extract(year from current_date) + 1)::TEXT;
    END IF;
    IF v_session_start IS NULL THEN
        v_session_start := MAKE_DATE(extract(year from current_date)::INTEGER, 9, 1);
    END IF;
    IF v_session_end IS NULL THEN
        v_session_end := MAKE_DATE(extract(year from current_date)::INTEGER + 1, 6, 30);
    END IF;

    -- Création d'une année académique par défaut si aucune n'existe
    SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = p_school_id AND status = 'ACTIVE' LIMIT 1;
    IF v_academic_year_id IS NULL THEN
        INSERT INTO public.academic_years (school_id, label, start_date, end_date, status, is_active)
        VALUES (p_school_id, v_session_label, v_session_start, v_session_end, 'ACTIVE', true)
        ON CONFLICT (school_id, label) DO UPDATE SET is_active = EXCLUDED.is_active
        RETURNING id INTO v_academic_year_id;
        
        IF v_academic_year_id IS NULL THEN
            SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = p_school_id AND label = v_session_label LIMIT 1;
        END IF;
    END IF;
    
    IF v_school_type = 'UNIVERSITY' THEN

        INSERT INTO public.classes (school_id, name, level)
        VALUES 
            (p_school_id, 'L1 - Sciences Informatiques', 'UNIVERSITE'),
            (p_school_id, 'L2 - Sciences Informatiques', 'UNIVERSITE'),
            (p_school_id, 'L3 - Sciences Informatiques', 'UNIVERSITE'),
            (p_school_id, 'L1 - Administration des Affaires', 'UNIVERSITE'),
            (p_school_id, 'L2 - Administration des Affaires', 'UNIVERSITE'),
            (p_school_id, 'L3 - Administration des Affaires', 'UNIVERSITE')
        ON CONFLICT ON CONSTRAINT classes_school_name_campus_unique DO NOTHING;

        INSERT INTO public.subjects (school_id, name, code, category)
        VALUES 
            (p_school_id, 'Algorithmique & Programmation', 'INFO101', 'TECH'),
            (p_school_id, 'Bases de Données', 'INFO102', 'TECH'),
            (p_school_id, 'Réseaux & Télécoms', 'INFO103', 'TECH'),
            (p_school_id, 'Comptabilité Générale', 'COMP101', 'GENERAL'),
            (p_school_id, 'Économie', 'ECO101', 'GENERAL'),
            (p_school_id, 'Management', 'MNG101', 'GENERAL'),
            (p_school_id, 'Anglais Technique', 'ANG101', 'LANGUAGES'),
            (p_school_id, 'Communication', 'COM101', 'LANGUAGES')
        ON CONFLICT ON CONSTRAINT subjects_school_code_unique DO NOTHING;

    ELSIF v_school_type = 'PROFESSIONAL' THEN
        INSERT INTO public.classes (school_id, name, level)
        VALUES 
            (p_school_id, 'Cuisine et Pâtisserie', 'CERTIFICAT'),
            (p_school_id, 'Service de Bar & Restauration', 'CERTIFICAT'),
            (p_school_id, 'Coiffure & Esthétique', 'CERTIFICAT'),
            (p_school_id, 'Coupe et Couture', 'CERTIFICAT'),
            (p_school_id, 'Dépannage Informatique', 'CERTIFICAT'),
            (p_school_id, 'Réseaux Informatiques', 'CERTIFICAT'),
            (p_school_id, 'Plomberie & Hydraulique', 'CERTIFICAT'),
            (p_school_id, 'Électricité Bâtiment', 'CERTIFICAT'),
            (p_school_id, 'Mécanique Auto', 'CERTIFICAT')
        ON CONFLICT ON CONSTRAINT classes_school_name_campus_unique DO NOTHING;

        INSERT INTO public.subjects (school_id, name, code, category, description)
        VALUES 
            (p_school_id, 'Art Culinaire & Gastronomie', 'CUIS-101', 'GENERAL', 'Cuisine et préparation culinaire de niveau professionnel'),
            (p_school_id, 'Service de Bar & Restauration', 'BAR-REST', 'GENERAL', 'Service à la clientèle, mixologie et gestion des bars'),
            (p_school_id, 'Techniques de Pâtisserie & Boulangerie', 'PATISS-101', 'GENERAL', 'Farines, pâtes, gâteaux et desserts professionnels'),
            (p_school_id, 'Hygiène et Sécurité Alimentaire', 'HYG-ALIM', 'GENERAL', 'Normes sanitaires, conservation et chaîne du froid'),
            (p_school_id, 'Oenologie & Sommellerie', 'OENO-101', 'GENERAL', 'Connaissance des vins et spiritueux'),
            (p_school_id, 'Esthétique Professionnelle & Soins', 'ESTH101', 'GENERAL', 'Soins de la peau, traitements corporels'),
            (p_school_id, 'Techniques de Coiffure & Coupe', 'CHEF-COIF', 'GENERAL', 'Coupe de cheveux, brushing, coloration et coiffure'),
            (p_school_id, 'Art du Maquillage', 'MAQ-PEAU', 'GENERAL', 'Théorie des couleurs et maquillage professionnel'),
            (p_school_id, 'Manucure, Pédicure & Onglerie', 'ONGLE', 'GENERAL', 'Soins des mains et pieds, pose de faux ongles'),
            (p_school_id, 'Maintenance Matériel Informatique', 'MAINT101', 'TECH', 'Dépannage, montage et entretien des PC'),
            (p_school_id, 'Fondamentaux Réseaux & Câblage', 'RES101', 'TECH', 'Concepts réseaux, adresses IP et câblage RJ45'),
            (p_school_id, 'Bureautique & Secrétariat', 'BURO-SEC', 'TECH', 'Gestion administrative, accueil et Word'),
            (p_school_id, 'Tableaux Financiers & Excel', 'EXCEL-PRO', 'TECH', 'Traitement de données sous MS Excel'),
            (p_school_id, 'Initiation Web & Réseaux Sociaux', 'WEB-INIT', 'TECH', 'Création de sites simples et marketing digital'),
            (p_school_id, 'Électricité Bâtiment', 'ELEC-BAT', 'TECH', 'Montages simples, va-et-vient, installations résidentielles'),
            (p_school_id, 'Électricité Industrielle', 'ELEC-IND', 'TECH', 'Moteurs thermiques, triphasé et armoires de contrôle'),
            (p_school_id, 'Pratique Plomberie & Sanitaire', 'PLOM101', 'TECH', 'Canalisations, sanitaires, étanchéité et raccordements'),
            (p_school_id, 'Climatisation & Réfrigération', 'CLIM-REF', 'TECH', 'Systèmes de conditionnement d''air et congélateurs'),
            (p_school_id, 'Moteurs à Combustion Interne', 'MEC101', 'TECH', 'Fonctionnement des moteurs essence et diesel'),
            (p_school_id, 'Électricité & Diagnostic Automobile', 'AUTO-DIAG', 'TECH', 'Électronique embarquée et scanneur OBD'),
            (p_school_id, 'Organes de Transmission & Freinage', 'AUTO-MECA', 'TECH', 'Systèmes de freinage, boîtes et suspension'),
            (p_school_id, 'Coupe & Couture de Base', 'COUT-101', 'GENERAL', 'Patronage de base, points de couture et machines'),
            (p_school_id, 'Modélisme & Stylisme de Mode', 'STYL-101', 'GENERAL', 'Création de vêtements sur mesure, étude des tissus'),
            (p_school_id, 'Comptabilité Simplifiée & Facturation', 'COMP-SIMPL', 'GENERAL', 'Gestion de caisse et facturation d''atelier'),
            (p_school_id, 'Création de Micro-Entreprise', 'ENTREP-PRO', 'GENERAL', 'Esprit d''entreprise, plans d''affaires simples et marketing de proximité')
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

 $$;