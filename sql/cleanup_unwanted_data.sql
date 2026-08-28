-- Cleanup unwanted school and user
BEGIN;

DO $$
DECLARE
  v_unwanted_school_id UUID := 'e7d0baf1-f465-483a-88f5-a4d1b6cf93a6';
  v_unwanted_user_id UUID := '0b83ad0d-19c9-48ae-97c2-8548081b66a5';
BEGIN
  -- Delete the unwanted user from profiles
  DELETE FROM public.profiles WHERE id = v_unwanted_user_id;
  
  -- Delete the unwanted user from auth.users
  DELETE FROM auth.users WHERE id = v_unwanted_user_id;
  
  -- Delete the unwanted school
  DELETE FROM public.schools WHERE id = v_unwanted_school_id;
  
  RAISE NOTICE 'Cleanup completed successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error during cleanup: %', SQLERRM;
END;
$$;

COMMIT;
