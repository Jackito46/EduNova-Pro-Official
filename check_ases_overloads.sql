SELECT json_agg(t) FROM (
  SELECT proname, oid, oidvectortypes(proargtypes) as argtypes 
  FROM pg_proc 
  WHERE proname = 'admin_seed_existing_school'
) t;
