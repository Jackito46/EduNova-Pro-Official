SELECT json_agg(t) FROM (
  SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement, 
    action_orientation, 
    action_timing
  FROM information_schema.triggers
  WHERE event_object_table IN ('schools', 'profiles', 'academic_years')
) t;
