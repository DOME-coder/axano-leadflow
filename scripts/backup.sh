#!/usr/bin/env bash
# Axano LeadFlow – PostgreSQL Backup
#
# Erstellt eine gzippte pg_dump-Sicherung der Produktionsdatenbank und legt sie
# im BACKUP_DIR ab. Behält standardmaessig die letzten 14 Backups.
#
# Voraussetzung: docker-compose.prod.yml liegt im Projekt-Root und der
# postgres-Service heisst "postgres" mit DB "axano_leadflow" (User "axano").
#
# Einsatz (Cron, taeglich 03:00 Uhr):
#   0 3 * * * /opt/axano-leadflow/scripts/backup.sh >> /var/log/axano-backup.log 2>&1

set -euo pipefail

PROJEKT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/axano-leadflow}"
DB_NAME="${DB_NAME:-axano_leadflow}"
DB_USER="${DB_USER:-axano}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJEKT_ROOT/docker-compose.prod.yml}"
AUFBEWAHRUNGS_TAGE="${AUFBEWAHRUNGS_TAGE:-14}"

mkdir -p "$BACKUP_DIR"

ZEITSTEMPEL="$(date +%Y%m%d-%H%M%S)"
DATEINAME="$BACKUP_DIR/axano-leadflow-$ZEITSTEMPEL.sql.gz"

echo "[$(date --iso-8601=seconds)] Starte Backup nach $DATEINAME"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner \
  | gzip -9 > "$DATEINAME"

GROESSE="$(du -h "$DATEINAME" | cut -f1)"
echo "[$(date --iso-8601=seconds)] Backup abgeschlossen – $DATEINAME ($GROESSE)"

# Alte Backups loeschen
find "$BACKUP_DIR" -name 'axano-leadflow-*.sql.gz' -mtime +"$AUFBEWAHRUNGS_TAGE" -delete
ANZAHL="$(find "$BACKUP_DIR" -name 'axano-leadflow-*.sql.gz' | wc -l | tr -d ' ')"
echo "[$(date --iso-8601=seconds)] Aufbewahrung: $ANZAHL Backups vorhanden (max $AUFBEWAHRUNGS_TAGE Tage)"
