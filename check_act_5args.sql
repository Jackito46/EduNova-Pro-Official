SELECT json_agg(t) FROM (
  SELECT proname, prosrc 
  FROM pg_proc 
  WHERE oid = 33512
) t;
