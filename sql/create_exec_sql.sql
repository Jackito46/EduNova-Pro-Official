-- Create the exec_sql function to allow running arbitrary SQL from the script
CREATE OR REPLACE FUNCTION public.exec_sql(sql_string text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    result jsonb;
BEGIN
    EXECUTE sql_string INTO result;
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon, authenticated, service_role;
