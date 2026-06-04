#!/bin/bash
# ─── ERP Hax — Daily PostgreSQL Backup → Google Drive ────────────────────────
# Cron: 0 2 * * * /mnt/volume-us-dodso/var/www/erp-hax/scripts/backup-db.sh
#
# - Dump local → gzip (permisos 600)
# - Sube a gdrive:ERP-HAX-Backups/
# - Retiene 7 backups locales, 30 en Drive

BACKUP_DIR="/mnt/volume-us-dodso/var/www/erp-hax/backups"
DRIVE_REMOTE="gdrive:ERP-HAX-Backups"
DATE=$(date +%Y-%m-%d_%H-%M)
FILE="$BACKUP_DIR/erp_hax_$DATE.sql.gz"
KEEP_LOCAL=7
KEEP_DRIVE=30
RCLONE="$HOME/bin/rclone"

# ── DB_URL: leer desde variable de entorno o desde .env (nunca hardcodear) ────
ENV_FILE="/mnt/volume-us-dodso/var/www/erp-hax/apps/api/.env"
if [ -z "$DATABASE_URL" ] && [ -f "$ENV_FILE" ]; then
  DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
if [ -z "$DATABASE_URL" ]; then
  echo "[$(date)] ❌ DATABASE_URL no definida — abortando backup"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ── 1. Dump ───────────────────────────────────────────────────────────────────
echo "[$(date)] 🗄️  Iniciando backup..."
pg_dump "$DATABASE_URL" | gzip > "$FILE"

if [ ${PIPESTATUS[0]} -ne 0 ] || [ ! -s "$FILE" ]; then
  echo "[$(date)] ❌ pg_dump falló"
  rm -f "$FILE"
  exit 1
fi

# Permisos restrictivos: solo el propietario puede leer el backup
chmod 600 "$FILE"

SIZE=$(du -sh "$FILE" | cut -f1)
echo "[$(date)] ✅ Dump local: $FILE ($SIZE)"

# ── 2. Subir a Drive ──────────────────────────────────────────────────────────
echo "[$(date)] ☁️  Subiendo a Google Drive..."
$RCLONE copy "$FILE" "$DRIVE_REMOTE/" --log-level INFO 2>&1

if [ $? -eq 0 ]; then
  echo "[$(date)] ✅ Subido a Drive: $DRIVE_REMOTE/$(basename $FILE)"
else
  echo "[$(date)] ⚠️  Error subiendo a Drive (backup local conservado)"
fi

# ── 3. Limpiar locales > KEEP_LOCAL días ─────────────────────────────────────
find "$BACKUP_DIR" -name "erp_hax_*.sql.gz" -mtime +$KEEP_LOCAL -delete
echo "[$(date)] 🧹 Locales conservados (últimos $KEEP_LOCAL días):"
ls -lht "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -5

# ── 4. Limpiar Drive > KEEP_DRIVE archivos ────────────────────────────────────
DRIVE_COUNT=$($RCLONE ls "$DRIVE_REMOTE/" 2>/dev/null | grep "erp_hax_" | wc -l)
if [ "$DRIVE_COUNT" -gt "$KEEP_DRIVE" ]; then
  OLDEST=$($RCLONE ls "$DRIVE_REMOTE/" 2>/dev/null | grep "erp_hax_" | sort | head -1 | awk '{print $2}')
  $RCLONE deletefile "$DRIVE_REMOTE/$OLDEST" 2>/dev/null
  echo "[$(date)] 🗑️  Eliminado de Drive el más antiguo: $OLDEST"
fi

echo "[$(date)] ✅ Backup completado. Drive tiene $DRIVE_COUNT archivos."
