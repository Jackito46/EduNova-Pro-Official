SELECT json_agg(t) FROM (
  SELECT 
    tgname as trigger_name, 
    relname as table_name,
    proname as function_name
  FROM pg_trigger 
  JOIN pg_class ON pg_class.oid = tgrelid
  JOIN pg_proc ON pg_proc.oid = tgfoid
  WHERE relname IN ('profiles', 'schools', 'students')
) t;
