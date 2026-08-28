SELECT json_agg(t) FROM (
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'global_settings'
) t;
