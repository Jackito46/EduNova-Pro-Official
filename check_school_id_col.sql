SELECT json_agg(t) FROM (
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'schools' 
  AND column_name = 'id'
) t;
