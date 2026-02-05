#!/usr/bin/env bash
# ============================================================================
# Tartware - Database Migration Runner
# Applies versioned migrations with tracking, validation, and rollback support
# ============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-tartware}"
DB_USER="${PGUSER:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Calculate SHA-256 checksum of a file
calculate_checksum() {
    local file="$1"
    sha256sum "$file" | cut -d' ' -f1
}

# Execute SQL and return result
run_sql() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1" 2>/dev/null
}

# Execute SQL file with timing
run_sql_file() {
    local file="$1"
    local start_time end_time duration
    start_time=$(date +%s%3N)

    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" -v ON_ERROR_STOP=1; then
        end_time=$(date +%s%3N)
        duration=$((end_time - start_time))
        echo "$duration"
        return 0
    else
        return 1
    fi
}

# Check if migrations table exists
ensure_migrations_table() {
    log_info "Checking migrations tracking table..."

    local table_exists
    table_exists=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_migrations')")

    if [[ "$table_exists" != "t" ]]; then
        log_info "Creating migrations tracking table..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -f "${MIGRATIONS_DIR}/00-schema-migrations-table.sql" -v ON_ERROR_STOP=1
        log_success "Migrations table created"
    fi
}

# Check if migration is already applied
is_migration_applied() {
    local version="$1"
    local result
    result=$(run_sql "SELECT migration_exists('$version')")
    [[ "$result" == "t" ]]
}

# Get migration version from filename
# Format: YYYY-MM-DD-NNN-description.sql
get_version_from_filename() {
    local filename="$1"
    basename "$filename" .sql | sed 's/-[a-z].*$//'
}

# Get migration name from filename
get_name_from_filename() {
    local filename="$1"
    basename "$filename" .sql | sed 's/^[0-9-]*-//'
}

# Apply a single migration
apply_migration() {
    local file="$1"
    local version name checksum duration

    version=$(get_version_from_filename "$file")
    name=$(get_name_from_filename "$file")
    checksum=$(calculate_checksum "$file")

    # Skip if already applied
    if is_migration_applied "$version"; then
        log_warn "Skipping $version (already applied)"
        return 0
    fi

    log_info "Applying migration: $version - $name"

    # Apply migration with timing
    if duration=$(run_sql_file "$file"); then
        # Record successful migration
        run_sql "SELECT record_migration('$version', '$name', 'schema', $duration, '$checksum', NULL, 'Applied via migrate.sh')"
        log_success "Applied $version in ${duration}ms"
        return 0
    else
        log_error "Failed to apply migration: $version"
        # Record failed migration
        run_sql "INSERT INTO schema_migrations (version, name, status, notes) VALUES ('$version', '$name', 'failed', 'Failed during automated run')" || true
        return 1
    fi
}

# Show migration status
show_status() {
    echo ""
    echo "=== Migration Status ==="
    echo ""
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -c "SELECT version, name, status, applied_at, execution_time_ms as \"ms\" FROM schema_migrations ORDER BY applied_at DESC LIMIT 20"

    echo ""
    echo "=== Pending Migrations ==="

    local pending=0
    for file in "${MIGRATIONS_DIR}"/*.sql; do
        [[ -f "$file" ]] || continue
        [[ "$(basename "$file")" == "00-schema-migrations-table.sql" ]] && continue

        local version
        version=$(get_version_from_filename "$file")

        if ! is_migration_applied "$version"; then
            echo "  - $version: $(get_name_from_filename "$file")"
            pending=$((pending + 1))
        fi
    done

    if [[ $pending -eq 0 ]]; then
        echo "  (none)"
    fi
    echo ""
}

# Apply all pending migrations
apply_all() {
    log_info "Scanning for pending migrations..."

    local applied=0
    local failed=0

    # Sort migrations by filename (version)
    for file in $(find "${MIGRATIONS_DIR}" -name '*.sql' -type f | sort); do
        [[ "$(basename "$file")" == "00-schema-migrations-table.sql" ]] && continue

        if apply_migration "$file"; then
            applied=$((applied + 1))
        else
            failed=$((failed + 1))
            log_error "Stopping due to migration failure"
            break
        fi
    done

    echo ""
    log_info "Summary: $applied applied, $failed failed"

    [[ $failed -eq 0 ]]
}

# Rollback last migration
rollback_last() {
    local last_migration
    last_migration=$(run_sql "SELECT version, rollback_sql FROM schema_migrations WHERE status = 'success' ORDER BY applied_at DESC LIMIT 1")

    if [[ -z "$last_migration" ]]; then
        log_warn "No migrations to rollback"
        return 0
    fi

    local version rollback_sql
    version=$(echo "$last_migration" | cut -d'|' -f1)
    rollback_sql=$(echo "$last_migration" | cut -d'|' -f2)

    if [[ -z "$rollback_sql" ]]; then
        log_error "Migration $version has no rollback SQL defined"
        log_warn "Manual rollback required"
        return 1
    fi

    log_info "Rolling back migration: $version"

    if run_sql "$rollback_sql"; then
        run_sql "SELECT rollback_migration('$version')"
        log_success "Rolled back $version"
    else
        log_error "Rollback failed for $version"
        return 1
    fi
}

# Validate all migrations have checksums matching files
validate() {
    log_info "Validating migration integrity..."

    local issues=0

    for file in "${MIGRATIONS_DIR}"/*.sql; do
        [[ -f "$file" ]] || continue
        [[ "$(basename "$file")" == "00-schema-migrations-table.sql" ]] && continue

        local version expected_checksum actual_checksum
        version=$(get_version_from_filename "$file")
        expected_checksum=$(calculate_checksum "$file")
        actual_checksum=$(run_sql "SELECT checksum FROM schema_migrations WHERE version = '$version' AND status = 'success'" || echo "")

        if [[ -n "$actual_checksum" && "$expected_checksum" != "$actual_checksum" ]]; then
            log_error "Checksum mismatch for $version"
            log_error "  Expected: $expected_checksum"
            log_error "  Recorded: $actual_checksum"
            issues=$((issues + 1))
        fi
    done

    if [[ $issues -eq 0 ]]; then
        log_success "All migrations validated successfully"
    else
        log_error "Found $issues integrity issues"
    fi

    return $issues
}

# Create a new migration file
create_migration() {
    local name="$1"
    local date_prefix
    date_prefix=$(date +%Y-%m-%d)

    # Find next sequence number for today
    local seq=1
    while [[ -f "${MIGRATIONS_DIR}/${date_prefix}-$(printf '%03d' $seq)-*.sql" ]]; do
        seq=$((seq + 1))
    done

    local filename="${date_prefix}-$(printf '%03d' $seq)-${name}.sql"
    local filepath="${MIGRATIONS_DIR}/${filename}"

    cat > "$filepath" <<EOF
-- ============================================================================
-- Migration: ${name}
-- Version: ${date_prefix}-$(printf '%03d' $seq)
-- Created: $(date -Iseconds)
-- ============================================================================

-- Add your migration SQL here
-- Follow AGENTS.md guidelines:
--   - Use IF NOT EXISTS for idempotency
--   - Prefer additive, backward-compatible changes
--   - Add CHECK constraints for invariants
--   - Include audit fields (created_at, updated_at, created_by, updated_by)

BEGIN;

-- Your migration SQL goes here

COMMIT;

-- Optional: Add rollback SQL below (uncomment and fill in)
-- ROLLBACK SQL:
-- BEGIN;
-- -- Rollback statements
-- COMMIT;
EOF

    log_success "Created: ${filename}"
    echo "  Edit: ${filepath}"
}

# Main command parser
main() {
    ensure_migrations_table

    case "${1:-status}" in
        status|s)
            show_status
            ;;
        apply|a)
            if [[ -n "${2:-}" ]]; then
                # Apply specific migration
                apply_migration "${MIGRATIONS_DIR}/$2"
            else
                apply_all
            fi
            ;;
        rollback|r)
            rollback_last
            ;;
        validate|v)
            validate
            ;;
        create|c)
            if [[ -z "${2:-}" ]]; then
                log_error "Usage: migrate.sh create <migration-name>"
                exit 1
            fi
            create_migration "$2"
            ;;
        help|h|--help|-h)
            echo "Tartware Database Migration Runner"
            echo ""
            echo "Usage: migrate.sh <command> [args]"
            echo ""
            echo "Commands:"
            echo "  status, s           Show migration status and pending migrations"
            echo "  apply, a [file]     Apply all pending or specific migration"
            echo "  rollback, r         Rollback the last applied migration"
            echo "  validate, v         Validate migration file checksums"
            echo "  create, c <name>    Create a new migration file"
            echo "  help, h             Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  PGHOST              Database host (default: localhost)"
            echo "  PGPORT              Database port (default: 5432)"
            echo "  PGDATABASE          Database name (default: tartware)"
            echo "  PGUSER              Database user (default: postgres)"
            ;;
        *)
            log_error "Unknown command: $1"
            echo "Run 'migrate.sh help' for usage"
            exit 1
            ;;
    esac
}

main "$@"
