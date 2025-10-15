#!/bin/bash
# =====================================================
# 00-tartware-init.sh
# Main Tartware database initialization script
# This runs automatically via PostgreSQL's entrypoint
# =====================================================

set -Eeo pipefail

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ████████╗ █████╗ ██████╗ ████████╗██╗    ██╗ █████╗ ██████╗ ███████╗ ║"
echo "║  ╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██║    ██║██╔══██╗██╔══██╗██╔════╝ ║"
echo "║     ██║   ███████║██████╔╝   ██║   ██║ █╗ ██║███████║██████╔╝█████╗   ║"
echo "║     ██║   ██╔══██║██╔══██╗   ██║   ██║███╗██║██╔══██║██╔══██╗██╔══╝   ║"
echo "║     ██║   ██║  ██║██║  ██║   ██║   ╚███╔███╔╝██║  ██║██║  ██║███████╗ ║"
echo "║     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ║"
echo "║            Property Management System - Database Setup           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Initializing Tartware PMS Database..."
echo ""
echo "Configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Database:            tartware"
echo "  User:                ${POSTGRES_USER:-postgres}"
echo "  Run Verification:    ${TARTWARE_RUN_VERIFICATION:-true}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration
SCRIPTS_DIR="/docker-entrypoint-initdb.d/scripts"
POSTGRES_DB="tartware"

# Create tartware database
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating database 'tartware'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
	CREATE DATABASE tartware;
EOSQL
echo "✓ Database created"

# Run database setup
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 1: Database Setup ═══"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "$SCRIPTS_DIR/01-database-setup.sql"
echo "✓ Extensions and schemas created"

# Run ENUM types
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 2: ENUM Types ═══"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "$SCRIPTS_DIR/02-enum-types.sql"
echo "✓ ENUM types created"

# Create all tables
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 3: Creating 37 Tables ═══"
for TABLE_FILE in $(ls $SCRIPTS_DIR/tables/*.sql | sort); do
    TABLE_NAME=$(basename "$TABLE_FILE")
    echo "  → Creating table: $TABLE_NAME"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "$TABLE_FILE"
done
echo "✓ All 37 tables created"

# Create all indexes
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 4: Creating Indexes ═══"
for INDEX_FILE in $(ls $SCRIPTS_DIR/indexes/*.sql | grep -v "00-create-all" | sort); do
    INDEX_NAME=$(basename "$INDEX_FILE")
    echo "  → Creating indexes: $INDEX_NAME"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "$INDEX_FILE"
done
echo "✓ All indexes created"

# Create all constraints
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 5: Creating Constraints ═══"
for CONSTRAINT_FILE in $(ls $SCRIPTS_DIR/constraints/*.sql | grep -v "00-create-all" | grep -E '[0-9].*_fk\.sql$' | sort); do
    CONSTRAINT_NAME=$(basename "$CONSTRAINT_FILE")
    echo "  → Creating constraints: $CONSTRAINT_NAME"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "$CONSTRAINT_FILE"
done
echo "✓ All constraints created"

# Run verification if enabled
if [ "${TARTWARE_RUN_VERIFICATION:-true}" = "true" ]; then
    echo ""
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 6: Verification ═══"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "$SCRIPTS_DIR/verify-installation.sql"
    echo "✓ Verification complete"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✓✓✓ TARTWARE DATABASE INITIALIZATION COMPLETE ✓✓✓            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
