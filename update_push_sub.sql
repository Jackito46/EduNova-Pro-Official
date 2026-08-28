CREATE OR REPLACE FUNCTION admin_get_push_subscriptions(p_school_id UUID, p_roles TEXT[] DEFAULT NULL, p_user_ids UUID[] DEFAULT NULL)
RETURNS TABLE(endpoint TEXT, p256dh TEXT, auth TEXT, user_id TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ps.endpoint, ps.p256dh, ps.auth, ps.user_id::text, pr.role::text
  FROM public.push_subscriptions ps
  JOIN public.profiles pr ON ps.user_id = pr.id
  WHERE ps.school_id = p_school_id
    AND (p_roles IS NULL OR pr.role::text = ANY(p_roles))
    AND (p_user_ids IS NULL OR ps.user_id = ANY(p_user_ids));
END;
$$;
