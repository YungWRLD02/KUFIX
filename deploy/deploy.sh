#!/usr/bin/env bash
# ============================================================
# KUFIX — Option 2 deployment helper
#
# This script is the single supported deployment path for the
# marketplace. It targets a persistent Node host (VPS /
# Railway / Fly.io / Render) so verification document uploads
# survive across deploys.
#
# Usage:
#   ./deploy/deploy.sh          # deploy from the current host
#   ./deploy/deploy.sh --build  # also run npm run build first
#   ./deploy/deploy.sh --migrate # also run drizzle-kit push
# ============================================================
set -euo pipefail

# Make sure we are inside the project root
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "ERROR: .env is missing. Copy .env.example to .env and fill in the values."
  exit 1
fi

# Confirm required secrets are present before touching anything.
for var in DATABASE_URL SESSION_SECRET; do
  if ! grep -q "^${var}=" .env; then
    echo "ERROR: ${var} is not set in .env"
    exit 1
  fi
done

if ! grep -q "^PAYSTACK_SECRET_KEY=" .env; then
  echo "NOTE: PAYSTACK_SECRET_KEY is not set — the wallet will use simulated payments."
fi

if [[ "${1:-}" == "--build" ]]; then
  echo "==> Building Next.js production bundle"
  npm run build
fi

if [[ "${1:-}" == "--migrate" ]]; then
  echo "==> Applying Drizzle schema"
  npx drizzle-kit push
fi

echo "==> Starting production server"
exec npm run start
