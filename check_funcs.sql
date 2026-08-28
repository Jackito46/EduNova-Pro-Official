SELECT proname, prorettype::regtype 
FROM pg_proc 
WHERE proname LIKE 'get_my_school_id%';
