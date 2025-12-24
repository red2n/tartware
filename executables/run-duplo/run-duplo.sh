#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DUPLO_BIN="${DUPLO_BIN:-duplo}"
TARGET_DIR="${ROOT_DIR}/Apps"
MIN_LINES="${DUPLO_MIN_LINES:-60}"
PERCENT_THRESHOLD="${DUPLO_PERCENT_THRESHOLD:-}"
MIN_CHARS="${DUPLO_MIN_CHARS:-3}"
if [ -n "${DUPLO_THREADS:-}" ]; then
  THREADS="${DUPLO_THREADS}"
else
  if command -v getconf >/dev/null 2>&1; then
    THREADS="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)"
  elif command -v nproc >/dev/null 2>&1; then
    THREADS="$(nproc 2>/dev/null || echo 1)"
  else
    THREADS=1
  fi
fi
MAX_REPORT_FILES="${DUPLO_MAX_FILES:-}"
EXTENSIONS="${DUPLO_EXTENSIONS:-ts,tsx,js,jsx,html}"
IGNORE_PREPROCESSOR="${DUPLO_IGNORE_PREPROCESSOR:-false}"
IGNORE_SAME_NAME="${DUPLO_IGNORE_SAME_NAME:-false}"
REPORT_DIR="${REPORT_DIR:-${ROOT_DIR}/reports/duplo}"

mkdir -p "${REPORT_DIR}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="${REPORT_DIR}/duplo-report-${TIMESTAMP}.log"
RAW_JSON_FILE="${REPORT_DIR}/duplo-report-${TIMESTAMP}.json"
SUMMARY_FILE="${REPORT_DIR}/duplo-summary-${TIMESTAMP}.json"

# ensure the default Go bin dir is on PATH so locally installed duplo is found
if [ -d "$HOME/go/bin" ] && [[ ":$PATH:" != *":$HOME/go/bin:"* ]]; then
  PATH="$HOME/go/bin:$PATH"
fi

if ! command -v "${DUPLO_BIN}" >/dev/null 2>&1; then
  cat <<EOF_INSTALL >&2
✗ Duplo is not installed or not on PATH.
  Install via:  go install github.com/dlidstrom/Duplo/cmd/duplo@latest
  Or download a release binary from https://github.com/dlidstrom/Duplo
EOF_INSTALL
  exit 1
fi

echo "🔍 Scanning source files under ${TARGET_DIR} for duplicates with Duplo (min block length: ${MIN_LINES} lines)..."
echo "📄 Report: ${REPORT_FILE}"

FILE_LIST="$(mktemp)"
trap 'rm -f "${FILE_LIST}"' EXIT

IFS=',' read -r -a EXT_ARRAY <<< "${EXTENSIONS}"
FIND_CMD=(find "${TARGET_DIR}" -type f)
pattern_count=0
for raw_ext in "${EXT_ARRAY[@]}"; do
  ext="$(echo "${raw_ext}" | tr -d '[:space:]')"
  if [ -z "${ext}" ]; then
    continue
  fi
  ext="${ext#.}"
  if [ ${pattern_count} -eq 0 ]; then
    FIND_CMD+=("(")
  else
    FIND_CMD+=(-o)
  fi
  FIND_CMD+=(-name "*.${ext}")
  pattern_count=$((pattern_count + 1))
done
if [ ${pattern_count} -gt 0 ]; then
  FIND_CMD+=(")")
fi

EXCLUDES=(
  -not -path '*/node_modules/*'
  -not -path '*/dist/*'
  -not -path '*/build/*'
  -not -path '*/coverage/*'
  -not -path '*/.next/*'
)

if [ -n "${DUPLO_EXCLUDE_DIRS:-}" ]; then
  IFS=',' read -r -a EXTRA_EXCLUDES <<< "${DUPLO_EXCLUDE_DIRS}"
  for raw_dir in "${EXTRA_EXCLUDES[@]}"; do
    dir="$(echo "${raw_dir}" | tr -d '[:space:]')"
    if [ -n "${dir}" ]; then
      EXCLUDES+=(-not -path "*/${dir}/*")
    fi
  done
fi

FIND_CMD+=("${EXCLUDES[@]}")
"${FIND_CMD[@]}" > "${FILE_LIST}"

if [ ! -s "${FILE_LIST}" ]; then
  echo "ℹ️  No matching source files found under ${TARGET_DIR}"
  exit 0
fi

DUPLO_ARGS=(-ml "${MIN_LINES}" -mc "${MIN_CHARS}" -j "${THREADS}")
if [ -n "${PERCENT_THRESHOLD}" ]; then
  DUPLO_ARGS+=(-pt "${PERCENT_THRESHOLD}")
fi
if [[ "${IGNORE_PREPROCESSOR,,}" == "true" || "${IGNORE_PREPROCESSOR}" == "1" ]]; then
  DUPLO_ARGS+=(-ip)
fi
if [[ "${IGNORE_SAME_NAME,,}" == "true" || "${IGNORE_SAME_NAME}" == "1" ]]; then
  DUPLO_ARGS+=(-d)
fi
if [ -n "${MAX_REPORT_FILES}" ]; then
  DUPLO_ARGS+=(-n "${MAX_REPORT_FILES}")
fi
if [ -n "${DUPLO_EXTRA_ARGS:-}" ]; then
  # shellcheck disable=SC2206
  EXTRA_ARGS=( ${DUPLO_EXTRA_ARGS} )
  DUPLO_ARGS+=("${EXTRA_ARGS[@]}")
fi

set +e
${DUPLO_BIN} "${DUPLO_ARGS[@]}" -json "${FILE_LIST}" "${RAW_JSON_FILE}" 2>&1 | tee "${REPORT_FILE}"
STATUS=${PIPESTATUS[0]:-0}
set -e

if [ ${STATUS} -eq 0 ]; then
  echo "✅ Duplo scan completed without duplicate matches."
else
  echo "⚠️  Duplo reported duplicate fragments. Review the log at ${REPORT_FILE}."
fi

if [ ! -s "${RAW_JSON_FILE}" ]; then
  echo "null" > "${RAW_JSON_FILE}"
fi

node - "${RAW_JSON_FILE}" "${SUMMARY_FILE}" "${TIMESTAMP}" "${STATUS}" "${ROOT_DIR}" <<'NODE'
const fs = require("fs");
const [rawPath, summaryPath, timestamp, statusArg, rootDirRaw] = process.argv.slice(2);
const status = Number(statusArg);
const rootDir = (rootDirRaw || "").replace(/\/$/, "");

let data = null;
try {
  const raw = fs.readFileSync(rawPath, "utf8").trim();
  data = raw ? JSON.parse(raw) : null;
} catch (error) {
  console.warn("⚠️  Unable to parse Duplo JSON output:", error);
}

const duplicatesPerFile = {};
let duplicatesCount = 0;
if (Array.isArray(data)) {
  duplicatesCount = data.length;
  for (const entry of data) {
    for (const key of ["SourceFile1", "SourceFile2"]) {
      const file = entry?.[key];
      if (typeof file === "string" && file.length > 0) {
        const normalized = file.startsWith(rootDir + "/")
          ? file.slice(rootDir.length + 1)
          : file;
        duplicatesPerFile[normalized] = (duplicatesPerFile[normalized] || 0) + 1;
      }
    }
  }
}

const summary = {
  timestamp,
  status,
  duplicates_count: duplicatesCount,
  duplicates_per_file: duplicatesPerFile,
};

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
NODE

echo "📊 Summary: ${SUMMARY_FILE}"
echo "🧾 Raw matches: ${RAW_JSON_FILE}"

exit ${STATUS}
