SELECT json_agg(t) FROM (
  SELECT relname, relrowsecurity 
  FROM pg_class 
  WHERE relname = 'global_settings'
) t;
