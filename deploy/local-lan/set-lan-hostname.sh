#!/usr/bin/env bash
set -euo pipefail

# Configure le nom d'hote reseau local (.local / mDNS via Avahi) pour serveur Linux / Ubuntu
# Usage : sudo bash deploy/local-lan/set-lan-hostname.sh edunova-server

RAW_NAME="${1:-edunova-server}"
SHORT_NAME="$(echo "$RAW_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#[:/].*$##; s#\.local$##; s#[^a-z0-9-]+#-#g; s#^-+|-+$##')"
if [ -z "$SHORT_NAME" ]; then
  SHORT_NAME="edunova-server"
fi
FQDN_LOCAL="${SHORT_NAME}.local"
APP_PORT="${APP_PORT:-3000}"
LOCAL_URL="http://${FQDN_LOCAL}:${APP_PORT}"

echo "[EduNova Hostname] Configuration de ${FQDN_LOCAL}..."

if command -v hostnamectl >/dev/null 2>&1; then
  hostnamectl set-hostname "${SHORT_NAME}" || true
fi

if systemctl list-unit-files 2>/dev/null | grep -q avahi-daemon; then
  systemctl enable --now avahi-daemon || true
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 5353/udp >/dev/null || true
fi

if [ -f ".env.local" ]; then
  if grep -q '^LAN_HOSTNAME=' .env.local; then
    sed -i "s#^LAN_HOSTNAME=.*#LAN_HOSTNAME=${FQDN_LOCAL}#" .env.local
  else
    echo "LAN_HOSTNAME=${FQDN_LOCAL}" >> .env.local
  fi

  if grep -q '^ADDITIONAL_REDIRECT_URLS=' .env.local; then
    if ! grep -q "${LOCAL_URL}/\*" .env.local; then
      sed -i "s#^ADDITIONAL_REDIRECT_URLS=\(.*\)#ADDITIONAL_REDIRECT_URLS=\1,${LOCAL_URL}/*#" .env.local
    fi
  fi

  if command -v docker >/dev/null 2>&1 && [ -f "docker-compose.local.yml" ]; then
    docker compose -f docker-compose.local.yml --env-file .env.local up -d edunova-auth edunova-app || true
  fi
fi

echo "[EduNova Hostname] Termine ! Adresse reseau : ${LOCAL_URL}"
