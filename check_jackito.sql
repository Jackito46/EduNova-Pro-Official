SELECT json_agg(t) FROM (
  SELECT p.id, p.email, p.school_id, p.role
  FROM public.profiles p
  WHERE p.email = 'jackito46@gmail.com'
) t;
