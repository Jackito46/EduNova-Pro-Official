#!/usr/bin/env bash
set -euo pipefail

# Restauration d'un fichier SQL (ou .sql.gz) dans PostgreSQL local (edunova-db)
# Usage : ./deploy/local-lan/restore-local.sh ./backups/edunova_backup_2026-11-17.sql.gz

if [ $# -lt 1 ]; then
  echo "Usage: $0 <chemin_fichier_sql_ou_gz>"
  exit 1
fi

INPUT_FILE="$1"
CONTAINER_NAME="${EDUNOVA_DB_CONTAINER:-edunova-db}"

if [ ! -f "$INPUT_FILE" ]; then
  echo "Fichier introuvable : $INPUT_FILE"
  exit 1
fi

echo "[EduNova Restore] Restauration de $INPUT_FILE vers $CONTAINER_NAME..."
if [[ "$INPUT_FILE" == *.gz ]]; then
  gzip -dc "$INPUT_FILE" | docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres
else
  docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres < "$INPUT_FILE"
fi

echo "[EduNova Restore] Rechargement du cache PostgREST..."
docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" >/dev/null || true

echo "[EduNova Restore] Restauration terminée avec succès."
