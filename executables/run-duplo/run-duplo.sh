#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DUPLO_BIN="${DUPLO_BIN:-duplo}"
TARGET_DIR="${ROOT_DIR}/Apps"
# Industry standard: 20 lines minimum for meaningful duplicates
MIN_LINES="${DUPLO_MIN_LINES:-20}"
PERCENT_THRESHOLD="${DUPLO_PERCENT_THRESHOLD:-}"
MIN_CHARS="${DUPLO_MIN_CHARS:-3}"
# Auto-detect CPU count for optimal performance (v2.0 feature)
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
# Support multiple file extensions for modern codebases
EXTENSIONS="${DUPLO_EXTENSIONS:-ts,tsx,js,jsx,html,css,scss}"
IGNORE_PREPROCESSOR="${DUPLO_IGNORE_PREPROCESSOR:-true}"
IGNORE_SAME_NAME="${DUPLO_IGNORE_SAME_NAME:-false}"
REPORT_DIR="${REPORT_DIR:-${ROOT_DIR}/reports/duplo}"
# Enable XML output for CI/CD integration
OUTPUT_XML="${DUPLO_OUTPUT_XML:-true}"

mkdir -p "${REPORT_DIR}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="${REPORT_DIR}/duplo-report-${TIMESTAMP}.txt"
RAW_JSON_FILE="${REPORT_DIR}/duplo-report-${TIMESTAMP}.json"
XML_REPORT_FILE="${REPORT_DIR}/duplo-report-${TIMESTAMP}.xml"
SUMMARY_FILE="${REPORT_DIR}/duplo-summary-${TIMESTAMP}.json"

# ensure the default Go bin dir is on PATH so locally installed duplo is found
if [ -d "$HOME/go/bin" ] && [[ ":$PATH:" != *":$HOME/go/bin:"* ]]; then
  PATH="$HOME/go/bin:$PATH"
fi

if ! command -v "${DUPLO_BIN}" >/dev/null 2>&1; then
  cat <<EOF_INSTALL >&2
✗ Duplo is not installed or not on PATH.
  
  Install via Go:
    go install github.com/dlidstrom/Duplo@latest
  
  Or download pre-built binaries:
    Linux:   https://github.com/dlidstrom/Duplo/releases/latest (duplo-linux.zip)
    macOS:   https://github.com/dlidstrom/Duplo/releases/latest (duplo-macos.zip)
    Windows: https://github.com/dlidstrom/Duplo/releases/latest (duplo-windows.zip)
  
  See: https://github.com/dlidstrom/Duplo
EOF_INSTALL
  exit 1
fi

# Get Duplo version for reporting
DUPLO_VERSION=$(${DUPLO_BIN} --version 2>&1 || echo "unknown")

echo "🔍 Scanning source files under ${TARGET_DIR} for duplicates..."
echo "📦 Duplo version: ${DUPLO_VERSION}"
echo "⚙️  Min lines: ${MIN_LINES}, Threads: ${THREADS}, Extensions: ${EXTENSIONS}"
echo "📄 Text Report: ${REPORT_FILE}"
echo "📊 JSON Report: ${RAW_JSON_FILE}"
if [[ "${OUTPUT_XML,,}" == "true" || "${OUTPUT_XML}" == "1" ]]; then
  echo "🔧 XML Report:  ${XML_REPORT_FILE}"
fi

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

FILE_COUNT=$(wc -l < "${FILE_LIST}")
echo "📁 Found ${FILE_COUNT} files to analyze"

# Build Duplo arguments following v2.0 best practices
DUPLO_ARGS=(-ml "${MIN_LINES}" -mc "${MIN_CHARS}")

# Use multithreading (-j) for performance (v2.0 feature)
DUPLO_ARGS+=(-j "${THREADS}")

if [ -n "${PERCENT_THRESHOLD}" ]; then
  DUPLO_ARGS+=(-pt "${PERCENT_THRESHOLD}")
fi

# Ignore preprocessor directives for cleaner analysis
if [[ "${IGNORE_PREPROCESSOR,,}" == "true" || "${IGNORE_PREPROCESSOR}" == "1" ]]; then
  DUPLO_ARGS+=(-ip)
fi

# Ignore duplicates in files with the same name
if [[ "${IGNORE_SAME_NAME,,}" == "true" || "${IGNORE_SAME_NAME}" == "1" ]]; then
  DUPLO_ARGS+=(-d)
fi

if [ -n "${MAX_REPORT_FILES}" ]; then
  DUPLO_ARGS+=(-n "${MAX_REPORT_FILES}")
fi

# Add XML output for CI/CD integration
if [[ "${OUTPUT_XML,,}" == "true" || "${OUTPUT_XML}" == "1" ]]; then
  DUPLO_ARGS+=(-xml "${XML_REPORT_FILE}")
fi

# Add JSON output
DUPLO_ARGS+=(-json "${RAW_JSON_FILE}")

if [ -n "${DUPLO_EXTRA_ARGS:-}" ]; then
  # shellcheck disable=SC2206
  EXTRA_ARGS=( ${DUPLO_EXTRA_ARGS} )
  DUPLO_ARGS+=("${EXTRA_ARGS[@]}")
fi

echo ""
echo "🚀 Running Duplo analysis..."

# Use stdin for file list (recommended approach per Duplo docs)
set +e
cat "${FILE_LIST}" | ${DUPLO_BIN} "${DUPLO_ARGS[@]}" - - 2>&1 | tee "${REPORT_FILE}"
STATUS=${PIPESTATUS[0]:-0}
set -e

echo ""
if [ ${STATUS} -eq 0 ]; then
  echo "✅ Duplo scan completed - no duplicates found!"
else
  echo "⚠️  Duplicates detected! Review reports:"
  echo "    Text: ${REPORT_FILE}"
  echo "    JSON: ${RAW_JSON_FILE}"
  if [[ "${OUTPUT_XML,,}" == "true" || "${OUTPUT_XML}" == "1" ]]; then
    echo "    XML:  ${XML_REPORT_FILE}"
  fi
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
