#!/usr/bin/env bash
# Restores a backup into an EMPTY database, for the monthly restore test or a
# real recovery (C2). docs/phase2/DEPLOY.md, section 8.
#
#   restore.sh latest
#   restore.sh db/2026/09/ghaltak-20260925T233000Z.dump.age
#
# Environment:
#   TARGET_DATABASE_URL   the database to restore INTO. Must be empty, and must
#                         not be DATABASE_URL (refused otherwise).
#   BACKUP_AGE_IDENTITY   the age PRIVATE key ("AGE-SECRET-KEY-1..."), from the
#                         owner's password manager. Only for the time of the restore.
#   BACKUP_S3_*           as in backup.sh
#
# Prints the row counts of the restored database next to the counts taken
# when the backup was made, and how long the restore took.
set -euo pipefail

log() { echo "[restore] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }
fail() { log "ERROR: $*"; exit 1; }

for name in TARGET_DATABASE_URL BACKUP_AGE_IDENTITY BACKUP_S3_ENDPOINT BACKUP_S3_ACCESS_KEY_ID \
  BACKUP_S3_SECRET_ACCESS_KEY BACKUP_S3_BUCKET; do
  [ -n "${!name:-}" ] || fail "$name is not set"
done
[ $# -eq 1 ] || { echo "usage: restore.sh latest|<key>" >&2; exit 2; }

target="${TARGET_DATABASE_URL%%\?*}"
if [ -n "${DATABASE_URL:-}" ] && [ "$target" = "${DATABASE_URL%%\?*}" ]; then
  fail "TARGET_DATABASE_URL is the production database. Restore into a new, empty one."
fi
tables=$(psql "$target" -X -A -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
[ "$tables" = "0" ] || fail "the target database is not empty ($tables tables). Restore into a new, empty one."

export RCLONE_CONFIG_BACKUP_TYPE=s3 RCLONE_CONFIG_BACKUP_PROVIDER=Other
export RCLONE_CONFIG_BACKUP_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_BACKUP_REGION="${BACKUP_S3_REGION:-default}"
export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_BACKUP_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_BACKUP_NO_CHECK_BUCKET=true

key="$1"
if [ "$key" = "latest" ]; then
  # Names hold the UTC time, so the last one in sort order is the newest.
  key=$(rclone lsf -R --files-only "backup:$BACKUP_S3_BUCKET/db" | grep '\.dump\.age$' | sort | tail -n 1 || true)
  [ -n "$key" ] || fail "no backups found in $BACKUP_S3_BUCKET/db"
  key="db/$key"
fi

started=$(date +%s)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
umask 077
printf '%s\n' "$BACKUP_AGE_IDENTITY" > "$work/identity"

log "downloading $key"
rclone copyto "backup:$BACKUP_S3_BUCKET/$key" "$work/backup.dump.age"
rclone copyto "backup:$BACKUP_S3_BUCKET/${key%.dump.age}.counts.csv" "$work/counts.csv" 2>/dev/null \
  || echo "(no counts file)" > "$work/counts.csv"

log "decrypting"
age --decrypt --identity "$work/identity" --output "$work/backup.dump" "$work/backup.dump.age"

log "restoring"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$target" "$work/backup.dump"

seconds=$(( $(date +%s) - started ))
echo
echo "counts when the backup was made:"
cat "$work/counts.csv"
echo "counts in the restored database:"
psql "$target" -X -A -F ',' -P footer=off -c 'SELECT (SELECT count(*) FROM "Seller") AS sellers,
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "Customer") AS customers,
  (SELECT count(*) FROM "Order") AS orders,
  (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations'
echo
log "restored $key in ${seconds}s"
