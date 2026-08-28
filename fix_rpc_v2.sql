-- DROP AND RECREATE RPC FUNCTION
DROP FUNCTION IF EXISTS public.exec_sql(text);
DROP FUNCTION IF EXISTS public.exec_sql_v2(text);

CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $function$
DECLARE
    result json;
BEGIN
    EXECUTE format('SELECT json_agg(t) FROM (%s) t', TRIM(TRAILING ';' FROM sql_query)) INTO result;
    RETURN COALESCE(result, '[]'::json);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('status', 'error', 'message', SQLERRM, 'detail', SQLSTATE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.exec_sql_v2(sql_string text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $function$
BEGIN
    RETURN public.exec_sql(sql_string);
END;
$function$;
