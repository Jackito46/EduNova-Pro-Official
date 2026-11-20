#!/usr/bin/env bash
# Clonage complet Supabase Cloud (Online, PG 15/16/17) -> Supabase Docker Local (Offline/LAN)
# Utilise un conteneur ephemera postgres:17-alpine pour pg_dump afin de supporter PG 17.x.
# Usage : bash deploy/local-lan/import-cloud-to-local.sh "postgresql://postgres.<ref>:<pass>@aws-1-...pooler.supabase.com:5432/postgres"

set -euo pipefail

CLOUD_DB_URL="${1:-}"
CONTAINER_NAME="${2:-edunova-db}"
BACKUP_DIR="${3:-./backups}"
PG_DUMP_IMAGE="${PG_DUMP_IMAGE:-postgres:17-alpine}"

if [[ -z "$CLOUD_DB_URL" ]]; then
  read -r -p "URI PostgreSQL Supabase Cloud (Session pooler) : " CLOUD_DB_URL
fi

if [[ ! "$CLOUD_DB_URL" =~ ^postgres(ql)?:// ]]; then
  echo "[ERREUR] URI PostgreSQL invalide."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
ABS_BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
TS="$(date +%Y-%m-%d_%H-%M-%S)"
PUBLIC_DUMP="cloud_public_${TS}.sql"
AUTH_DUMP="cloud_auth_${TS}.sql"

clean_pg17_for_pg15() {
  local file="$1"
  if [[ -f "$file" ]]; then
    sed -i.bak -E '/^[[:space:]]*\\(restrict|unrestrict)\b/d; /^[[:space:]]*SET[[:space:]]+transaction_timeout[[:space:]]*=/d' "$file"
    rm -f "${file}.bak"
  fi
}

echo "[1/5] Sauvegarde de securite locale..."
docker exec "$CONTAINER_NAME" pg_dumpall --clean --if-exists -U postgres -f /tmp/local_safety.sql
docker cp "${CONTAINER_NAME}:/tmp/local_safety.sql" "${ABS_BACKUP_DIR}/local_before_import_${TS}.sql"
docker exec "$CONTAINER_NAME" rm -f /tmp/local_safety.sql

echo "[2/5] Exportation du schema et des donnees 'public' via ${PG_DUMP_IMAGE}..."
docker run --rm -e "CLOUD_DB_URL=$CLOUD_DB_URL" -v "${ABS_BACKUP_DIR}:/out" "$PG_DUMP_IMAGE" \
  sh -c "pg_dump \"\$CLOUD_DB_URL\" --clean --if-exists --no-owner --no-privileges --schema=public -f \"/out/${PUBLIC_DUMP}\""
clean_pg17_for_pg15 "${ABS_BACKUP_DIR}/${PUBLIC_DUMP}"

echo "[3/5] Exportation des comptes 'auth.users' et 'auth.identities'..."
docker run --rm -e "CLOUD_DB_URL=$CLOUD_DB_URL" -v "${ABS_BACKUP_DIR}:/out" "$PG_DUMP_IMAGE" \
  sh -c "pg_dump \"\$CLOUD_DB_URL\" --data-only --column-inserts --on-conflict-do-nothing --disable-triggers -t auth.users -t auth.identities -f \"/out/${AUTH_DUMP}\"" || true
clean_pg17_for_pg15 "${ABS_BACKUP_DIR}/${AUTH_DUMP}"

echo "[4/5] Importation dans PostgreSQL local..."
docker cp "${ABS_BACKUP_DIR}/${PUBLIC_DUMP}" "${CONTAINER_NAME}:/tmp/cloud_public.sql"
[[ -f "${ABS_BACKUP_DIR}/${AUTH_DUMP}" ]] && docker cp "${ABS_BACKUP_DIR}/${AUTH_DUMP}" "${CONTAINER_NAME}:/tmp/cloud_auth.sql"
docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null || true
[[ -f "${ABS_BACKUP_DIR}/${AUTH_DUMP}" ]] && docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -f /tmp/cloud_auth.sql >/dev/null || true
docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -f /tmp/cloud_public.sql >/dev/null || true
docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" >/dev/null || true
docker exec "$CONTAINER_NAME" rm -f /tmp/cloud_public.sql /tmp/cloud_auth.sql

echo "[5/5] Redemarrage PostgREST & App..."
if [[ -f ".env.local" ]]; then
  docker compose -f docker-compose.local.yml --env-file .env.local restart edunova-rest edunova-app >/dev/null
fi

echo "Importation terminee ! Archives dans ${ABS_BACKUP_DIR}/cloud_*_${TS}.sql"
