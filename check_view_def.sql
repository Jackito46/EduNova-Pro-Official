SELECT json_agg(t) FROM (
  SELECT definition 
  FROM pg_views 
  WHERE schemaname = 'public' AND viewname = 'v_schools_with_counts'
) t;
