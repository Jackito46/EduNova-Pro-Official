-- Create a secure function to update user email in auth.users
CREATE OR REPLACE FUNCTION admin_update_user_email(target_user_id UUID, new_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Run as database owner
SET search_path = public
AS $$
BEGIN
  -- Check if the current user is a super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Only super admins can update user emails.';
  END IF;

  -- Update auth.users
  UPDATE auth.users
  SET email = new_email,
      updated_at = NOW()
  WHERE id = target_user_id;

  -- Update public.profiles just in case it wasn't done
  UPDATE public.profiles
  SET email = new_email
  WHERE id = target_user_id;
END;
$$;

-- Grant execute permission to authenticated users (the function itself checks for super admin)
GRANT EXECUTE ON FUNCTION admin_update_user_email(UUID, TEXT) TO authenticated;
