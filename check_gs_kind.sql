SELECT json_agg(t) FROM (
  SELECT n.nspname as schema_name, c.relname as table_name, c.relkind as kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'global_settings'
) t;
