SELECT json_agg(t) FROM (
  SELECT id, email, role, is_super_admin 
  FROM public.profiles 
  WHERE email = 'jackito46@gmail.com'
) t;
