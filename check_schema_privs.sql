SELECT json_agg(t) FROM (
  SELECT schema_name, 
         pg_catalog.has_schema_privilege('authenticated', schema_name, 'USAGE') as authenticated_usage,
         pg_catalog.has_schema_privilege('anon', schema_name, 'USAGE') as anon_usage
  FROM information_schema.schemata
  WHERE schema_name = 'public'
) t;
