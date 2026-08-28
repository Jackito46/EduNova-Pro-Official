-- Check if the password is correct and the user is fully configured
SELECT 
    u.email,
    u.encrypted_password = extensions.crypt('admin123', u.encrypted_password) as is_password_admin123,
    u.email_confirmed_at IS NOT NULL as is_email_confirmed,
    u.banned_until,
    u.deleted_at,
    u.raw_app_meta_data,
    i.provider as identity_provider,
    p.role as profile_role,
    p.school_id,
    s.name as school_name,
    s.status as school_status,
    s.is_protected
FROM auth.users u
LEFT JOIN auth.identities i ON u.id = i.user_id
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.schools s ON p.school_id = s.id
WHERE u.email = 'jomo2004@gmail.com';
