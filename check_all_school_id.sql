SELECT json_agg(t) FROM (
  SELECT table_name, data_type 
  FROM information_schema.columns 
  WHERE column_name = 'school_id' 
  AND table_schema = 'public'
) t;
