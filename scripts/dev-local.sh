#!/usr/bin/env bash
# Run a command locally with the aitorah service's secrets from Railway (API keys etc., injected in memory,
# never written to disk), but pointed at the LOCAL Docker Postgres and without production Redis.
#
#   scripts/dev-local.sh npm run dev
#   scripts/dev-local.sh npx drizzle-kit migrate
#
# Local Postgres (first time):
#   docker run -d --name aitorah-pg -e POSTGRES_PASSWORD=local -e POSTGRES_DB=aitorah \
#     -p 5433:5432 -v aitorah-pg-data:/var/lib/postgresql/data postgres:16-alpine
# (If `docker pull` hangs, the Docker Desktop credential helper is stuck; public images can be pulled with
#  DOCKER_CONFIG=$(mktemp -d) DOCKER_HOST=unix://$HOME/.docker/run/docker.sock docker pull postgres:16-alpine)
set -euo pipefail
LOCAL_DB="${LOCAL_DATABASE_URL:-postgres://postgres:local@localhost:5433/aitorah}"
exec railway run --service aitorah -- env \
  DATABASE_URL="$LOCAL_DB" \
  REDIS_URL= \
  NEXTAUTH_URL=http://localhost:3000 \
  AUTH_URL=http://localhost:3000 \
  "$@"
