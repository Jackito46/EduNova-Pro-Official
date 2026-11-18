#!/usr/bin/env bash
# Clonage complet Supabase Cloud (Online) -> Supabase Docker Local (Offline/LAN)
# Usage : bash deploy/local-lan/import-cloud-to-local.sh "postgresql://postgres.<ref>:<pass>@aws-0-...pooler.supabase.com:5432/postgres"

set -euo pipefail

CLOUD_DB_URL="${1:-}"
CONTAINER_NAME="${2:-edunova-db}"
BACKUP_DIR="${3:-./backups}"

if [[ -z "$CLOUD_DB_URL" ]]; then
  read -r -p "URI PostgreSQL Supabase Cloud (Session pooler) : " CLOUD_DB_URL
fi

if [[ ! "$CLOUD_DB_URL" =~ ^postgres(ql)?:// ]]; then
  echo "[ERREUR] URI PostgreSQL invalide."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y-%m-%d_%H-%M-%S)"

echo "[1/5] Sauvegarde de securite locale..."
docker exec "$CONTAINER_NAME" pg_dumpall --clean --if-exists -U postgres -f /tmp/local_safety.sql
docker cp "${CONTAINER_NAME}:/tmp/local_safety.sql" "${BACKUP_DIR}/local_before_import_${TS}.sql"
docker exec "$CONTAINER_NAME" rm -f /tmp/local_safety.sql

echo "[2/5] Exportation du schema et des donnees 'public' depuis Supabase Cloud..."
docker exec -e "CLOUD_DB_URL=$CLOUD_DB_URL" "$CONTAINER_NAME" \
  sh -c 'pg_dump "$CLOUD_DB_URL" --clean --if-exists --no-owner --no-privileges --schema=public -f /tmp/cloud_public.sql'
docker cp "${CONTAINER_NAME}:/tmp/cloud_public.sql" "${BACKUP_DIR}/cloud_public_${TS}.sql"

echo "[3/5] Exportation des comptes 'auth.users' et 'auth.identities'..."
docker exec -e "CLOUD_DB_URL=$CLOUD_DB_URL" "$CONTAINER_NAME" \
  sh -c 'pg_dump "$CLOUD_DB_URL" --data-only --inserts --on-conflict-do-nothing --disable-triggers -t auth.users -t auth.identities -t auth.mfa_factors -f /tmp/cloud_auth.sql || pg_dump "$CLOUD_DB_URL" --data-only --inserts --on-conflict-do-nothing --disable-triggers -t auth.users -t auth.identities -f /tmp/cloud_auth.sql'
docker cp "${CONTAINER_NAME}:/tmp/cloud_auth.sql" "${BACKUP_DIR}/cloud_auth_${TS}.sql"

echo "[4/5] Importation dans PostgreSQL local..."
docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -f /tmp/cloud_auth.sql >/dev/null
docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -f /tmp/cloud_public.sql >/dev/null
docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" >/dev/null
docker exec "$CONTAINER_NAME" rm -f /tmp/cloud_public.sql /tmp/cloud_auth.sql

echo "[5/5] Redemarrage PostgREST & App..."
if [[ -f ".env.local" ]]; then
  docker compose -f docker-compose.local.yml --env-file .env.local restart edunova-rest edunova-app >/dev/null
fi

echo "Importation terminee ! Archives dans ${BACKUP_DIR}/cloud_*_${TS}.sql"
