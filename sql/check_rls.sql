CREATE OR REPLACE FUNCTION public.check_rls()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  res jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('policyname', policyname, 'tablename', tablename, 'qual', qual, 'with_check', with_check))
  INTO res
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('profiles', 'schools');
  RETURN res;
END;
$$;
