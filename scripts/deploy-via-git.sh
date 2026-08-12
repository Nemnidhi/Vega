#!/usr/bin/env bash
# Git-clone-and-swap deploy for Vega production.
#
# Clones the latest master into a temp directory, builds it there, and only
# swaps it into place if the build succeeds - production is never touched by
# a failed build. Run this directly on the VPS as hrmsdeploy.
set -euo pipefail

APP_DIR="/home/hrmsdeploy/apps/hrms"
TMP_DIR="/home/hrmsdeploy/apps/hrms-deploy-$(date +%Y%m%d%H%M%S)"
BACKUP_DIR="/home/hrmsdeploy/apps/hrms-backup-$(date +%Y%m%d%H%M%S)"

echo "==> Cloning latest master into $TMP_DIR"
git clone --depth 1 --branch master https://github.com/Nemnidhi/Vega.git "$TMP_DIR"

echo "==> Copying env files"
cp "$APP_DIR/.env" "$TMP_DIR/.env"
cp "$APP_DIR/.env.local" "$TMP_DIR/.env.local"

cd "$TMP_DIR"
echo "==> Installing dependencies"
npm ci --no-audit --no-fund

echo "==> Building (production is untouched until this succeeds)"
npm run build

echo "==> Build succeeded - swapping into place"
mv "$APP_DIR" "$BACKUP_DIR"
mv "$TMP_DIR" "$APP_DIR"

echo "==> Restarting PM2"
pm2 restart hrms --update-env
pm2 save

echo "==> Health check"
sleep 5
curl --fail --show-error --silent --max-time 20 https://vega.nemnidhi.com/api/health
echo
echo "==> Deploy complete. Previous release backed up at: $BACKUP_DIR"
