SELECT json_agg(t) FROM (
  SELECT id, email, role, school_id, created_at 
  FROM public.profiles 
  WHERE school_id IS NULL AND role != 'SUPER_ADMIN'
  ORDER BY created_at DESC
  LIMIT 10
) t;
