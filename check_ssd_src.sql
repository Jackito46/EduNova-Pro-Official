SELECT json_agg(t) FROM (
  SELECT proname, prosrc 
  FROM pg_proc 
  WHERE proname = 'seed_school_data'
) t;
