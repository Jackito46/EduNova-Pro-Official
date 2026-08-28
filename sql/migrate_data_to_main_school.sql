-- Migrate data from school-2025-premium to the main school
DO $$
DECLARE
  v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
  v_old_school_id TEXT := 'school-2025-premium';
BEGIN
  -- Update academic_years
  UPDATE public.academic_years SET school_id = v_main_school_id WHERE school_id = v_old_school_id;
  
  -- Update classes
  UPDATE public.classes SET school_id = v_main_school_id WHERE school_id = v_old_school_id;
  
  -- Update subjects
  UPDATE public.subjects SET school_id = v_main_school_id WHERE school_id = v_old_school_id;
  
  -- Update students
  UPDATE public.students SET school_id = v_main_school_id WHERE school_id = v_old_school_id;
  
  -- Update fee_plans
  UPDATE public.fee_plans SET school_id = v_main_school_id WHERE school_id = v_old_school_id;
  
  -- Update supply_catalog
  UPDATE public.supply_catalog SET school_id = v_main_school_id WHERE school_id = v_old_school_id;
  
  -- Update expenses
  UPDATE public.expenses SET school_id = v_main_school_id WHERE school_id = v_old_school_id;
  
  -- Update payments
  UPDATE public.payments SET school_id = v_main_school_id WHERE school_id = v_old_school_id;
  
  -- Update staff
  UPDATE public.staff SET school_id = v_main_school_id WHERE school_id = v_old_school_id;
  
  RAISE NOTICE 'Data migrated from % to %', v_old_school_id, v_main_school_id;
END;
$$;
