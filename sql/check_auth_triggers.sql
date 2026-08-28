CREATE OR REPLACE FUNCTION public.check_auth_triggers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  res jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('trigger_name', trigger_name, 'event_manipulation', event_manipulation, 'action_statement', action_statement))
  INTO res
  FROM information_schema.triggers
  WHERE event_object_schema = 'auth' AND event_object_table = 'users';
  RETURN res;
END;
$$;
