SELECT json_agg(t) FROM (
  SELECT proname, rolname 
  FROM pg_proc p 
  JOIN pg_roles r ON p.proowner = r.oid 
  WHERE proname IN ('get_my_school_id', 'get_my_school_id_safe', 'is_super_admin')
) t;
