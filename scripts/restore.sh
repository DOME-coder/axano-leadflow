#!/usr/bin/env bash
# Axano LeadFlow – PostgreSQL Restore
#
# Spielt eine gzippte pg_dump-Sicherung in die Datenbank zurueck.
# ACHTUNG: Dies ueberschreibt die aktuelle Datenbank. Immer zuerst im Staging
# ueben bevor Produktion restauriert wird.
#
# Einsatz:
#   ./scripts/restore.sh /var/backups/axano-leadflow/axano-leadflow-20260420-030000.sql.gz

set -euo pipefail

PROJEKT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${DB_NAME:-axano_leadflow}"
DB_USER="${DB_USER:-axano}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJEKT_ROOT/docker-compose.prod.yml}"

if [ $# -ne 1 ]; then
  echo "Benutzung: $0 <backup-datei.sql.gz>"
  exit 1
fi

BACKUP_DATEI="$1"

if [ ! -f "$BACKUP_DATEI" ]; then
  echo "Fehler: Backup-Datei nicht gefunden: $BACKUP_DATEI"
  exit 1
fi

echo "WARNUNG: Dies ueberschreibt die Datenbank '$DB_NAME' komplett."
read -rp "Fortfahren? Tippe 'JA' zur Bestaetigung: " bestaetigung
if [ "$bestaetigung" != "JA" ]; then
  echo "Abgebrochen."
  exit 0
fi

echo "[$(date --iso-8601=seconds)] Starte Restore aus $BACKUP_DATEI"

gunzip -c "$BACKUP_DATEI" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1

echo "[$(date --iso-8601=seconds)] Restore abgeschlossen"
echo "Hinweis: Starte das Backend neu (docker compose restart backend), damit Prisma wieder sauber verbindet."
