#!/bin/bash
# ─── ERP Hax — Daily PostgreSQL Backup → Google Drive ────────────────────────
# Cron: 0 2 * * * /mnt/volume-us-dodso/var/www/erp-hax/scripts/backup-db.sh
#
# - Dump local → gzip
# - Sube a gdrive:ERP-HAX-Backups/
# - Retiene 7 backups locales, 30 en Drive

BACKUP_DIR="/mnt/volume-us-dodso/var/www/erp-hax/backups"
DB_URL="postgresql://hax_user:d6NkFj9l4pEsMbnpllOqERCbTvjjwia5@localhost:5432/erp_hax"
DRIVE_REMOTE="gdrive:ERP-HAX-Backups"
DATE=$(date +%Y-%m-%d_%H-%M)
FILE="$BACKUP_DIR/erp_hax_$DATE.sql.gz"
KEEP_LOCAL=7
KEEP_DRIVE=30
RCLONE="$HOME/bin/rclone"

mkdir -p "$BACKUP_DIR"

# ── 1. Dump ───────────────────────────────────────────────────────────────────
echo "[$(date)] 🗄️  Iniciando backup..."
pg_dump "$DB_URL" | gzip > "$FILE"

if [ ${PIPESTATUS[0]} -ne 0 ] || [ ! -s "$FILE" ]; then
  echo "[$(date)] ❌ pg_dump falló"
  rm -f "$FILE"
  exit 1
fi

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
