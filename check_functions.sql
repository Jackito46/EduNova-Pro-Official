SELECT json_agg(t) FROM (
  SELECT proname, prosrc 
  FROM pg_proc 
  WHERE proname LIKE 'get_my_school_id%'
) t;
