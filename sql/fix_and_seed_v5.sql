
-- 1. CORRECTION DE LA CONTRAINTE DE STATUT
-- On autorise maintenant les statuts financiers pour permettre les tests de blocage
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE public.students ADD CONSTRAINT students_status_check 
CHECK (status IN ('Actif', 'Inactif', 'Suspendu', 'Reliquat', 'Retard'));

-- 2. NETTOYAGE DES ANCIENNES DONNÉES DE TEST
DELETE FROM public.students WHERE school_id = 'school-2025-premium';

-- 3. SCRIPT D'INJECTION MASSIVE (5 ÉLÈVES PAR CLASSE)
DO $$ 
DECLARE 
    class_record RECORD;
    first_names TEXT[] := ARRAY['Jean', 'Marie', 'Pierre', 'Carline', 'Ricardo', 'Lourdes', 'Stéphane', 'Mariane', 'Alienne', 'Carlouis', 'Daphnée', 'Fabrice', 'Marlie', 'Junior', 'Sonia', 'Berline', 'Samuel', 'Tania', 'Patrick', 'Esther'];
    last_names TEXT[] := ARRAY['DUMAS', 'PIERRE', 'JEAN', 'COLLIN', 'JOSEPH', 'PAUL', 'MICHEL', 'BAPTISTE', 'LOUIS', 'CÉLESTIN', 'HONORÉ', 'CHARLES', 'AUGUSTIN', 'NAOMUR', 'VALCIN', 'SIMON', 'DORVIL', 'MARCELIN', 'THEODORE', 'ALEXIS'];
    i INTEGER;
    rand_fname TEXT;
    rand_lname TEXT;
    rand_dob DATE;
    rand_status TEXT;
BEGIN 
    -- On boucle sur chaque classe de l'école premium
    FOR class_record IN (SELECT id, level, name FROM public.classes WHERE school_id = 'school-2025-premium') LOOP
        
        FOR i IN 1..5 LOOP
            rand_fname := first_names[1 + floor(random() * array_length(first_names, 1))];
            rand_lname := last_names[1 + floor(random() * array_length(last_names, 1))];
            
            -- Calcul d'une date de naissance cohérente avec le niveau de la classe
            CASE class_record.level
                WHEN 'MATERNELLE' THEN rand_dob := (CURRENT_DATE - INTERVAL '3 years' - (random() * INTERVAL '2 years'));
                WHEN 'FONDAMENTALE' THEN 
                    IF class_record.name LIKE '%AF' THEN
                         rand_dob := (CURRENT_DATE - INTERVAL '6 years' - (random() * INTERVAL '8 years'));
                    ELSE
                         rand_dob := (CURRENT_DATE - INTERVAL '10 years' - (random() * INTERVAL '4 years'));
                    END IF;
                WHEN 'SECONDAIRE' THEN rand_dob := (CURRENT_DATE - INTERVAL '15 years' - (random() * INTERVAL '5 years'));
                ELSE rand_dob := '2012-05-15';
            END CASE;

            -- Génération aléatoire de solvabilité pour tester les blocages
            -- 20% de chances d'avoir un reliquat ou retard
            rand_status := CASE 
                WHEN random() > 0.9 THEN 'Retard'
                WHEN random() > 0.8 THEN 'Reliquat'
                ELSE 'Actif'
            END;

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
                'Resp. ' || rand_lname,
                'Parent',
                '509-3' || floor(random()*9) || floor(random()*9) || floor(random()*9) || '-' || floor(random()*9) || floor(random()*9) || floor(random()*9),
                rand_status
            );
        END LOOP;
        
    END LOOP;
END $$;
