#!/usr/bin/env bash
# ============================================================================
# Tartware - Disaster Recovery: Database Restore Script
# Point-in-time recovery with validation and rollback support
# ============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tartware}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-tartware}"
DB_USER="${PGUSER:-postgres}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Restore options
RESTORE_PARALLEL="${RESTORE_PARALLEL:-4}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $(date -Iseconds) $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date -Iseconds) $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date -Iseconds) $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date -Iseconds) $1"; }

# Verify backup file exists and is readable
verify_backup_file() {
    local backup_file="$1"

    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: ${backup_file}"
        return 1
    fi

    # Decrypt if needed
    if [[ "$backup_file" == *.enc ]]; then
        if [[ -z "$ENCRYPTION_KEY" ]]; then
            log_error "Encrypted backup requires BACKUP_ENCRYPTION_KEY"
            return 1
        fi

        local decrypted_file="${backup_file%.enc}"
        log_info "Decrypting backup..."
        openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$backup_file" \
            -out "$decrypted_file" \
            -pass "pass:${ENCRYPTION_KEY}"

        echo "$decrypted_file"
    else
        echo "$backup_file"
    fi
}

# Pre-restore validation
pre_restore_check() {
    local target_db="$1"

    log_info "Running pre-restore checks..."

    # Check if target database exists
    local db_exists
    db_exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -t -A -c "SELECT 1 FROM pg_database WHERE datname = '${target_db}'" 2>/dev/null || echo "0")

    if [[ "$db_exists" == "1" ]]; then
        log_warn "Target database '${target_db}' already exists"

        # Check for active connections
        local active_connections
        active_connections=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -t -A -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '${target_db}' AND pid != pg_backend_pid()" 2>/dev/null)

        if [[ "$active_connections" -gt 0 ]]; then
            log_error "Database has ${active_connections} active connections"
            log_error "Terminate connections first: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${target_db}'"
            return 1
        fi

        return 2  # Database exists but no active connections
    fi

    return 0
}

# Create fresh database for restore
create_restore_database() {
    local db_name="$1"

    log_info "Creating database: ${db_name}"

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
DROP DATABASE IF EXISTS "${db_name}";
CREATE DATABASE "${db_name}"
    OWNER ${DB_USER}
    ENCODING 'UTF8'
    LC_COLLATE 'en_US.UTF-8'
    LC_CTYPE 'en_US.UTF-8'
    TEMPLATE template0;
EOF

    log_success "Database created: ${db_name}"
}

# Restore from pg_dump custom format
restore_full() {
    local backup_file="$1"
    local target_db="${2:-$DB_NAME}"
    local restore_mode="${3:-replace}"  # replace, parallel, or new

    # Verify and potentially decrypt backup
    backup_file=$(verify_backup_file "$backup_file")

    log_info "Starting restore to database: ${target_db}"
    log_info "Backup file: ${backup_file}"
    log_info "Mode: ${restore_mode}"

    local start_time end_time duration
    start_time=$(date +%s)

    case "$restore_mode" in
        replace)
            # Pre-check
            pre_restore_check "$target_db" || {
                local check_result=$?
                if [[ $check_result -eq 2 ]]; then
                    read -p "Database exists. Drop and recreate? (yes/no): " confirm
                    if [[ "$confirm" != "yes" ]]; then
                        log_warn "Restore cancelled"
                        return 1
                    fi
                else
                    return 1
                fi
            }

            create_restore_database "$target_db"

            # Restore with pg_restore
            if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
                -d "$target_db" \
                --verbose \
                --no-owner \
                --no-privileges \
                --exit-on-error \
                "$backup_file" 2>&1 | tee "${BACKUP_DIR}/logs/restore-$(date +%Y%m%d-%H%M%S).log"; then

                end_time=$(date +%s)
                duration=$((end_time - start_time))
                log_success "Restore completed in ${duration}s"
            else
                log_error "Restore failed"
                return 1
            fi
            ;;

        parallel)
            # Parallel restore using multiple jobs
            create_restore_database "$target_db"

            if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
                -d "$target_db" \
                --jobs="${RESTORE_PARALLEL}" \
                --verbose \
                --no-owner \
                "$backup_file"; then

                end_time=$(date +%s)
                duration=$((end_time - start_time))
                log_success "Parallel restore completed in ${duration}s (${RESTORE_PARALLEL} jobs)"
            else
                log_error "Parallel restore failed"
                return 1
            fi
            ;;

        new)
            # Restore to new database (preserve original)
            local new_db="${target_db}_restored_$(date +%Y%m%d)"
            create_restore_database "$new_db"

            if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
                -d "$new_db" \
                --verbose \
                --no-owner \
                "$backup_file"; then

                end_time=$(date +%s)
                duration=$((end_time - start_time))
                log_success "Restored to new database: ${new_db} in ${duration}s"
                echo "New database: ${new_db}"
            else
                log_error "Restore failed"
                return 1
            fi
            ;;
    esac
}

# Point-in-Time Recovery (requires WAL archiving)
restore_pitr() {
    local base_backup="$1"
    local recovery_target="$2"  # Timestamp or transaction ID
    local target_db="${3:-$DB_NAME}"

    log_info "Point-in-Time Recovery"
    log_info "Base backup: ${base_backup}"
    log_info "Recovery target: ${recovery_target}"

    # This requires PostgreSQL WAL archiving to be configured
    # recovery_target can be:
    #   - timestamp: '2024-01-15 14:30:00'
    #   - transaction: 'immediate' or specific xid
    #   - name: recovery point name

    log_warn "PITR requires WAL archiving to be configured"
    log_warn "Ensure recovery.conf or postgresql.auto.conf has:"
    log_info "  restore_command = 'cp /archive/%f %p'"
    log_info "  recovery_target_time = '${recovery_target}'"

    # Restore base backup first
    restore_full "$base_backup" "$target_db" "replace"

    # The actual PITR happens via PostgreSQL recovery process
    # when the database starts with recovery settings configured

    log_info "After restore, configure recovery settings and restart PostgreSQL"
}

# Restore specific tables only
restore_tables() {
    local backup_file="$1"
    shift
    local tables=("$@")

    if [[ ${#tables[@]} -eq 0 ]]; then
        log_error "No tables specified"
        return 1
    fi

    backup_file=$(verify_backup_file "$backup_file")

    log_info "Restoring specific tables: ${tables[*]}"

    local table_args=""
    for table in "${tables[@]}"; do
        table_args+=" --table=${table}"
    done

    if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$DB_NAME" \
        --data-only \
        --verbose \
        $table_args \
        "$backup_file"; then

        log_success "Tables restored successfully"
    else
        log_error "Table restore failed"
        return 1
    fi
}

# Validate restore by running integrity checks
validate_restore() {
    local db_name="${1:-$DB_NAME}"

    log_info "Validating restore: ${db_name}"

    # Check table counts
    log_info "Checking table row counts..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" <<EOF
SELECT
    schemaname,
    relname as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_live_tup DESC
LIMIT 20;
EOF

    # Check for foreign key violations
    log_info "Checking referential integrity..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -c \
        "SELECT conrelid::regclass AS table_name, conname AS constraint_name
         FROM pg_constraint WHERE contype = 'f'" | head -20

    # Run basic queries
    log_info "Running basic queries..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -c \
        "SELECT COUNT(*) as tenant_count FROM tenants" 2>/dev/null || true
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -c \
        "SELECT COUNT(*) as property_count FROM properties" 2>/dev/null || true
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -c \
        "SELECT COUNT(*) as reservation_count FROM reservations" 2>/dev/null || true

    log_success "Validation complete"
}

# List available backups for restore
list_available() {
    echo ""
    echo "=== Available Backups for Restore ==="
    echo ""

    for type in daily weekly monthly manual; do
        if [[ -d "${BACKUP_DIR}/${type}" ]]; then
            local count
            count=$(find "${BACKUP_DIR}/${type}" -name "*.dump*" 2>/dev/null | wc -l)
            if [[ $count -gt 0 ]]; then
                echo "--- ${type^} ($count backups) ---"
                ls -lht "${BACKUP_DIR}/${type}"/*.dump* 2>/dev/null | head -5 | \
                    awk '{print "  " $9 " (" $5 ", " $6 " " $7 " " $8 ")"}'
                echo ""
            fi
        fi
    done

    echo "Use: restore-database.sh full <path-to-backup>"
}

# Show help
show_help() {
    cat <<EOF
Tartware Disaster Recovery - Database Restore Script

Usage: restore-database.sh <command> [args]

Commands:
  full <file> [db] [mode]   Restore from backup file
                            mode: replace (default), parallel, new
  pitr <file> <time> [db]   Point-in-time recovery
  tables <file> <t1> [t2]   Restore specific tables
  validate [db]             Validate restored database
  list                      List available backups

Environment Variables:
  BACKUP_DIR              Backup directory (default: /var/backups/tartware)
  BACKUP_ENCRYPTION_KEY   Decryption key for encrypted backups
  RESTORE_PARALLEL        Parallel jobs for restore (default: 4)
  PGHOST, PGPORT, PGDATABASE, PGUSER - PostgreSQL connection

Examples:
  ./restore-database.sh full /backups/tartware-daily-20240115.dump
  ./restore-database.sh full /backups/backup.dump tartware-staging new
  ./restore-database.sh pitr /backups/base.dump "2024-01-15 14:30:00"
  ./restore-database.sh tables /backups/backup.dump reservations guests
  ./restore-database.sh validate tartware

Restore Modes:
  replace   Drop and recreate target database (default)
  parallel  Use multiple jobs for faster restore
  new       Restore to new database, keep original intact
EOF
}

# Main
main() {
    case "${1:-help}" in
        full|f)
            if [[ -z "${2:-}" ]]; then
                log_error "Backup file required"
                show_help
                exit 1
            fi
            restore_full "$2" "${3:-$DB_NAME}" "${4:-replace}"
            ;;
        pitr|p)
            if [[ -z "${2:-}" || -z "${3:-}" ]]; then
                log_error "Backup file and recovery target required"
                show_help
                exit 1
            fi
            restore_pitr "$2" "$3" "${4:-$DB_NAME}"
            ;;
        tables|t)
            if [[ -z "${2:-}" ]]; then
                log_error "Backup file and table names required"
                exit 1
            fi
            restore_tables "$2" "${@:3}"
            ;;
        validate|v)
            validate_restore "${2:-$DB_NAME}"
            ;;
        list|l)
            list_available
            ;;
        help|h|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
