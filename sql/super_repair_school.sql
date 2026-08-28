-- Function to repair and sync a specific school/user context
-- This is called from the Settings view to fix permission/sync issues

CREATE OR REPLACE FUNCTION public.super_repair_school(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  -- 1. Run the global repair to ensure all profiles exist and basic sync is done
  PERFORM public.repair_and_sync_all();

  -- 2. Specifically target the user who requested the repair
  SELECT * INTO v_profile FROM public.profiles WHERE id = target_user_id;
  
  IF FOUND THEN
    -- Force sync metadata to auth.users for this specific user
    -- This ensures the NEXT JWT they get will have the correct school_id and is_super_admin flag
    UPDATE auth.users
    SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'school_id', v_profile.school_id::text, 
        'is_super_admin', v_profile.is_super_admin,
        'role', v_profile.role
      )
    WHERE id = target_user_id;
  END IF;

  -- 3. Notify PostgREST to reload schema cache
  NOTIFY pgrst, 'reload schema';
END;
$$;
