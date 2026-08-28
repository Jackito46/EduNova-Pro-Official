-- Link jomo2004@gmail.com to the main school
DO $$
DECLARE
  v_user_id UUID;
  v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
BEGIN
  -- Find the user ID for jomo2004@gmail.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jomo2004@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Update the profile to point to the main school
    UPDATE public.profiles
    SET school_id = v_main_school_id
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Updated jomo2004@gmail.com to school_id %', v_main_school_id;
  ELSE
    RAISE NOTICE 'User jomo2004@gmail.com not found';
  END IF;
END;
$$;
