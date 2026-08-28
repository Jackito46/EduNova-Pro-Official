CREATE OR REPLACE FUNCTION invalidate_user_sessions(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Delete all sessions and refresh tokens for the user to force them out immediately
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
END;
$$;
GRANT EXECUTE ON FUNCTION invalidate_user_sessions(uuid) TO anon, authenticated, service_role;

