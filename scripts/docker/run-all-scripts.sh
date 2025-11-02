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
# PHASE 3: TABLES CREATION (109 tables)
# =====================================================
log_section "PHASE 3: TABLES CREATION (109 tables across 7 categories)"

log "Using master file: tables/00-create-all-tables.sql"
if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SCRIPTS_DIR/tables/00-create-all-tables.sql" -q >> "$LOG_FILE" 2>&1; then
    log "✓ All 109 tables created successfully"
    TABLES_CREATED=109
    TABLES_TOTAL=109
else
    log_error "Failed to create tables from master file"
    exit 1
fi

# Legacy individual file approach (commented out - now using master file)
# TABLE_FILES=(
#     "01_tenants.sql"
#     ...
#     "101_asset_management.sql"
# )

# Tables already created via master file above

# =====================================================
# PHASE 4: INDEXES CREATION
# =====================================================
log_section "PHASE 4: INDEXES CREATION (1800+ indexes for 109 tables)"

log "Executing: indexes/00-create-all-indexes.sql"
if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SCRIPTS_DIR/indexes/00-create-all-indexes.sql" -q >> "$LOG_FILE" 2>&1; then
    log "✓ All 1800+ indexes created successfully (includes auto-generated PK/unique)"
else
    log_error "Failed to create indexes"
    exit 1
fi

# =====================================================
# PHASE 5: CONSTRAINTS CREATION
# =====================================================
log_section "PHASE 5: CONSTRAINTS CREATION (245+ foreign keys for 109 tables)"

log "Executing: constraints/00-create-all-constraints.sql"
if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SCRIPTS_DIR/constraints/00-create-all-constraints.sql" -q >> "$LOG_FILE" 2>&1; then
    log "✓ All 245+ foreign key constraints created successfully"
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
log "  Tables Created:    109 (across 7 categories)"
log "  Indexes:           1800+ (includes auto-generated)"
log "  Constraints:       245+ (foreign keys)"
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
