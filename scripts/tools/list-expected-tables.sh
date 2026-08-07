#!/usr/bin/env bash
# ============================================================================
# list-expected-tables.sh
#
# Prints every table the schema is supposed to create, derived from the
# CREATE TABLE statements in the files 00-create-all-tables.sql includes.
# That include list is the single source of truth: a table script that is not
# included creates nothing, so it is not expected either.
#
# Output: one row per table, tab-separated:
#     <source-directory>\t<schema>\t<table>
# e.g.  01-core<TAB>public<TAB>module_access_requests
#
# Used by tables/verify-tables.sql (via \copy FROM PROGRAM) so verification
# never carries a hand-maintained list of table names or an expected count.
#
# Usage:
#     ./list-expected-tables.sh              # every table
#     ./list-expected-tables.sh 01-core      # one directory only
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TABLES_DIR="${SCRIPT_DIR}/../tables"
MANIFEST="${TABLES_DIR}/00-create-all-tables.sql"
FILTER="${1:-}"

if [ ! -f "$MANIFEST" ]; then
    echo "list-expected-tables.sh: manifest not found: $MANIFEST" >&2
    exit 1
fi

# gawk's match() with a capture-group array is required; mawk lacks it.
AWK_BIN="$(command -v gawk || true)"
if [ -z "$AWK_BIN" ]; then
    echo "list-expected-tables.sh: gawk is required (same dependency as setup-database.sh)" >&2
    exit 1
fi

# Matches the parser in executables/setup-database/setup-database.sh so the
# expected count reported at setup time and at verification time cannot drift.
extract_tables() {
    "$AWK_BIN" '
        BEGIN { IGNORECASE = 1 }
        /^[[:space:]]*--/ { next }
        {
            if (match($0, /CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?"?([a-zA-Z0-9_]+)"?(\."?([a-zA-Z0-9_]+)"?)?/, m)) {
                if (m[4] != "") {
                    print tolower(m[2]) "\t" tolower(m[4])
                } else {
                    print "public\t" tolower(m[2])
                }
            }
        }
    ' "$1"
}

awk '/^\\ir[[:space:]]+/ { print $2 }' "$MANIFEST" |
    while read -r include_path; do
        [ -z "$include_path" ] && continue

        # Directory the script lives in — the grouping shown in the report.
        # Files at the tables/ root are grouped as "root".
        case "$include_path" in
            */*) source_dir="${include_path%%/*}" ;;
            *)   source_dir="root" ;;
        esac

        if [ -n "$FILTER" ] && [ "$source_dir" != "$FILTER" ]; then
            continue
        fi

        target="${TABLES_DIR}/${include_path}"
        if [ ! -f "$target" ]; then
            echo "list-expected-tables.sh: missing table script referenced in manifest: $include_path" >&2
            exit 1
        fi

        extract_tables "$target" | while IFS=$'\t' read -r schema table; do
            [ -z "$table" ] && continue
            printf '%s\t%s\t%s\n' "$source_dir" "$schema" "$table"
        done
    done |
    sort -u
