#!/usr/bin/env bash
## Run all verification SQL scripts under ./scripts in a safe, ordered manner.
##
## Usage:
##   ./scripts/tools/run-verifications.sh              # reads .env / DB_* vars
##   PGHOST=... PGUSER=... PGPASSWORD=... ./scripts/tools/run-verifications.sh
##   ./scripts/tools/run-verifications.sh -h host -p 5432 -U postgres -d tartware
##
## Connection settings come from PG* first, then the repo's own DB_* variables
## (what .env defines and `tartware.sh` sources), then the defaults below. The
## DB_* fallback is the reason this is runnable at all from `tartware.sh db
## verify`: without it psql found no password, prompted, and blocked forever on
## a script that is supposed to be non-interactive.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"

# -w: never prompt for a password. A verification run is unattended by
# definition, and a missing password must fail in a second with a readable
# error rather than hang until someone notices.
PSQL_OPTS=( -v ON_ERROR_STOP=1 -X -w )

# PG* wins, then the repo's DB_* vars, then a sensible local default.
VERIFY_HOST=${PGHOST:-${DB_HOST:-localhost}}
VERIFY_PORT=${PGPORT:-${DB_DIRECT_PORT:-5432}}
VERIFY_USER=${PGUSER:-${DB_USER:-postgres}}
VERIFY_NAME=${PGDATABASE:-${DB_NAME:-tartware}}
export PGPASSWORD=${PGPASSWORD:-${DB_PASSWORD:-postgres}}

while getopts ":h:p:U:d:" opt; do
  case ${opt} in
    h ) VERIFY_HOST=$OPTARG ;;
    p ) VERIFY_PORT=$OPTARG ;;
    U ) VERIFY_USER=$OPTARG ;;
    d ) VERIFY_NAME=$OPTARG ;;
    \? ) echo "Usage: $0 [-h host] [-p port] [-U user] [-d database]"; exit 2 ;;
  esac
done

PSQL_CMD=( psql "${PSQL_OPTS[@]}" -h "$VERIFY_HOST" -p "$VERIFY_PORT" -U "$VERIFY_USER" -d "$VERIFY_NAME" )

echo "Running verification scripts against ${VERIFY_NAME}@${VERIFY_HOST}:${VERIFY_PORT} as ${VERIFY_USER}"

cd "$SCRIPTS_DIR"

FILES=(
  "verify-installation.sql"
  "verify-setup.sql"
  "tables/verify-tables.sql"
)

# Each script runs even when an earlier one failed, and the exit code is the
# aggregate. Stopping at the first failure hid the other two suites entirely —
# one missing seed meant the table and column checks never ran, so a report of
# "1 failure" could be concealing fifty.
FAILED_FILES=()

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo
    echo "========== Running: $f =========="
    if "${PSQL_CMD[@]}" -f "$f"; then
      echo "========== Success: $f =========="
    else
      FAILED_FILES+=("$f")
      echo "========== FAILED: $f =========="
    fi
  else
    echo
    echo "⚠ Skipping missing verify file: $f"
  fi
done

echo
if [ "${#FAILED_FILES[@]}" -eq 0 ]; then
  echo "✓ All specified verification scripts completed successfully."
else
  echo "✗ Verification FAILED in ${#FAILED_FILES[@]} script(s):"
  for f in "${FAILED_FILES[@]}"; do echo "    - $f"; done
  exit 1
fi
