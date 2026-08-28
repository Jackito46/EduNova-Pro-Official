SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    p.school_id,
    s.name as school_name,
    s.global_settings::text as settings_text
FROM public.profiles p
LEFT JOIN public.schools s ON p.school_id = s.id
WHERE p.email = 'vilinfo2014@gmail.com';
