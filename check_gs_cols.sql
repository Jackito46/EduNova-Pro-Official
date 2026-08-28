SELECT json_agg(t) FROM (
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'global_settings'
) t;
