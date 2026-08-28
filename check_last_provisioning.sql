SELECT json_agg(t) FROM (
  SELECT s.id as school_id, s.name as school_name, p.id as profile_id, p.email, p.role, p.school_id as profile_school_id
  FROM public.schools s
  LEFT JOIN public.profiles p ON p.school_id::text = s.id::text
  ORDER BY s.created_at DESC
  LIMIT 5
) t;
