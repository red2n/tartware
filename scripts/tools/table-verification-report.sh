#!/usr/bin/env bash
set -euo pipefail

# Generates a Markdown summary for table verification scripts.
# Usage:
#   scripts/tools/table-verification-report.sh
# Environment overrides:
#   DATABASE_URL   → libpq connection string (optional)
#   PSQL_FLAGS     → extra flags (e.g., "-h localhost -U postgres")
#   PSQL_BIN       → path to psql executable (defaults to "psql")

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_DIR="${REPO_ROOT}/reports/table-verification"
mkdir -p "${REPORT_DIR}"

TIMESTAMP="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
REPORT_FILE="${REPORT_DIR}/${TIMESTAMP}-table-verification.md"

PSQL_BIN="${PSQL_BIN:-psql}"
if ! command -v "${PSQL_BIN}" >/dev/null 2>&1; then
  echo "❌ Unable to find psql (looked for ${PSQL_BIN})." >&2
  exit 1
fi

PSQL_CMD=("${PSQL_BIN}" "-X")
if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL_CMD+=("${DATABASE_URL}")
fi
if [[ -n "${PSQL_FLAGS:-}" ]]; then
  # shellcheck disable=SC2206
  read -r -a FLAG_ARRAY <<<"${PSQL_FLAGS}"
  PSQL_CMD+=("${FLAG_ARRAY[@]}")
fi

db_name="$("${PSQL_CMD[@]}" -tAc "SELECT current_database();" 2>/dev/null | tr -d '[:space:]')"
if [[ -z "${db_name}" ]]; then
  db_name="${PGDATABASE:-}"
fi
if [[ -z "${db_name}" ]]; then
  echo "❌ Unable to determine database name. Please set PGDATABASE or DATABASE_URL." >&2
  exit 1
fi

declare -a CHECKS=(
  "scripts/tables/verify-tables.sql::Table Inventory"
  "scripts/verify-all-categories.sql::Category Scans"
)

declare -A CHECK_STATUS
declare -A CHECK_OUTPUT
overall_exit=0

run_check() {
  local script_path="$1"
  local label="$2"
  local absolute_path="${REPO_ROOT}/${script_path}"
  local output
  local exit_code

  if [[ ! -f "${absolute_path}" ]]; then
    CHECK_STATUS["${label}"]="SKIPPED"
    CHECK_OUTPUT["${label}"]="Script not found at ${script_path}"
    overall_exit=1
    return
  fi

  echo "→ Running ${label} (${script_path})"
  set +e
  output=$("${PSQL_CMD[@]}" -v ON_ERROR_STOP=1 -f "${absolute_path}" 2>&1)
  exit_code=$?
  set -e

  CHECK_OUTPUT["${label}"]="${output}"
  if [[ ${exit_code} -eq 0 ]]; then
    CHECK_STATUS["${label}"]="PASS"
  else
    CHECK_STATUS["${label}"]="FAIL"
    overall_exit=1
  fi
}

for entry in "${CHECKS[@]}"; do
  IFS="::" read -r script label <<<"${entry}"
  run_check "${script}" "${label}"
done

{
  echo "# Table Verification Report"
  echo "- Generated: ${TIMESTAMP} (UTC)"
  echo "- Database: ${db_name}"
  echo "- Report: ${REPORT_FILE#"${REPO_ROOT}/"}"
  echo "- Checks Run: ${#CHECKS[@]}"
  echo ""

  for entry in "${CHECKS[@]}"; do
    IFS="::" read -r script label <<<"${entry}"
    echo "## ${label}"
    echo "- Script: \`${script}\`"
    echo "- Status: ${CHECK_STATUS["${label}"]:-NOT_RUN}"
    echo ""
    echo '```text'
    printf '%s\n' "${CHECK_OUTPUT["${label}"]:-No output captured}"
    echo '```'
    echo ""
  done
} >"${REPORT_FILE}"

echo ""
echo "✅ Markdown report written to ${REPORT_FILE}"
exit ${overall_exit}
