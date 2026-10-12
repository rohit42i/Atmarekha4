#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
for cmd in node openssl tar pg_restore sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Missing dependency: $cmd"
    echo "Install with: pkg install nodejs postgresql openssl tar coreutils"
    exit 1
  }
done
read -r -p "Path to encrypted backup (.tar.gz.enc): " BACKUP_FILE
read -r -s -p "Backup encryption passphrase: " BACKUP_PASSPHRASE
echo
export BACKUP_PASSPHRASE
trap 'unset BACKUP_PASSPHRASE' EXIT
node "$(dirname "$0")/verify-backup.mjs" "$BACKUP_FILE"
