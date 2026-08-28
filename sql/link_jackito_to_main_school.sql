-- Lier le compte jackito46@gmail.com à l'école principale (qui contient toutes les données)
DO $$
DECLARE
  v_main_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
BEGIN
  -- Mettre à jour le profil de jackito46@gmail.com
  UPDATE public.profiles 
  SET school_id = v_main_school_id,
      role = 'DIRECTOR',
      is_super_admin = TRUE
  WHERE email = 'jackito46@gmail.com';
  
  RAISE NOTICE 'Updated jackito46@gmail.com to school_id %', v_main_school_id;
END $$;
