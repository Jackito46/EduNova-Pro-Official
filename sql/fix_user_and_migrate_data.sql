-- Script pour réparer le compte de l'utilisateur et s'assurer qu'il voit toutes les données
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
  
  -- 3. Migrer les données de l'ancienne école (school-2025-premium) vers la nouvelle (si ce n'est pas déjà fait)
  -- On utilise un bloc TRY/CATCH (EXCEPTION) pour chaque table au cas où la colonne n'existe pas ou autre erreur
  
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
    UPDATE public.expenses SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration expenses: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.payments SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration payments: %', SQLERRM; END;
  
  BEGIN
    UPDATE public.staff SET school_id = v_main_school_id::text WHERE school_id = v_old_school_id;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Erreur migration staff: %', SQLERRM; END;

  RAISE NOTICE 'Réparation terminée pour %', v_user_email;
END $$;
