SELECT json_agg(t) FROM (
  SELECT id, name, student_count, staff_count 
  FROM public.v_schools_with_counts 
  ORDER BY name ASC 
  LIMIT 5
) t;
