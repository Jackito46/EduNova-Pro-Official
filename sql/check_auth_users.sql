CREATE OR REPLACE FUNCTION public.check_auth_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  res jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'email', email, 'role', role, 'instance_id', instance_id))
  INTO res
  FROM auth.users
  LIMIT 5;
  RETURN res;
END;
$$;
