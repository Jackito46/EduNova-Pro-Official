SELECT json_agg(t) FROM (
  SELECT viewname, definition 
  FROM pg_views 
  WHERE schemaname = 'public'
) t;
