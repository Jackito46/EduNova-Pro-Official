SELECT json_agg(t) FROM (
  SELECT 
    public.is_super_admin() as is_admin,
    public.get_my_school_id_safe() as school_id,
    auth.jwt() ->> 'email' as jwt_email
) t;
