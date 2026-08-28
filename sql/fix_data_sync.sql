-- Script complet pour réparer les données et l'accès de l'utilisateur
DO $$
DECLARE
  v_user_email TEXT := 'jackito46@gmail.com';
  v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
  v_old_school_id TEXT := 'school-2025-premium';
BEGIN
  -- 1. S'assurer que l'école principale existe
  INSERT INTO public.schools (id, name, status, subscription_plan)
  VALUES (v_main_school_id, 'École Principale', 'ACTIVE', 'premium')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Lier l'utilisateur à l'école principale
  UPDATE public.profiles 
  SET school_id = v_main_school_id,
      role = 'DIRECTOR',
      is_super_admin = TRUE
  WHERE email = v_user_email;
  
  -- 3. Migrer les données de l'ancienne école (school-2025-premium) vers la nouvelle
  
  BEGIN
    UPDATE public.academic_years SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration academic_years: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.classes SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration classes: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.subjects SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration subjects: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.students SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration students: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.fee_plans SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration fee_plans: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.supply_catalog SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration supply_catalog: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.enrollments SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration enrollments: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.expense_categories SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration expense_categories: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.expenses SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration expenses: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.payments SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration payments: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.staff SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration staff: %', SQLERRM; END;

  -- 4. Convertir les colonnes school_id en UUID pour correspondre à get_my_school_id()
  -- Si elles sont déjà en UUID, cela ne fera rien.
  
  BEGIN
    ALTER TABLE public.academic_years ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion academic_years: %', SQLERRM; END;
  
  BEGIN
    ALTER TABLE public.classes ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion classes: %', SQLERRM; END;
  
  BEGIN
    ALTER TABLE public.subjects ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion subjects: %', SQLERRM; END;
  
  BEGIN
    ALTER TABLE public.students ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion students: %', SQLERRM; END;
  
  BEGIN
    ALTER TABLE public.fee_plans ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion fee_plans: %', SQLERRM; END;
  
  BEGIN
    ALTER TABLE public.supply_catalog ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion supply_catalog: %', SQLERRM; END;
  
  BEGIN
    ALTER TABLE public.expense_categories ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion expense_categories: %', SQLERRM; END;
  
  BEGIN
    ALTER TABLE public.expenses ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion expenses: %', SQLERRM; END;
  
  BEGIN
    ALTER TABLE public.payments ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion payments: %', SQLERRM; END;
  
  BEGIN
    ALTER TABLE public.staff ALTER COLUMN school_id TYPE UUID USING school_id::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur conversion staff: %', SQLERRM; END;

  RAISE NOTICE 'Réparation terminée pour %', v_user_email;
END $$;

