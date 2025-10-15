#!/bin/bash
# =====================================================
# run-all-scripts.sh
# Execute All Tartware SQL Scripts in Correct Order
# 
# This script orchestrates the complete database setup:
# 1. Database setup (extensions, schemas)
# 2. ENUM types
# 3. All tables (01-37)
# 4. All indexes
# 5. All constraints
# 6. Verification (optional)
#
# Date: October 15, 2025
# =====================================================

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="tartware"
SCRIPTS_DIR="/docker-entrypoint-initdb.d/scripts"
LOG_FILE="/tmp/tartware-init.log"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_section() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

# Start timing
START_TIME=$(date +%s)

log_section "TARTWARE PMS - DATABASE INITIALIZATION"
log "Starting database setup..."
log "Target database: $POSTGRES_DB"
log "PostgreSQL user: $POSTGRES_USER"
echo ""

# =====================================================
# PHASE 1: DATABASE SETUP
# =====================================================
log_section "PHASE 1: DATABASE SETUP (Extensions & Schemas)"

log "Executing: 01-database-setup.sql"
if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SCRIPTS_DIR/01-database-setup.sql" -q >> "$LOG_FILE" 2>&1; then
    log "✓ Database setup complete (extensions, schemas)"
else
    log_error "Failed to execute database setup"
    exit 1
fi

# =====================================================
# PHASE 2: ENUM TYPES
# =====================================================
log_section "PHASE 2: ENUM TYPES"

log "Executing: 02-enum-types.sql"
if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SCRIPTS_DIR/02-enum-types.sql" -q >> "$LOG_FILE" 2>&1; then
    log "✓ ENUM types created (30+ types)"
else
    log_error "Failed to create ENUM types"
    exit 1
fi

# =====================================================
# PHASE 3: TABLES CREATION (01-37)
# =====================================================
log_section "PHASE 3: TABLES CREATION (37 tables)"

# Array of table files in order
TABLE_FILES=(
    "01_tenants.sql"
    "02_users.sql"
    "03_user_tenant_associations.sql"
    "04_properties.sql"
    "05_guests.sql"
    "06_room_types.sql"
    "07_rooms.sql"
    "08_rates.sql"
    "09_availability_room_availability.sql"
    "10_reservations.sql"
    "11_reservation_status_history.sql"
    "12_payments.sql"
    "13_invoices.sql"
    "14_invoice_items.sql"
    "15_services.sql"
    "16_reservation_services.sql"
    "17_housekeeping_tasks.sql"
    "18_channel_mappings.sql"
    "19_analytics_metrics.sql"
    "20_analytics_metric_dimensions.sql"
    "21_analytics_reports.sql"
    "22_report_property_ids.sql"
    "23_performance_reporting_tables.sql"
    "24_performance_alerting_tables.sql"
    "25_folios.sql"
    "26_charge_postings.sql"
    "27_audit_logs.sql"
    "28_business_dates.sql"
    "29_night_audit_log.sql"
    "30_deposit_schedules.sql"
    "31_allotments.sql"
    "32_booking_sources.sql"
    "33_market_segments.sql"
    "34_guest_preferences.sql"
    "35_refunds.sql"
    "36_rate_overrides.sql"
    "37_maintenance_requests.sql"
)

TABLES_CREATED=0
TABLES_TOTAL=${#TABLE_FILES[@]}

for table_file in "${TABLE_FILES[@]}"; do
    TABLE_PATH="$SCRIPTS_DIR/tables/$table_file"
    
    if [ -f "$TABLE_PATH" ]; then
        log "Creating table: $table_file"
        if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$TABLE_PATH" -q >> "$LOG_FILE" 2>&1; then
            ((TABLES_CREATED++))
        else
            log_error "Failed to create table: $table_file"
            exit 1
        fi
    else
        log_warning "Table file not found: $table_file (skipping)"
    fi
done

log "✓ Tables created: $TABLES_CREATED/$TABLES_TOTAL"

# =====================================================
# PHASE 4: INDEXES CREATION
# =====================================================
log_section "PHASE 4: INDEXES CREATION (350+ indexes)"

log "Executing: indexes/00-create-all-indexes.sql"
if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SCRIPTS_DIR/indexes/00-create-all-indexes.sql" -q >> "$LOG_FILE" 2>&1; then
    log "✓ All indexes created successfully"
else
    log_error "Failed to create indexes"
    exit 1
fi

# =====================================================
# PHASE 5: CONSTRAINTS CREATION
# =====================================================
log_section "PHASE 5: CONSTRAINTS CREATION (150+ foreign keys)"

log "Executing: constraints/00-create-all-constraints.sql"
if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SCRIPTS_DIR/constraints/00-create-all-constraints.sql" -q >> "$LOG_FILE" 2>&1; then
    log "✓ All constraints created successfully"
else
    log_error "Failed to create constraints"
    exit 1
fi

# =====================================================
# PHASE 6: VERIFICATION (Optional)
# =====================================================
if [ "${TARTWARE_RUN_VERIFICATION:-true}" = "true" ]; then
    log_section "PHASE 6: VERIFICATION"
    
    log "Running comprehensive verification..."
    if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SCRIPTS_DIR/verify-all.sql" -q >> "$LOG_FILE" 2>&1; then
        log "✓ Verification complete"
        
        # Extract verification results
        log ""
        log "Verification Results:"
        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -n 50 "$LOG_FILE" | grep -E "(Total Tables|With Soft Delete|With tenant_id|Total Indexes|Foreign Keys|Quality Score|Grade|Status)" || true
    else
        log_warning "Verification completed with warnings (check logs)"
    fi
else
    log_section "PHASE 6: VERIFICATION (SKIPPED)"
    log "Verification disabled by configuration"
fi

# =====================================================
# COMPLETION SUMMARY
# =====================================================
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_section "✓ INITIALIZATION COMPLETE"

echo ""
log "════════════════════════════════════════════════════════════"
log "  TARTWARE PMS - DATABASE READY"
log "════════════════════════════════════════════════════════════"
log ""
log "  Database:          tartware"
log "  Tables Created:    $TABLES_CREATED"
log "  Indexes:           350+ (estimated)"
log "  Constraints:       150+ (estimated)"
log "  Duration:          ${DURATION}s"
log "  Status:            ✓ READY FOR USE"
log ""
log "════════════════════════════════════════════════════════════"
log ""
log "Next Steps:"
log "  1. Connect: psql -U postgres -d tartware"
log "  2. Verify:  docker exec -it tartware-postgres psql -U postgres -d tartware -c '\\dt'"
log "  3. PgAdmin: http://localhost:5050"
log ""
log "Log file: $LOG_FILE"
log ""

exit 0
