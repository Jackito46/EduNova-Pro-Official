SELECT json_agg(t) FROM (
  SELECT proname, oid, oidvectortypes(proargtypes) as argtypes 
  FROM pg_proc 
  WHERE proname = 'admin_create_tenant'
) t;
