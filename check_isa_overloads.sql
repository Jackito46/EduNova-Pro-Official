SELECT json_agg(t) FROM (
  SELECT proname, nspname, oidvectortypes(proargtypes) as argtypes 
  FROM pg_proc 
  JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
  WHERE proname = 'is_super_admin'
) t;
