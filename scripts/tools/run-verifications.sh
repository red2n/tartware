#!/usr/bin/env bash
## Run all verification SQL scripts under ./scripts in a safe, ordered manner.
## Usage:
##   PGHOST=localhost PGUSER=postgres PGDATABASE=tartware ./scripts/tools/run-verifications.sh
## Or rely on PG* env vars or ~/.pgpass for authentication.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"

PSQL_OPTS=( -v ON_ERROR_STOP=1 -X )

# Allow overrides via env or flags
DB_HOST=${PGHOST:-localhost}
DB_USER=${PGUSER:-postgres}
DB_NAME=${PGDATABASE:-tartware}

while getopts ":h:U:d:" opt; do
  case ${opt} in
    h ) DB_HOST=$OPTARG ;;
    U ) DB_USER=$OPTARG ;;
    d ) DB_NAME=$OPTARG ;;
    \? ) echo "Usage: $0 [-h host] [-U user] [-d database]"; exit 2 ;;
  esac
done

PSQL_CMD=( psql "${PSQL_OPTS[@]}" -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" )

echo "Running verification scripts against ${DB_NAME}@${DB_HOST} as ${DB_USER}"

cd "$SCRIPTS_DIR"

FILES=(
  "verify-installation.sql"
  "verify-setup.sql"
  "tables/verify-tables.sql"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo
    echo "========== Running: $f =========="
    "${PSQL_CMD[@]}" -f "$f"
    echo "========== Success: $f =========="
  else
    echo
    echo "⚠ Skipping missing verify file: $f"
  fi
done

echo
echo "All specified verification scripts completed successfully."
