
CREATE OR REPLACE FUNCTION public.exec_sql(sql_string text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    EXECUTE sql_string INTO result;
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
