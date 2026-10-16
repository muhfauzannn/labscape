#!/bin/sh
set -eu

if [ ! -f "${LABAI_AUTH_DB:-/app/apps/web/data/auth.sqlite}" ] && [ -n "${SEED_EMAIL:-}" ] && [ -n "${SEED_PASSWORD:-}" ]; then
  pnpm --filter @labai/web seed:auth
fi

unset SEED_EMAIL SEED_PASSWORD SEED_NAME
exec pnpm start
