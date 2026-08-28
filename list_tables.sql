SELECT json_agg(t) FROM (
  SELECT tablename 
  FROM pg_tables 
  WHERE schemaname = 'public'
) t;
