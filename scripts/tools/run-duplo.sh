#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DUPLO_BIN="${DUPLO_BIN:-duplo}"
TARGET_DIR="${ROOT_DIR}/Apps/tartware-ui/src/app"
THRESHOLD="${DUPLO_THRESHOLD:-60}"

# ensure the default Go bin dir is on PATH so locally installed duplo is found
if [ -d "$HOME/go/bin" ] && [[ ":$PATH:" != *":$HOME/go/bin:"* ]]; then
  PATH="$HOME/go/bin:$PATH"
fi

if ! command -v "${DUPLO_BIN}" >/dev/null 2>&1; then
  cat <<EOF >&2
✗ Duplo is not installed or not on PATH.
  Install via:  go install github.com/dlidstrom/Duplo/cmd/duplo@latest
  Or download a release binary from https://github.com/dlidstrom/Duplo
EOF
  exit 1
fi

echo "🔍 Scanning Angular templates for duplicates with Duplo (min block length: ${THRESHOLD} lines)..."

FILE_LIST="$(mktemp)"
trap 'rm -f "${FILE_LIST}"' EXIT

find "${TARGET_DIR}" -type f -name "*.html" > "${FILE_LIST}"

if [ ! -s "${FILE_LIST}" ]; then
  echo "ℹ️  No Angular template files found under ${TARGET_DIR}"
  exit 0
fi

set +e
"${DUPLO_BIN}" -ml "${THRESHOLD}" "${FILE_LIST}" -
STATUS=$?
set -e

if [ ${STATUS} -eq 0 ]; then
  echo "✅ Duplo scan completed without duplicate matches."
else
  echo "⚠️  Duplo reported duplicate template fragments. Review the output above."
fi

exit ${STATUS}
