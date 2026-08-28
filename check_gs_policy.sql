SELECT json_agg(t) FROM (
  SELECT schemaname, tablename, policyname 
  FROM pg_policies 
  WHERE tablename = 'global_settings'
) t;
