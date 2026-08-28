DO $$ 
DECLARE
  v_school_id uuid;
  v_subject_id uuid;
  v_class_id uuid;
  
  rec_subj record;
  rec_class record;
BEGIN
  -- Get the first school (for the demo environment, or the active university)
  SELECT id INTO v_school_id FROM public.schools WHERE school_type = 'UNIVERSITY' LIMIT 1;
  
  IF v_school_id IS NULL THEN
    SELECT id INTO v_school_id FROM public.schools LIMIT 1;
  END IF;

  IF v_school_id IS NULL THEN
    RETURN;
  END IF;

  -- Create basic subjects for Sciences Informatiques
  
  -- LEVEL 1
  INSERT INTO public.subjects (school_id, name, code, description) VALUES
  (v_school_id, 'Algorithmique et Programmation', 'INFO-101', 'Fondements de la programmation C/C++'),
  (v_school_id, 'Mathématiques Discrètes', 'MATH-101', 'Logique et ensembles pour informatique'),
  (v_school_id, 'Architecture des Ordinateurs', 'ARCH-101', 'Composants et fonctionnement matériel'),
  (v_school_id, 'Anglais Technique', 'LANG-101', 'Anglais pour ingénieurs')
  ON CONFLICT DO NOTHING;

  -- LEVEL 2
  INSERT INTO public.subjects (school_id, name, code, description) VALUES
  (v_school_id, 'Structures de Données', 'INFO-201', 'Listes, arbres, graphes en Java'),
  (v_school_id, 'Bases de Données (SQL)', 'DBD-201', 'Modélisation et requêtes SQL'),
  (v_school_id, 'Réseaux Informatiques', 'RES-201', 'Modèle OSI, TCP/IP, routage'),
  (v_school_id, 'Systèmes d''Exploitation', 'OS-201', 'Gestion des processus, Linux')
  ON CONFLICT DO NOTHING;

  -- LEVEL 3
  INSERT INTO public.subjects (school_id, name, code, description) VALUES
  (v_school_id, 'Génie Logiciel', 'GL-301', 'Méthodes agiles, UML'),
  (v_school_id, 'Développement Web', 'WEB-301', 'Frontend et Backend (React/Node)'),
  (v_school_id, 'Intelligence Artificielle', 'AI-301', 'Machine Learning et Réseaux de Neurones'),
  (v_school_id, 'Sécurité Informatique', 'SEC-301', 'Cryptographie et Cyber-sécurité')
  ON CONFLICT DO NOTHING;

  -- LEVEL 4
  INSERT INTO public.subjects (school_id, name, code, description) VALUES
  (v_school_id, 'Gestion de Projet Informatique', 'PROJ-401', 'Management d''équipes tech'),
  (v_school_id, 'Cloud Computing', 'CLD-401', 'AWS, Azure, Déploiement'),
  (v_school_id, 'Big Data Processing', 'DAT-401', 'Hadoop, Spark, Data Science'),
  (v_school_id, 'Mémoire de Sortie', 'MEM-401', 'Projet de fin d''étude')
  ON CONFLICT DO NOTHING;

  -- Now let's try to find classes that look like Sciences Informatiques 1, 2, 3, 4
  -- and attach the appropriate subjects if they exist.

  -- Level 1
  FOR rec_class IN SELECT id FROM public.classes WHERE school_id = v_school_id AND name ILIKE '%Informatique%' AND (name ILIKE '%1%' OR name ILIKE '%I%') LOOP
     FOR rec_subj IN SELECT id FROM public.subjects WHERE school_id = v_school_id AND code IN ('INFO-101', 'MATH-101', 'ARCH-101', 'LANG-101') LOOP
        INSERT INTO public.class_subjects (school_id, class_id, subject_id, coefficient) VALUES (v_school_id, rec_class.id, rec_subj.id, 100) ON CONFLICT DO NOTHING;
     END LOOP;
  END LOOP;

  -- Level 2
  FOR rec_class IN SELECT id FROM public.classes WHERE school_id = v_school_id AND name ILIKE '%Informatique%' AND (name ILIKE '%2%' OR name ILIKE '%II%') LOOP
     FOR rec_subj IN SELECT id FROM public.subjects WHERE school_id = v_school_id AND code IN ('INFO-201', 'DBD-201', 'RES-201', 'OS-201') LOOP
        INSERT INTO public.class_subjects (school_id, class_id, subject_id, coefficient) VALUES (v_school_id, rec_class.id, rec_subj.id, 100) ON CONFLICT DO NOTHING;
     END LOOP;
  END LOOP;

  -- Level 3
  FOR rec_class IN SELECT id FROM public.classes WHERE school_id = v_school_id AND name ILIKE '%Informatique%' AND (name ILIKE '%3%' OR name ILIKE '%III%') LOOP
     FOR rec_subj IN SELECT id FROM public.subjects WHERE school_id = v_school_id AND code IN ('GL-301', 'WEB-301', 'AI-301', 'SEC-301') LOOP
        INSERT INTO public.class_subjects (school_id, class_id, subject_id, coefficient) VALUES (v_school_id, rec_class.id, rec_subj.id, 100) ON CONFLICT DO NOTHING;
     END LOOP;
  END LOOP;

  -- Level 4
  FOR rec_class IN SELECT id FROM public.classes WHERE school_id = v_school_id AND name ILIKE '%Informatique%' AND (name ILIKE '%4%' OR name ILIKE '%IV%') LOOP
     FOR rec_subj IN SELECT id FROM public.subjects WHERE school_id = v_school_id AND code IN ('PROJ-401', 'CLD-401', 'DAT-401', 'MEM-401') LOOP
        INSERT INTO public.class_subjects (school_id, class_id, subject_id, coefficient) VALUES (v_school_id, rec_class.id, rec_subj.id, 100) ON CONFLICT DO NOTHING;
     END LOOP;
  END LOOP;

END $$;
