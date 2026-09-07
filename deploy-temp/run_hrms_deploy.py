import os
import sys

import paramiko


HOST = "72.60.97.58"
PORT = 2424
USER = "samvid"
PASSWORD = "Nemgiri@2026"
SHA = "3ac6472"

LOCAL_ARCHIVE = os.path.abspath(f"deploy-temp/hrms-release-{SHA}.tar.gz")
REMOTE_ARCHIVE = f"/tmp/hrms-release-{SHA}.tar.gz"
REMOTE_SCRIPT = f"/tmp/hrms-deploy-{SHA}.sh"

REMOTE_DEPLOY_SCRIPT = f"""#!/usr/bin/env bash
set -euo pipefail
ARCHIVE="{REMOTE_ARCHIVE}"
chown hrmsdeploy:hrmsdeploy "$ARCHIVE"

sudo -H -u hrmsdeploy bash <<'HRMS_DEPLOY'
set -euo pipefail
ARCHIVE="{REMOTE_ARCHIVE}"
APPS_DIR="/home/hrmsdeploy/apps"
APP_DIR="$APPS_DIR/hrms"
PM2_APP="hrms"
APP_PORT="5600"
APP_HOST="0.0.0.0"
HEALTH_URL="https://vega.nemnidhi.com/api/health"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_DIR=""

cd "$APPS_DIR"
if [ -d "$APP_DIR" ]; then
  BACKUP_DIR="$APP_DIR-backup-$STAMP"
  echo "==> Backing up current release to: $BACKUP_DIR"
  mv "$APP_DIR" "$BACKUP_DIR"
fi

mkdir -p "$APP_DIR"
tar -xzf "$ARCHIVE" -C "$APP_DIR"
cd "$APP_DIR"

if [ -n "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/.env" ]; then
  cp "$BACKUP_DIR/.env" "$APP_DIR/.env"
fi
if [ -n "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/.env.local" ]; then
  cp "$BACKUP_DIR/.env.local" "$APP_DIR/.env.local"
fi
if [ ! -f "$APP_DIR/.env" ] || [ ! -f "$APP_DIR/.env.local" ]; then
  echo "Missing production env files on the VPS. Restore .env and .env.local before deploying."
  exit 1
fi
chmod 600 "$APP_DIR/.env" "$APP_DIR/.env.local"

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

echo "==> Building app"
npm run build

echo "==> Restarting PM2 app: $PM2_APP"
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start npm --name "$PM2_APP" -- start -- -p "$APP_PORT" -H "$APP_HOST"
fi
pm2 save

echo "==> Running health check: $HEALTH_URL"
sleep 8
curl --fail --show-error --silent --max-time 30 "$HEALTH_URL"
echo

echo "==> Deploy complete"
HRMS_DEPLOY

rm -f "$ARCHIVE" "{REMOTE_SCRIPT}"
"""


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    try:
        with client.open_sftp() as sftp:
            sftp.put(LOCAL_ARCHIVE, REMOTE_ARCHIVE)
            with sftp.file(REMOTE_SCRIPT, "w") as remote_file:
                remote_file.write(REMOTE_DEPLOY_SCRIPT)

        quoted_password = PASSWORD.replace("'", "'\\''")
        cmd = f"printf '%s\\n' '{quoted_password}' | sudo -S bash {REMOTE_SCRIPT}"
        _stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=1200)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        sys.stdout.buffer.write(out.encode("utf-8", errors="replace"))
        if err:
            sys.stderr.buffer.write(err.encode("utf-8", errors="replace"))
        return stdout.channel.recv_exit_status()
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
