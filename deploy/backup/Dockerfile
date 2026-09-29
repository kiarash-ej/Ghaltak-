# Backup worker (C2): once a day, dumps the production database, encrypts
# the dump and copies it, with the app's files, to a backup bucket that lives
# apart from the database. Deployed as its own small app. See
# docs/phase2/DEPLOY.md, section 8.
#
# pg_dump must be at least the server's major version: production runs
# PostgreSQL 16 (DEPLOY.md, section 1).
ARG PG_IMAGE=postgres:16-bookworm
FROM ${PG_IMAGE}

# age: encryption to a public key, so this container can't read old backups.
# rclone: copies to and from any S3-compatible storage.
# busybox: a tiny web server for the status page and health check.
RUN apt-get update \
 && apt-get install -y --no-install-recommends age rclone busybox ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY backup.sh restore.sh /usr/local/bin/
# Strip Windows line endings too, in case the files were copied from a Windows
# checkout without .gitattributes (liara deploy uploads the working copy).
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh /usr/local/bin/restore.sh \
 && chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh \
 && mkdir -p /srv/status && chown postgres:postgres /srv/status

USER postgres
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s \
  CMD busybox wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1
ENTRYPOINT []
CMD ["backup.sh", "daemon"]
