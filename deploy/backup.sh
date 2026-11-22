#!/usr/bin/env bash
set -euo pipefail

BASE=/root/mistbridge
BACKUP_DIR=/root/mistbridge-backups
STAMP=$(date +%Y%m%d-%H%M%S)
SNAPSHOT=".backup-${STAMP}.db"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# SQLite VACUUM INTO produces a consistent snapshot while the API stays online.
docker exec mistbridge-backend bun -e "import { Database } from 'bun:sqlite'; const db = new Database('/data/tunnel.db'); db.exec(\"VACUUM INTO '/data/${SNAPSHOT}'\"); db.close();"
install -m 600 "$BASE/data/${SNAPSHOT}" "$BACKUP_DIR/tunnel-${STAMP}.db"
rm -f "$BASE/data/${SNAPSHOT}"

# Keep the edge and console configuration beside the database backup.
tar -czf "$BACKUP_DIR/config-${STAMP}.tar.gz" \
  -C "$BASE" .env frps.toml docker-compose.yml deploy/nginx.conf deploy/security-headers.conf
chmod 600 "$BACKUP_DIR/config-${STAMP}.tar.gz"

# 14-day retention.
find "$BACKUP_DIR" -type f -name 'tunnel-*.db' -mtime +14 -delete
find "$BACKUP_DIR" -type f -name 'config-*.tar.gz' -mtime +14 -delete

echo "$(date -Is) backup completed: $BACKUP_DIR/tunnel-${STAMP}.db"
