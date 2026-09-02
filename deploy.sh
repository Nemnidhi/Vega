#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

REMOTE_USER="${REMOTE_USER:-hrmsdeploy}"
REMOTE_HOST="${REMOTE_HOST:-72.60.97.58}"
REMOTE_PORT="${REMOTE_PORT:-2424}"
REMOTE_APPS_DIR="${REMOTE_APPS_DIR:-/home/hrmsdeploy/apps}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-$REMOTE_APPS_DIR/hrms}"
REMOTE_ARCHIVE="${REMOTE_ARCHIVE:-$REMOTE_APPS_DIR/hrms-app-latest.tar.gz}"
PM2_APP_NAME="${PM2_APP_NAME:-hrms}"
APP_PORT="${APP_PORT:-5600}"
APP_HOST="${APP_HOST:-0.0.0.0}"
HEALTH_URL="${HEALTH_URL:-https://vega.nemnidhi.com/api/health}"

INSTALL_DEPS=true
BUILD_APP=true
RUN_HEALTH_CHECK=true

for arg in "$@"; do
  case "$arg" in
    --skip-install)
      INSTALL_DEPS=false
      ;;
    --skip-build)
      BUILD_APP=false
      ;;
    --skip-health)
      RUN_HEALTH_CHECK=false
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: ./deploy.sh [--skip-install] [--skip-build] [--skip-health]"
      exit 1
      ;;
  esac
done

if ! command -v tar >/dev/null 2>&1; then
  echo "tar is required but was not found."
  exit 1
fi

if ! command -v scp >/dev/null 2>&1; then
  echo "scp is required but was not found."
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required but was not found."
  exit 1
fi

DEPLOY_STAMP="$(date +%Y%m%d%H%M%S)"
TMP_DIR="${TMPDIR:-/tmp}/hrms-deploy-$DEPLOY_STAMP"
ARCHIVE_PATH="$TMP_DIR/hrms-app.tar.gz"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TMP_DIR"

echo "==> Starting deploy from: $ROOT_DIR"

echo "==> Creating deployment archive"
tar \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude=".next" \
  --exclude="backups" \
  --exclude="tsconfig.tsbuildinfo" \
  --exclude=".env" \
  --exclude=".env.local" \
  -czf "$ARCHIVE_PATH" .

echo "==> Uploading archive to $REMOTE_USER@$REMOTE_HOST:$REMOTE_ARCHIVE"
scp -P "$REMOTE_PORT" "$ARCHIVE_PATH" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_ARCHIVE"

REMOTE_INSTALL_DEPS="$INSTALL_DEPS"
REMOTE_BUILD_APP="$BUILD_APP"
REMOTE_RUN_HEALTH_CHECK="$RUN_HEALTH_CHECK"

echo "==> Installing latest release on VPS"
ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" \
  "REMOTE_APPS_DIR='$REMOTE_APPS_DIR' REMOTE_APP_DIR='$REMOTE_APP_DIR' REMOTE_ARCHIVE='$REMOTE_ARCHIVE' PM2_APP_NAME='$PM2_APP_NAME' APP_PORT='$APP_PORT' APP_HOST='$APP_HOST' HEALTH_URL='$HEALTH_URL' INSTALL_DEPS='$REMOTE_INSTALL_DEPS' BUILD_APP='$REMOTE_BUILD_APP' RUN_HEALTH_CHECK='$REMOTE_RUN_HEALTH_CHECK' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

cd "$REMOTE_APPS_DIR"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_DIR=""

if [ -d "$REMOTE_APP_DIR" ]; then
  BACKUP_DIR="$REMOTE_APP_DIR-backup-$STAMP"
  echo "==> Backing up current release to: $BACKUP_DIR"
  mv "$REMOTE_APP_DIR" "$BACKUP_DIR"
fi

mkdir -p "$REMOTE_APP_DIR"
tar -xzf "$REMOTE_ARCHIVE" -C "$REMOTE_APP_DIR"
cd "$REMOTE_APP_DIR"

if [ -n "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/.env" ]; then
  cp "$BACKUP_DIR/.env" "$REMOTE_APP_DIR/.env"
fi

if [ -n "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/.env.local" ]; then
  cp "$BACKUP_DIR/.env.local" "$REMOTE_APP_DIR/.env.local"
fi

if [ ! -f "$REMOTE_APP_DIR/.env" ] || [ ! -f "$REMOTE_APP_DIR/.env.local" ]; then
  echo "Missing production env files on the VPS. Restore .env and .env.local before deploying."
  exit 1
fi

chmod 600 "$REMOTE_APP_DIR/.env" "$REMOTE_APP_DIR/.env.local"

if [ "$INSTALL_DEPS" = "true" ]; then
  echo "==> Installing dependencies"
  npm ci --no-audit --no-fund
else
  echo "==> Skipping dependency install"
fi

if [ "$BUILD_APP" = "true" ]; then
  echo "==> Building app"
  npm run build
else
  echo "==> Skipping build"
fi

echo "==> Restarting PM2 app: $PM2_APP_NAME"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env
else
  pm2 start npm --name "$PM2_APP_NAME" -- start -- -p "$APP_PORT" -H "$APP_HOST"
fi

pm2 save

if [ "$RUN_HEALTH_CHECK" = "true" ]; then
  echo "==> Running health check: $HEALTH_URL"
  sleep 5
  curl --fail --show-error --silent --max-time 20 "$HEALTH_URL"
  echo
else
  echo "==> Skipping health check"
fi

echo "==> Deploy complete"
REMOTE_SCRIPT

