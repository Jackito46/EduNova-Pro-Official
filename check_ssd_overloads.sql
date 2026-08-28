SELECT json_agg(t) FROM (
  SELECT proname, oid, oidvectortypes(proargtypes) as argtypes 
  FROM pg_proc 
  WHERE proname = 'seed_school_data'
) t;
