CREATE OR REPLACE FUNCTION public.exec_sql(sql_string text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $function$
DECLARE
    result json;
BEGIN
    EXECUTE format('SELECT json_agg(t) FROM (%s) t', TRIM(TRAILING ';' FROM sql_string)) INTO result;
    RETURN COALESCE(result, '[]'::json);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('status', 'error', 'message', SQLERRM, 'detail', SQLSTATE);
END;
$function$;
