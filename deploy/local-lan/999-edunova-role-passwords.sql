-- Synchronise les mots de passe des roles internes Supabase avec POSTGRES_PASSWORD
-- Execute automatiquement par migrate.sh a la fin de /docker-entrypoint-initdb.d/init-scripts/
\set pgpass `echo "$POSTGRES_PASSWORD"`

SELECT format('ALTER ROLE %I WITH PASSWORD %L;', rolname, :'pgpass')
FROM pg_roles
WHERE rolname IN (
  'postgres',
  'supabase_admin',
  'supabase_auth_admin',
  'authenticator',
  'supabase_storage_admin',
  'pgbouncer'
)
\gexec
