#!/usr/bin/env bash
# ============================================================================
# Tartware - Disaster Recovery: Database Backup Script
# Automated, encrypted, multi-tenant aware backups with retention management
# ============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tartware}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-12}"  # Keep weekly backups for 12 weeks
RETENTION_MONTHLY="${RETENTION_MONTHLY:-12}"  # Keep monthly backups for 12 months

DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-tartware}"
DB_USER="${PGUSER:-postgres}"

# Encryption (set BACKUP_ENCRYPTION_KEY for encrypted backups)
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# S3/Object Storage (optional)
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_PREFIX="${BACKUP_S3_PREFIX:-tartware/backups}"

# Slack/Webhook notifications (optional)
WEBHOOK_URL="${BACKUP_WEBHOOK_URL:-}"

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

# Send notification (Slack/webhook)
notify() {
    local status="$1"
    local message="$2"

    if [[ -n "$WEBHOOK_URL" ]]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"Tartware Backup [$status]: $message\"}" \
            >/dev/null 2>&1 || true
    fi
}

# Create backup directory structure
init_backup_dirs() {
    mkdir -p "${BACKUP_DIR}/daily"
    mkdir -p "${BACKUP_DIR}/weekly"
    mkdir -p "${BACKUP_DIR}/monthly"
    mkdir -p "${BACKUP_DIR}/manual"
    mkdir -p "${BACKUP_DIR}/logs"
}

# Get backup filename
get_backup_filename() {
    local type="${1:-daily}"
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    echo "tartware-${type}-${timestamp}"
}

# Full database backup using pg_dump
backup_full() {
    local type="${1:-daily}"
    local backup_name
    local backup_file
    local start_time
    local end_time
    local duration
    local size

    backup_name=$(get_backup_filename "$type")
    backup_file="${BACKUP_DIR}/${type}/${backup_name}.sql"

    log_info "Starting ${type} backup: ${backup_name}"
    start_time=$(date +%s)

    # Perform backup with custom format for faster restore
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="${backup_file}.dump" \
        2>"${BACKUP_DIR}/logs/${backup_name}.log"; then

        end_time=$(date +%s)
        duration=$((end_time - start_time))
        size=$(du -h "${backup_file}.dump" | cut -f1)

        # Encrypt if key is provided
        if [[ -n "$ENCRYPTION_KEY" ]]; then
            log_info "Encrypting backup..."
            openssl enc -aes-256-cbc -salt -pbkdf2 \
                -in "${backup_file}.dump" \
                -out "${backup_file}.dump.enc" \
                -pass "pass:${ENCRYPTION_KEY}"
            rm "${backup_file}.dump"
            backup_file="${backup_file}.dump.enc"
            size=$(du -h "${backup_file}" | cut -f1)
        else
            backup_file="${backup_file}.dump"
        fi

        # Upload to S3 if configured
        if [[ -n "$S3_BUCKET" ]]; then
            log_info "Uploading to S3..."
            aws s3 cp "$backup_file" "s3://${S3_BUCKET}/${S3_PREFIX}/${type}/$(basename "$backup_file")" \
                --storage-class STANDARD_IA
        fi

        # Create checksum
        sha256sum "$backup_file" > "${backup_file}.sha256"

        log_success "Backup completed: ${backup_name} (${size}, ${duration}s)"
        notify "SUCCESS" "Backup ${backup_name} completed (${size}, ${duration}s)"

        # Record in database
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
            "INSERT INTO backup_history (backup_name, backup_type, file_path, file_size_bytes, duration_seconds, status)
             VALUES ('${backup_name}', '${type}', '${backup_file}', $(stat -c%s "$backup_file"), ${duration}, 'success')" \
            2>/dev/null || true

        echo "$backup_file"
        return 0
    else
        log_error "Backup failed: ${backup_name}"
        notify "FAILED" "Backup ${backup_name} failed - check logs"
        return 1
    fi
}

# Incremental backup using WAL archiving check
backup_wal_status() {
    log_info "Checking WAL archiving status..."

    local archive_mode
    archive_mode=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -A -c "SHOW archive_mode" 2>/dev/null)

    if [[ "$archive_mode" == "on" ]]; then
        log_success "WAL archiving is enabled"

        # Force WAL switch for point-in-time recovery
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -c "SELECT pg_switch_wal()" 2>/dev/null
    else
        log_warn "WAL archiving is disabled - only full backups available"
        echo "To enable: Set archive_mode=on and archive_command in postgresql.conf"
    fi
}

# Backup schema only (for migrations reference)
backup_schema() {
    local backup_name
    local backup_file

    backup_name=$(get_backup_filename "schema")
    backup_file="${BACKUP_DIR}/manual/${backup_name}-schema.sql"

    log_info "Backing up schema..."

    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --schema-only \
        --no-owner \
        --no-privileges \
        > "$backup_file"

    log_success "Schema backup: ${backup_file}"
    echo "$backup_file"
}

# Backup specific tenant data (for tenant migrations/exports)
backup_tenant() {
    local tenant_id="$1"
    local backup_name
    local backup_file

    if [[ -z "$tenant_id" ]]; then
        log_error "Tenant ID required"
        return 1
    fi

    backup_name=$(get_backup_filename "tenant-${tenant_id}")
    backup_file="${BACKUP_DIR}/manual/${backup_name}.sql"

    log_info "Backing up tenant: ${tenant_id}"

    # Export tenant-specific data using COPY with WHERE clauses
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF > "$backup_file"
-- Tenant Export: ${tenant_id}
-- Generated: $(date -Iseconds)

BEGIN;

-- Tenant record
\copy (SELECT * FROM tenants WHERE id = '${tenant_id}') TO STDOUT WITH CSV HEADER;

-- Properties
\copy (SELECT * FROM properties WHERE tenant_id = '${tenant_id}') TO STDOUT WITH CSV HEADER;

-- Users associated with tenant
\copy (SELECT u.* FROM users u JOIN user_tenant_associations uta ON u.id = uta.user_id WHERE uta.tenant_id = '${tenant_id}') TO STDOUT WITH CSV HEADER;

-- Guests
\copy (SELECT * FROM guests WHERE tenant_id = '${tenant_id}') TO STDOUT WITH CSV HEADER;

-- Reservations
\copy (SELECT * FROM reservations WHERE tenant_id = '${tenant_id}') TO STDOUT WITH CSV HEADER;

-- Settings
\copy (SELECT * FROM tenant_settings WHERE tenant_id = '${tenant_id}') TO STDOUT WITH CSV HEADER;

COMMIT;
EOF

    log_success "Tenant backup: ${backup_file}"
    echo "$backup_file"
}

# Cleanup old backups based on retention policy
cleanup_old_backups() {
    log_info "Cleaning up old backups..."

    # Daily backups: keep for RETENTION_DAYS
    find "${BACKUP_DIR}/daily" -type f -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

    # Weekly backups: keep for RETENTION_WEEKLY weeks
    local weekly_days=$((RETENTION_WEEKLY * 7))
    find "${BACKUP_DIR}/weekly" -type f -mtime "+${weekly_days}" -delete 2>/dev/null || true

    # Monthly backups: keep for RETENTION_MONTHLY months
    local monthly_days=$((RETENTION_MONTHLY * 30))
    find "${BACKUP_DIR}/monthly" -type f -mtime "+${monthly_days}" -delete 2>/dev/null || true

    # Cleanup S3 if configured
    if [[ -n "$S3_BUCKET" ]]; then
        log_info "Cleaning up S3 backups..."
        # Use S3 lifecycle policies instead of manual cleanup
        # aws s3api put-bucket-lifecycle-configuration --bucket $S3_BUCKET --lifecycle-configuration file://lifecycle.json
    fi

    log_success "Cleanup completed"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"

    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: ${backup_file}"
        return 1
    fi

    log_info "Verifying backup: ${backup_file}"

    # Verify checksum if exists
    if [[ -f "${backup_file}.sha256" ]]; then
        if sha256sum -c "${backup_file}.sha256" >/dev/null 2>&1; then
            log_success "Checksum verified"
        else
            log_error "Checksum mismatch!"
            return 1
        fi
    fi

    # Verify dump format
    if [[ "$backup_file" == *.dump ]]; then
        if pg_restore --list "$backup_file" >/dev/null 2>&1; then
            log_success "Backup format verified (pg_dump custom format)"
        else
            log_error "Invalid backup format"
            return 1
        fi
    fi

    log_success "Backup verification passed"
}

# List available backups
list_backups() {
    echo ""
    echo "=== Available Backups ==="
    echo ""

    for type in daily weekly monthly manual; do
        echo "--- ${type^} Backups ---"
        if [[ -d "${BACKUP_DIR}/${type}" ]]; then
            ls -lh "${BACKUP_DIR}/${type}"/*.{dump,enc,sql} 2>/dev/null | \
                awk '{print "  " $9 " (" $5 ", " $6 " " $7 ")"}' || echo "  (none)"
        else
            echo "  (none)"
        fi
        echo ""
    done
}

# Show usage
show_help() {
    cat <<EOF
Tartware Disaster Recovery - Database Backup Script

Usage: backup-database.sh <command> [args]

Commands:
  full [type]         Full database backup (type: daily|weekly|monthly)
  schema              Backup schema only (no data)
  tenant <id>         Backup specific tenant data
  verify <file>       Verify backup integrity
  list                List available backups
  cleanup             Remove old backups per retention policy
  wal-status          Check WAL archiving status

Environment Variables:
  BACKUP_DIR              Backup directory (default: /var/backups/tartware)
  BACKUP_ENCRYPTION_KEY   AES-256 encryption key (optional)
  BACKUP_S3_BUCKET        S3 bucket for remote storage (optional)
  BACKUP_WEBHOOK_URL      Slack/webhook URL for notifications (optional)
  RETENTION_DAYS          Daily backup retention (default: 30)
  RETENTION_WEEKLY        Weekly backup retention in weeks (default: 12)
  RETENTION_MONTHLY       Monthly backup retention in months (default: 12)
  PGHOST, PGPORT, PGDATABASE, PGUSER - PostgreSQL connection

Examples:
  ./backup-database.sh full             # Daily backup
  ./backup-database.sh full weekly      # Weekly backup
  ./backup-database.sh tenant abc-123   # Backup specific tenant
  ./backup-database.sh verify /path/to/backup.dump
EOF
}

# Main
main() {
    init_backup_dirs

    case "${1:-help}" in
        full|f)
            backup_full "${2:-daily}"
            ;;
        schema|s)
            backup_schema
            ;;
        tenant|t)
            backup_tenant "${2:-}"
            ;;
        verify|v)
            verify_backup "${2:-}"
            ;;
        list|l)
            list_backups
            ;;
        cleanup|c)
            cleanup_old_backups
            ;;
        wal-status|w)
            backup_wal_status
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
