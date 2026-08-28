-- ==========================================================
-- SCRIPT DE GÉNÉRATION DE DONNÉES DE TEST - EduNova Pro
-- Injection de 5 élèves par classe (80 élèves au total)
-- ==========================================================

DO $$ 
DECLARE 
    class_record RECORD;
    first_names TEXT[] := ARRAY['Jean', 'Marie', 'Pierre', 'Carline', 'Ricardo', 'Lourdes', 'Stéphane', 'Mariane', 'Alienne', 'Carlouis', 'Daphnée', 'Fabrice', 'Marlie', 'Junior', 'Sonia'];
    last_names TEXT[] := ARRAY['DUMAS', 'PIERRE', 'JEAN', 'COLLIN', 'JOSEPH', 'PAUL', 'MICHEL', 'BAPTISTE', 'LOUIS', 'CÉLESTIN', 'HONORÉ', 'CHARLES', 'AUGUSTIN', 'NAOMUR', 'VALCIN'];
    i INTEGER;
    rand_fname TEXT;
    rand_lname TEXT;
    rand_dob DATE;
BEGIN 
    -- On boucle sur toutes les classes de l'école premium
    FOR class_record IN (SELECT id, level FROM public.classes WHERE school_id = 'school-2025-premium') LOOP
        
        FOR i IN 1..5 LOOP
            rand_fname := first_names[1 + floor(random() * array_length(first_names, 1))];
            rand_lname := last_names[1 + floor(random() * array_length(last_names, 1))];
            
            -- Calcul d'une date de naissance cohérente avec le niveau
            CASE class_record.level
                WHEN 'MATERNELLE' THEN rand_dob := (CURRENT_DATE - INTERVAL '3 years' - (random() * INTERVAL '2 years'));
                WHEN 'FONDAMENTALE' THEN rand_dob := (CURRENT_DATE - INTERVAL '7 years' - (random() * INTERVAL '8 years'));
                WHEN 'SECONDAIRE' THEN rand_dob := (CURRENT_DATE - INTERVAL '15 years' - (random() * INTERVAL '5 years'));
                ELSE rand_dob := '2015-01-01';
            END CASE;

            INSERT INTO public.students (
                school_id, class_id, first_name, last_name, gender, dob, 
                parent_name, parent_relation, parent_phone, status
            ) VALUES (
                'school-2025-premium',
                class_record.id,
                rand_fname,
                rand_lname,
                CASE WHEN random() > 0.5 THEN 'Masculin' ELSE 'Féminin' END,
                rand_dob,
                'Responsable ' || rand_lname,
                'Parent',
                '509-3' || floor(random()*9) || floor(random()*9) || floor(random()*9) || '-' || floor(random()*9) || floor(random()*9) || floor(random()*9),
                CASE WHEN random() > 0.8 THEN 'Reliquat' ELSE 'Actif' END
            );
        END LOOP;
        
    END LOOP;
END $$;