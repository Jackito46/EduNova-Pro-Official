SELECT json_agg(t) FROM (
  SELECT proname, proargnames 
  FROM pg_proc 
  WHERE oid = 33512
) t;
