#!/usr/bin/env bash
# Daily backup (C2). docs/phase2/DEPLOY.md, section 8.
#
#   backup.sh run            one backup now
#   backup.sh daemon         status page on $PORT, and one backup a day at $BACKUP_AT (UTC)
#   backup.sh rclone <args>  rclone with the "backup" and "app" remotes (restoring files)
#
# Each backup:
#   1. counts a few tables (to compare after a restore)
#   2. pg_dump in custom format, checked with pg_restore --list
#   3. encrypted with age to BACKUP_AGE_RECIPIENT (a PUBLIC key: this container
#      can write backups but never read them)
#   4. uploaded to the backup bucket as db/YYYY/MM/ghaltak-<UTC time>.dump.age
#   5. the app's two buckets copied to files/public and files/private
#      (copy, never sync: a file deleted in the app stays in the backup)
#   6. dumps older than BACKUP_RETENTION_DAYS deleted
#
# Environment (set in the host's panel, never in the repo):
#   DATABASE_URL                        same as the app
#   BACKUP_AGE_RECIPIENT                age public key, "age1..."
#   BACKUP_S3_ENDPOINT, BACKUP_S3_REGION (default "default"),
#   BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY, BACKUP_S3_BUCKET
#   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
#   S3_BUCKET_PUBLIC, S3_BUCKET_PRIVATE  the app's storage; optional (no file copy without them)
#   BACKUP_RETENTION_DAYS               default 30
#   BACKUP_AT                           daily time in UTC, default 23:30 (03:00 Tehran)
set -euo pipefail

log() { echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }
fail() { log "ERROR: $*"; exit 1; }

require() {
  local name
  for name in "$@"; do
    [ -n "${!name:-}" ] || fail "$name is not set"
  done
}

# Prisma's connection string has "?schema=public", which libpq rejects.
pg_url() { printf '%s' "${DATABASE_URL%%\?*}"; }

# rclone remotes from environment variables, so no config file holds secrets.
configure_rclone() {
  export RCLONE_CONFIG_BACKUP_TYPE=s3 RCLONE_CONFIG_BACKUP_PROVIDER=Other
  export RCLONE_CONFIG_BACKUP_ENDPOINT="$BACKUP_S3_ENDPOINT"
  export RCLONE_CONFIG_BACKUP_REGION="${BACKUP_S3_REGION:-default}"
  export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
  export RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_BACKUP_FORCE_PATH_STYLE=true
  # The bucket already exists; don't try to create it.
  export RCLONE_CONFIG_BACKUP_NO_CHECK_BUCKET=true
  if [ -n "${S3_ENDPOINT:-}" ]; then
    export RCLONE_CONFIG_APP_TYPE=s3 RCLONE_CONFIG_APP_PROVIDER=Other
    export RCLONE_CONFIG_APP_ENDPOINT="$S3_ENDPOINT"
    export RCLONE_CONFIG_APP_REGION="${S3_REGION:-default}"
    export RCLONE_CONFIG_APP_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}"
    export RCLONE_CONFIG_APP_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}"
    export RCLONE_CONFIG_APP_FORCE_PATH_STYLE=true
    export RCLONE_CONFIG_APP_NO_CHECK_BUCKET=true
  fi
}

COUNTS_SQL='SELECT (SELECT count(*) FROM "Seller") AS sellers,
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "Customer") AS customers,
  (SELECT count(*) FROM "Order") AS orders,
  (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations'

write_status() {
  printf '%s\n' "$1" > /srv/status/index.html
}

run_backup() {
  require DATABASE_URL BACKUP_AGE_RECIPIENT BACKUP_S3_ENDPOINT BACKUP_S3_ACCESS_KEY_ID \
    BACKUP_S3_SECRET_ACCESS_KEY BACKUP_S3_BUCKET
  configure_rclone

  local started stamp month work dump name
  started=$(date +%s)
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  month=$(date -u +%Y/%m)
  name="ghaltak-$stamp"
  work=$(mktemp -d)
  trap 'rm -rf "$work"' RETURN

  log "counting rows"
  psql "$(pg_url)" -X -A -F ',' -P footer=off -c "$COUNTS_SQL" > "$work/$name.counts.csv"

  log "dumping the database"
  dump="$work/$name.dump"
  pg_dump "$(pg_url)" --format=custom --no-owner --no-privileges --file="$dump"
  # A dump pg_restore can't read is not a backup.
  pg_restore --list "$dump" > /dev/null
  [ -s "$dump" ] || fail "empty dump"

  log "encrypting ($(du -h "$dump" | cut -f1))"
  age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$dump.age" "$dump"
  rm -f "$dump"

  log "uploading db/$month/$name.dump.age"
  rclone copyto "$dump.age" "backup:$BACKUP_S3_BUCKET/db/$month/$name.dump.age"
  rclone copyto "$work/$name.counts.csv" "backup:$BACKUP_S3_BUCKET/db/$month/$name.counts.csv"

  if [ -n "${S3_ENDPOINT:-}" ] && [ -n "${S3_BUCKET_PUBLIC:-}" ] && [ -n "${S3_BUCKET_PRIVATE:-}" ]; then
    log "copying the app's files"
    rclone copy "app:$S3_BUCKET_PUBLIC" "backup:$BACKUP_S3_BUCKET/files/public"
    rclone copy "app:$S3_BUCKET_PRIVATE" "backup:$BACKUP_S3_BUCKET/files/private"
  else
    log "S3_* not set: files are not copied"
  fi

  local keep="${BACKUP_RETENTION_DAYS:-30}"
  log "deleting dumps older than $keep days"
  rclone delete --min-age "${keep}d" "backup:$BACKUP_S3_BUCKET/db"

  local seconds=$(( $(date +%s) - started ))
  log "done in ${seconds}s: $name"
  write_status "ok $(date -u +%Y-%m-%dT%H:%M:%SZ) $name (${seconds}s)"
}

seconds_until() {
  # Seconds from now until the next $1 (HH:MM, UTC).
  local now target
  now=$(date -u +%s)
  target=$(date -u -d "today $1" +%s)
  [ "$target" -gt "$now" ] || target=$(date -u -d "tomorrow $1" +%s)
  echo $(( target - now ))
}

daemon() {
  local at="${BACKUP_AT:-23:30}"
  date -u -d "today $at" > /dev/null 2>&1 || fail "BACKUP_AT must be HH:MM (UTC), got \"$at\""
  write_status "waiting: no backup yet since start; next at $at UTC"
  busybox httpd -p "${PORT:-8080}" -h /srv/status
  log "status page on port ${PORT:-8080}; daily backup at $at UTC"
  while true; do
    sleep "$(seconds_until "$at")"
    # A failed backup is logged and shown on the status page; the next day tries again.
    if ! (run_backup); then
      write_status "FAILED $(date -u +%Y-%m-%dT%H:%M:%SZ): see the logs"
    fi
  done
}

case "${1:-}" in
  run) run_backup ;;
  daemon) daemon ;;
  # rclone with the "backup" and "app" remotes set up, e.g. to copy files back
  # after a loss: backup.sh rclone copy backup:<bucket>/files/public app:<bucket>
  rclone) shift; require BACKUP_S3_ENDPOINT BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY; configure_rclone; exec rclone "$@" ;;
  *) echo "usage: backup.sh run|daemon|rclone <args>" >&2; exit 2 ;;
esac
