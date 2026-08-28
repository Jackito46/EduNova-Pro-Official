SELECT json_agg(t) FROM (
  SELECT s.id, s.name, 
         (SELECT count(*) FROM public.classes c WHERE c.school_id = s.id) as class_count,
         (SELECT count(*) FROM public.subjects sub WHERE sub.school_id = s.id) as subject_count
  FROM public.schools s
  ORDER BY s.created_at DESC
  LIMIT 3
) t;
