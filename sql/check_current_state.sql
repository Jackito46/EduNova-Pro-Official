-- Check current RLS policies and function owners
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename IN ('profiles', 'schools', 'audit_logs');

SELECT 
    p.proname as function_name,
    pg_get_userbyid(p.proowner) as owner,
    p.prosecdef as is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN ('is_super_admin', 'get_my_school_id', 'get_user_school_id', 'is_super_admin_safe');
