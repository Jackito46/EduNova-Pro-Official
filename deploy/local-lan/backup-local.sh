#!/usr/bin/env bash
set -euo pipefail

# Sauvegarde complète de la base PostgreSQL locale (données + utilisateurs GoTrue + schéma)
# Crée un dump horodaté dans ./backups et conserve les 30 dernières sauvegardes.

BACKUP_DIR="${1:-./backups}"
CONTAINER_NAME="${EDUNOVA_DB_CONTAINER:-edunova-db}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUT_FILE="${BACKUP_DIR}/edunova_backup_${STAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "[EduNova Backup] Exportation de PostgreSQL depuis le conteneur ${CONTAINER_NAME}..."
docker exec -t "${CONTAINER_NAME}" pg_dumpall --clean --if-exists -U postgres > "${OUT_FILE}"

if command -v gzip >/dev/null 2>&1; then
  gzip -f "${OUT_FILE}"
  OUT_FILE="${OUT_FILE}.gz"
fi

echo "[EduNova Backup] Sauvegarde créée : ${OUT_FILE}"

# Rotation : supprimer les sauvegardes de plus de 30 jours
find "$BACKUP_DIR" -type f -name "edunova_backup_*.sql*" -mtime +30 -delete 2>/dev/null || true
echo "[EduNova Backup] Terminé."
