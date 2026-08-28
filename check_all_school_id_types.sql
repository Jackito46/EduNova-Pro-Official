SELECT json_agg(t) FROM (
  SELECT table_name, column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND column_name = 'school_id'
) t;
