CREATE OR REPLACE FUNCTION public.admin_get_school_admins(p_school_id UUID)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- We use the safe function that checks raw metadata directly
  v_is_super_admin := public.is_super_admin_safe(auth.uid());
  
  IF NOT COALESCE(v_is_super_admin, FALSE) THEN
    RAISE EXCEPTION 'Access denied: Super Admin only';
  END IF;
  
  RETURN QUERY SELECT * FROM public.profiles WHERE school_id = p_school_id AND role IN ('admin', 'director');
END;
$$;
