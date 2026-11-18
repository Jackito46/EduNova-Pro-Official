#!/bin/sh
# Synchronise les mots de passe des rôles internes Supabase (GoTrue, PostgREST, Storage)
# avec POSTGRES_PASSWORD au premier démarrage du volume Docker PostgreSQL.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      EXECUTE format('ALTER ROLE supabase_auth_admin WITH PASSWORD %L', '$POSTGRES_PASSWORD');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
      EXECUTE format('ALTER ROLE authenticator WITH PASSWORD %L', '$POSTGRES_PASSWORD');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
      EXECUTE format('ALTER ROLE supabase_storage_admin WITH PASSWORD %L', '$POSTGRES_PASSWORD');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
      EXECUTE format('ALTER ROLE supabase_admin WITH PASSWORD %L', '$POSTGRES_PASSWORD');
    END IF;
  END
  \$\$;
EOSQL
