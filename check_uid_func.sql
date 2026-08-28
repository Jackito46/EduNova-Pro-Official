SELECT json_agg(t) FROM (
  SELECT proname, nspname 
  FROM pg_proc 
  JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
  WHERE proname = 'uid'
) t;
