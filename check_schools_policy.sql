SELECT json_agg(t) FROM (
  SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
  FROM pg_policies 
  WHERE tablename = 'schools'
) t;
