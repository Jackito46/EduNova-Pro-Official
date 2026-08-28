SELECT json_agg(t) FROM (
  SELECT schemaname, tablename, policyname, qual, with_check 
  FROM pg_policies 
  WHERE tablename = 'audit_logs'
) t;
