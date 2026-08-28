SELECT json_agg(t) FROM (
  SELECT proname, prosrc 
  FROM pg_proc 
  WHERE proname = 'handle_new_user'
) t;
