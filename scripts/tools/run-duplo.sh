#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DUPLO_BIN="${DUPLO_BIN:-duplo}"
TARGET_DIR="${ROOT_DIR}/Apps"
THRESHOLD="${DUPLO_THRESHOLD:-60}"
REPORT_DIR="${REPORT_DIR:-${ROOT_DIR}/reports/duplo}"

mkdir -p "${REPORT_DIR}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="${REPORT_DIR}/duplo-report-${TIMESTAMP}.txt"
SUMMARY_FILE="${REPORT_DIR}/duplo-summary-${TIMESTAMP}.json"

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

echo "🔍 Scanning TypeScript/HTML files under ${TARGET_DIR} for duplicates with Duplo (min block length: ${THRESHOLD} lines)..."
echo "📄 Report: ${REPORT_FILE}"

FILE_LIST="$(mktemp)"
trap 'rm -f "${FILE_LIST}"' EXIT

# Find source files across all apps (TS/TSX/HTML); exclude node_modules, dist and build folders
find "${TARGET_DIR}" -type f \( -name "*.html" -o -name "*.ts" -o -name "*.tsx" \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/build/*' > "${FILE_LIST}"

if [ ! -s "${FILE_LIST}" ]; then
  echo "ℹ️  No Angular template files found under ${TARGET_DIR}"
  exit 0
fi

set +e
${DUPLO_BIN} -ml "${THRESHOLD}" "${FILE_LIST}" - 2>&1 | tee "${REPORT_FILE}"
STATUS=${PIPESTATUS[0]:-0}
set -e

if [ ${STATUS} -eq 0 ]; then
  echo "✅ Duplo scan completed without duplicate matches."
  # Generate a zero-result summary when no duplicates are found
  cat > "${SUMMARY_FILE}" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "status": ${STATUS},
  "duplicates_count": 0,
  "duplicates_per_file": {}
}
EOF
  echo "📊 Summary: ${SUMMARY_FILE}"
else
  echo "⚠️  Duplo reported duplicate template fragments. Review the report at ${REPORT_FILE}."
fi

# Generate a summary JSON file: duplicates per file (best-effort extraction)
if [ -s "${REPORT_FILE}" ] && [ ${STATUS} -ne 0 ]; then
  FILE_MATCHES=$(grep -E "${ROOT_DIR}/Apps/[^:[:space:]]+" "${REPORT_FILE}" | grep -v "nothing found" | sed "s|${ROOT_DIR}/||g" || true)
  if [ -n "${FILE_MATCHES}" ]; then
    # Build JSON summary
    DUPLICATES_COUNT=$(echo "${FILE_MATCHES}" | wc -l)
    DUPS_JSON=$(echo "${FILE_MATCHES}" | sort | uniq -c | awk '{ printf "\"%s\": %s,", $2, $1 }' | sed 's/,$//')
    cat > "${SUMMARY_FILE}" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "status": ${STATUS},
  "duplicates_count": ${DUPLICATES_COUNT},
  "duplicates_per_file": { ${DUPS_JSON} }
}
EOF
    echo "📊 Summary: ${SUMMARY_FILE}"
  else
    cat > "${SUMMARY_FILE}" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "status": ${STATUS},
  "duplicates_count": 0,
  "duplicates_per_file": {}
}
EOF
    echo "📊 Summary: ${SUMMARY_FILE} (no file matches extracted)"
  fi
else
  echo "ℹ️  No Duplo duplicates to summarize (status=${STATUS})."
fi

exit ${STATUS}
