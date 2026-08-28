SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    p.school_id,
    s.name as school_name,
    (SELECT count(*) FROM academic_years ay WHERE ay.school_id = p.school_id) as ay_count,
    (SELECT count(*) FROM classes c WHERE c.school_id = p.school_id) as class_count,
    (SELECT count(*) FROM subjects sub WHERE sub.school_id = p.school_id) as subject_count
FROM public.profiles p
LEFT JOIN public.schools s ON p.school_id = s.id
WHERE p.email = 'vilinfo2014@gmail.com';
