#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077

for cmd in node pg_dump pg_restore psql openssl tar sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Missing dependency: $cmd"
    echo "Install with: pkg install nodejs postgresql openssl tar coreutils"
    exit 1
  }
done

if [[ ! -d "$HOME/storage/downloads" ]]; then
  echo "Shared Downloads is not available."
  echo "Run termux-setup-storage, grant access, then run this script again."
  exit 1
fi

read -r -s -p "Supabase DATABASE connection URL (Dashboard > Connect): " SUPABASE_DB_URL
echo
read -r -s -p "Supabase server-side service_role key (never paste into ChatGPT): " SUPABASE_SERVICE_ROLE_KEY
echo
read -r -s -p "Backup encryption passphrase (20+ characters; save it offline): " BACKUP_PASSPHRASE
echo
read -r -s -p "Confirm backup encryption passphrase: " BACKUP_PASSPHRASE_CONFIRM
echo

if [[ "$BACKUP_PASSPHRASE" != "$BACKUP_PASSPHRASE_CONFIRM" ]]; then
  echo "Passphrases do not match."
  exit 1
fi
if [[ ${#BACKUP_PASSPHRASE} -lt 20 ]]; then
  echo "Use a passphrase of at least 20 characters."
  exit 1
fi
if [[ -z "$SUPABASE_DB_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "Database URL and service-role key are required."
  exit 1
fi

export SUPABASE_DB_URL SUPABASE_SERVICE_ROLE_KEY BACKUP_PASSPHRASE
trap 'unset SUPABASE_DB_URL SUPABASE_SERVICE_ROLE_KEY BACKUP_PASSPHRASE BACKUP_PASSPHRASE_CONFIRM' EXIT
node "$(dirname "$0")/backup-supabase.mjs"
