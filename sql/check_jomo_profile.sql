-- Check if jomo2004@gmail.com has a profile
SELECT 
    u.id as user_id,
    u.email,
    p.id as profile_id,
    p.school_id,
    s.name as school_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.schools s ON p.school_id = s.id
WHERE u.email = 'jomo2004@gmail.com';
