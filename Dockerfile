# Production image for Ghaltak (C1): one instance of `next start`, which
# applies pending migrations before it starts serving. Deploying, environment
# variables and rollback: docs/phase2/DEPLOY.md.
#
#   docker build -t ghaltak .
#   docker run --env-file .env.production -p 3000:3000 ghaltak
#
# Docker Hub and the npm registry can be slow or blocked from Iran. Both are
# build arguments so a mirror can be used, e.g.
#   --build-arg NODE_IMAGE=docker.arvancloud.ir/node:24-bookworm-slim
# No `# syntax=docker/dockerfile:1` line: it makes every build fetch the
# frontend from Docker Hub, which refuses servers in Iran (403), mirror or not.

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build
ARG NPM_REGISTRY=https://registry.npmjs.org/
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# OpenSSL here too: `npm ci` downloads Prisma's schema engine for the OpenSSL
# it finds. Without it Prisma picks the 1.1 engine, the runtime image (which
# has OpenSSL 3) wants another one, and tries to download it at startup into a
# node_modules it can't write to.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl   && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --registry="$NPM_REGISTRY"
COPY . .
# The build needs no database or secrets: every page that reads data renders
# on request. Environment variables are read at runtime, so one image works for
# staging and production.
RUN npm run db:generate && npm run build

FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
# OpenSSL for Prisma's schema engine (`prisma migrate deploy` at startup). The
# slim image has none, so Prisma can't tell which libssl it has, guesses 1.1
# (which bookworm doesn't ship) and the migration can fail to start.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
# All of node_modules, dev dependencies included: `prisma migrate deploy` needs
# the prisma CLI and dotenv (prisma7.config.ts) at startup.
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/next.config.ts /app/prisma7.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src/generated ./src/generated
COPY --from=build --chown=node:node /app/.next ./.next
# Hosts like Parspack (OpenShift) run the container as a random user in group
# 0, not as `node`. Everything the app writes at runtime must be writable by
# that group: Next.js's cache and the default upload folder.
RUN mkdir -p .next/cache uploads   && chgrp -R 0 .next/cache uploads && chmod -R g=u .next/cache uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Migrations first; if they fail the container exits instead of serving. With
# Liara's zero-downtime deploys (Silver/Gold bundles), the old version keeps
# serving until the new one is healthy. `exec` makes Next.js PID 1, so it gets
# SIGTERM and finishes in-flight requests before stopping.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && exec node node_modules/next/dist/bin/next start"]
