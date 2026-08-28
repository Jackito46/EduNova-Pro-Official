SELECT id, email, full_name, role, is_super_admin, is_active, status, school_id FROM public.profiles WHERE email ILIKE '%jackito%' OR is_super_admin = true;
