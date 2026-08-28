SELECT json_agg(routine_name) FROM information_schema.routines WHERE routine_schema = 'public'
