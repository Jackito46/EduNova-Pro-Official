SELECT 
    p.proname as function_name,
    pa.parameter_name,
    pa.data_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN LATERAL unnest(p.proargnames) WITH ORDINALITY AS pa(parameter_name, ord) ON true
WHERE n.nspname = 'public' AND p.proname = 'exec_sql';
