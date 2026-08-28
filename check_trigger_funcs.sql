SELECT json_agg(t) FROM (
  SELECT proname, prosrc 
  FROM pg_proc 
  WHERE proname IN ('check_max_admins', 'set_active_academic_year')
) t;
