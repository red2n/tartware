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
echo "✓ ENUM types created (60+ definitions)"

# Create all tables
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 3: Creating 119 Tables ═══"
cd "$SCRIPTS_DIR"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "tables/00-create-all-tables.sql"
echo "✓ All 119 tables created across 7 domains"

# Create all indexes
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 4: Creating ~1,900 Indexes ═══"
cd "$SCRIPTS_DIR/indexes"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "00-create-all-indexes.sql"
echo "✓ Comprehensive index pack applied (~1,900 indexes including PK/unique)"

# Create all constraints
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 5: Creating ~1,050 Constraints ═══"
cd "$SCRIPTS_DIR/constraints"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "00-create-all-constraints.sql"
echo "✓ All foreign key packs applied (~1,050 foreign key constraints)"

# Run verification if enabled
if [ "${TARTWARE_RUN_VERIFICATION:-true}" = "true" ]; then
    echo ""
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ Phase 6: Verification ═══"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "tartware" -f "$SCRIPTS_DIR/verify-all.sql"
    echo "✓ Verification complete"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✓✓✓ TARTWARE DATABASE INITIALIZATION COMPLETE ✓✓✓            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
