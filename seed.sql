CREATE OR REPLACE FUNCTION public.seed_school_data(p_school_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth'
AS $function$
DECLARE
    v_academic_year_id UUID;
    v_class_id UUID;
    v_school_type TEXT;
BEGIN
    -- Obtenir le type d'école
    SELECT COALESCE(school_type, 'CLASSIC') INTO v_school_type FROM public.schools WHERE id = p_school_id;

    -- Création d'année académique par défaut
    SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = p_school_id AND is_active = true LIMIT 1;
    IF v_academic_year_id IS NULL THEN
        INSERT INTO public.academic_years (school_id, label, is_active, status, start_date, end_date)
        VALUES (p_school_id, '2025-2026', true, 'ACTIVE', '2025-09-01', '2026-06-30')
        ON CONFLICT (school_id, label) DO NOTHING RETURNING id INTO v_academic_year_id;
        IF v_academic_year_id IS NULL THEN
            SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = p_school_id AND label = '2025-2026' LIMIT 1;
        END IF;
    END IF;

    -- Nettoyage des anciennes liaisons au cas où on recharge
    DELETE FROM public.class_subjects WHERE school_id = p_school_id;

    IF v_school_type = 'UNIVERSITY' THEN
        -- Injection via seed_subjects_pro (matières)
        PERFORM public.seed_subjects_pro(p_school_id::text);
        
        -- On laisse la UI créer les classes universitaires avec "executeUniversitySeed" pour des liens parfaits et interactifs
    ELSIF v_school_type = 'PROFESSIONAL' THEN
        -- Classes Professionnelles
        PERFORM public.upsert_class(p_school_id, 'Comptabilité Informatisée & Fiscalité I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Comptabilité Informatisée & Fiscalité II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Technique Douanière & Transit I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Technique Douanière & Transit II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Secrétariat Médical & Gestion I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Secrétariat Médical & Gestion II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Marketing & Vente Professionnelle I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Marketing & Vente Professionnelle II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Informatique de Bureau & Administration I', 'CERTIFICAT');
        PERFORM public.upsert_class(p_school_id, 'Assistance Administrative & Bilingue I', 'CERTIFICAT');
        PERFORM public.upsert_class(p_school_id, 'Maintenance Informatique & Réseaux I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Maintenance Informatique & Réseaux II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Graphisme & Design Multimédia I', 'CERTIFICAT');
        PERFORM public.upsert_class(p_school_id, 'Développement Web & Applications I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Développement Web & Applications II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Électricité du Bâtiment & Solaire I', 'CERTIFICAT');
        PERFORM public.upsert_class(p_school_id, 'Plomberie & Sanitaire Moderne I', 'CERTIFICAT');
        PERFORM public.upsert_class(p_school_id, 'Climatisation, Froid & Réfrigération I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Climatisation, Froid & Réfrigération II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Mécanique Automobile & Diagnostic I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Mécanique Automobile & Diagnostic II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Soudure & Fabrication Industrielle I', 'CERTIFICAT');
        PERFORM public.upsert_class(p_school_id, 'Cuisine, Restauration & Traiteur I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Cuisine, Restauration & Traiteur II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Pâtisserie & Boulangerie Artisanale I', 'CERTIFICAT');
        PERFORM public.upsert_class(p_school_id, 'Gestion Hôtelière & Touristique I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Gestion Hôtelière & Touristique II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Couture, Stylisme & Modélisme I', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Couture, Stylisme & Modélisme II', 'DIPLOME');
        PERFORM public.upsert_class(p_school_id, 'Esthétique, Cosmétique & Maquillage I', 'CERTIFICAT');
        PERFORM public.upsert_class(p_school_id, 'Coiffure Professionnelle & Visagisme I', 'CERTIFICAT');
        PERFORM public.upsert_class(p_school_id, 'Secourisme, Hygiène & Soins d''Urgence I', 'CERTIFICAT');

        -- Matières Professionnelles
        -- Informatique / Bureautique
        PERFORM public.upsert_subject(p_school_id, 'Microsoft Word & Excel', 'INFO-BUR1', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Réseaux Sociaux & Internet', 'INFO-BUR2', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Architecture Matérielle', 'INFO-BUR3', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Saisie Rapide & Secrétariat', 'SEC-RAPIDE', 'TECH');
        -- Tronc commun pro
        PERFORM public.upsert_subject(p_school_id, 'Comptabilité Basique', 'COMP-PRO', 'GENERAL');
        PERFORM public.upsert_subject(p_school_id, 'Entreprenariat', 'ENTREP-PRO', 'GENERAL');
        PERFORM public.upsert_subject(p_school_id, 'Éthique Professionnelle', 'ETH-PRO', 'GENERAL');
        PERFORM public.upsert_subject(p_school_id, 'Français Professionnel', 'FRA-PRO', 'LANGUAGES');
        PERFORM public.upsert_subject(p_school_id, 'Anglais Technique', 'ANG-TECH', 'LANGUAGES');
        -- Art Culinaire
        PERFORM public.upsert_subject(p_school_id, 'Cuisine Haïtienne & Créole', 'CUIS-HT', 'ARTS');
        PERFORM public.upsert_subject(p_school_id, 'Cuisine Internationale', 'CUIS-INT', 'ARTS');
        PERFORM public.upsert_subject(p_school_id, 'Pâtisserie & Boulangerie', 'PATIS-1', 'ARTS');
        PERFORM public.upsert_subject(p_school_id, 'Gestion de Restaurant', 'GEST-RESTO', 'GENERAL');
        PERFORM public.upsert_subject(p_school_id, 'Hygiène Alimentaire', 'HYG-ALIM', 'GENERAL');
        -- Plomberie
        PERFORM public.upsert_subject(p_school_id, 'Plomberie Sanitaire', 'PLOM-SAN', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Lecture de Plan', 'PLAN-PRO', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Réseaux Hydrauliques', 'RES-HYDR', 'TECH');
        -- Electricite
        PERFORM public.upsert_subject(p_school_id, 'Installation Résidentielle', 'ELEC-RES', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Énergie Solaire & Inverter', 'SOLAR-1', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Sécurité Électrique', 'ELEC-SEC', 'TECH');
        -- Mecanique
        PERFORM public.upsert_subject(p_school_id, 'Moteurs à Explosion', 'MEC-EXP', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Système de Freinage', 'MEC-FREIN', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Transmission & Direction', 'MEC-TRANS', 'TECH');
        PERFORM public.upsert_subject(p_school_id, 'Électricité Automobile', 'MEC-ELEC', 'TECH');
        -- Esthetique
        PERFORM public.upsert_subject(p_school_id, 'Maquillage & Soins Visage', 'ESTH-MAQ', 'ARTS');
        PERFORM public.upsert_subject(p_school_id, 'Coiffure & Tresse', 'ESTH-COIF', 'ARTS');
        PERFORM public.upsert_subject(p_school_id, 'Pédicure & Manucure', 'ESTH-PEDI', 'ARTS');
        -- Couture
        PERFORM public.upsert_subject(p_school_id, 'Patronage & Découpe', 'COUT-PATR', 'ARTS');
        PERFORM public.upsert_subject(p_school_id, 'Assemblage & Finition', 'COUT-ASSEMB', 'ARTS');
        PERFORM public.upsert_subject(p_school_id, 'Design de Mode', 'COUT-DESIGN', 'ARTS');

        -- Assignations Communes a toutes les classes professionnelles (Ethique, Francais, Anglais, Entreprenariat)
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ETH-PRO', 1);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ENTREP-PRO', 2);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'FRA-PRO', 2);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'COMP-PRO', 2);
        END LOOP;

        -- Assignations Spécifiques
        -- Informatique I & II
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name LIKE 'Informatique%' LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'INFO-BUR1', 5);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'INFO-BUR2', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'INFO-BUR3', 3);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SEC-RAPIDE', 3);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANG-TECH', 2);
        END LOOP;

        -- Art Culinaire
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name LIKE 'Cuisine%' LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'CUIS-HT', 5);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'CUIS-INT', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PATIS-1', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'GEST-RESTO', 3);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'HYG-ALIM', 2);
        END LOOP;

        -- Plomberie
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name = 'Plomberie' LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PLOM-SAN', 6);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PLAN-PRO', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'RES-HYDR', 4);
        END LOOP;

        -- Electricite
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name LIKE 'Électricité%' LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ELEC-RES', 6);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SOLAR-1', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ELEC-SEC', 2);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PLAN-PRO', 3);
        END LOOP;

        -- Mecanique
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name LIKE 'Mécanique Auto%' LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MEC-EXP', 5);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MEC-FREIN', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MEC-TRANS', 4);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MEC-ELEC', 3);
        END LOOP;

        -- Esthétique
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name LIKE 'Esthétique%' LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ESTH-MAQ', 5);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ESTH-COIF', 5);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ESTH-PEDI', 4);
        END LOOP;

        -- Couture
        FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name LIKE 'Couture%' LOOP
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'COUT-PATR', 6);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'COUT-ASSEMB', 5);
            PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'COUT-DESIGN', 3);
        END LOOP;

        -- Remove unassigned subjects
        DELETE FROM public.subjects WHERE school_id = p_school_id AND id NOT IN (SELECT subject_id FROM public.class_subjects WHERE school_id = p_school_id);

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
        ON CONFLICT (school_id, academic_year_id, label) DO NOTHING;
    END IF;

    UPDATE public.schools SET global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object('currency', 'HTG', 'academic_year_id', v_academic_year_id::TEXT) WHERE id = p_school_id;
END;
$function$

