#!/bin/bash
# ============================================================================
# Tartware PMS - Database Setup Script
# Direct PostgreSQL setup (without Docker)
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration (Defaults for fresh install)
DB_NAME="tartware"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)"

# Set password for psql commands
export PGPASSWORD="$DB_PASSWORD"

# Auto-confirm fresh install (no prompts)
AUTO_CONFIRM=true

# Start time
START_TIME=$(date +%s)

# Banner
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                ║${NC}"
echo -e "${CYAN}║  ${MAGENTA}████████╗ █████╗ ██████╗ ████████╗██╗    ██╗ █████╗ ██████╗ ███████╗${NC} ${CYAN}║${NC}"
echo -e "${CYAN}║  ${MAGENTA}╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██║    ██║██╔══██╗██╔══██╗██╔════╝${NC} ${CYAN}║${NC}"
echo -e "${CYAN}║     ${MAGENTA}██║   ███████║██████╔╝   ██║   ██║ █╗ ██║███████║██████╔╝█████╗${NC}   ${CYAN}║${NC}"
echo -e "${CYAN}║     ${MAGENTA}██║   ██╔══██║██╔══██╗   ██║   ██║███╗██║██╔══██║██╔══██╗██╔══╝${NC}   ${CYAN}║${NC}"
echo -e "${CYAN}║     ${MAGENTA}██║   ██║  ██║██║  ██║   ██║   ╚███╔███╔╝██║  ██║██║  ██║███████╗${NC} ${CYAN}║${NC}"
echo -e "${CYAN}║     ${MAGENTA}╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝${NC} ${CYAN}║${NC}"
echo -e "${CYAN}║                                                                ║${NC}"
echo -e "${CYAN}║               Property Management System - Database Setup      ║${NC}"
echo -e "${CYAN}║                                                                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Initializing Tartware PMS Database...${NC}"
echo ""

# Configuration Summary
echo -e "${BLUE}Configuration:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Database:            ${CYAN}$DB_NAME${NC}"
echo -e "  Host:                ${CYAN}$DB_HOST:$DB_PORT${NC}"
echo -e "  User:                ${CYAN}$DB_USER${NC}"
echo -e "  Scripts Directory:   ${CYAN}$SCRIPTS_DIR${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# STEP 1: Check PostgreSQL Connection
# ============================================================================

echo -e "${BLUE}[1/10]${NC} Checking PostgreSQL connection..."

if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
    echo -e "${RED}✗ PostgreSQL is not accessible${NC}"
    echo "  Please ensure PostgreSQL is running on $DB_HOST:$DB_PORT"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
echo ""

# ============================================================================
# STEP 2: Drop Existing Database (Automatic Fresh Install)
# ============================================================================

echo -e "${BLUE}[2/10]${NC} Checking if database exists..."

DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${YELLOW}⚠  Database '$DB_NAME' already exists${NC}"
    echo -e "${YELLOW}⚠  Performing automatic fresh install (dropping existing database)${NC}"
    echo ""

    echo -e "${YELLOW}Terminating active connections...${NC}"
    # Terminate connections
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '$DB_NAME'
          AND pid <> pg_backend_pid();
    " &> /dev/null || true

    echo -e "${YELLOW}Dropping existing database...${NC}"
    # Drop database
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" &> /dev/null

    echo -e "${GREEN}✓ Database dropped${NC}"
else
    echo -e "${GREEN}✓ No existing database found${NC}"
fi

echo ""

# ============================================================================
# STEP 3: Create Database
# ============================================================================

echo -e "${BLUE}[3/10]${NC} Creating database '$DB_NAME'..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
    CREATE DATABASE $DB_NAME
    WITH
    OWNER = $DB_USER
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.utf8'
    LC_CTYPE = 'en_US.utf8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    TEMPLATE template0;
" &> /dev/null

echo -e "${GREEN}✓ Database created${NC}"
echo ""

# ============================================================================
# STEP 4: Create Extensions & Schemas
# ============================================================================

echo -e "${BLUE}[4/10]${NC} Creating extensions and schemas..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/01-database-setup.sql" &> /dev/null

echo -e "${GREEN}✓ Extensions created: uuid-ossp, pg_trgm${NC}"
echo -e "${GREEN}✓ Schemas created: public, availability${NC}"
echo ""

# ============================================================================
# STEP 5: Create ENUM Types
# ============================================================================

echo -e "${BLUE}[5/10]${NC} Creating ENUM types (61 types)..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/02-enum-types.sql" &> /dev/null

ENUM_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_type WHERE typtype = 'e';" 2>/dev/null)

echo -e "${GREEN}✓ Created $ENUM_COUNT ENUM types${NC}"
echo ""

# ============================================================================
# STEP 6: Create Tables
# ============================================================================

echo -e "${BLUE}[6/10]${NC} Creating 128 tables (101 files, some create multiple tables)..."

cd "$SCRIPTS_DIR"
psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/tables/00-create-all-tables.sql" > /dev/null 2>&1

TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'availability');" 2>/dev/null)

if [ "$TABLE_COUNT" -ne 128 ]; then
    echo -e "${RED}✗ Table count mismatch! Expected 128, got $TABLE_COUNT${NC}"
    echo -e "${RED}✗ Database setup failed - not all tables were created${NC}"
    echo -e "${YELLOW}Check the logs above for errors${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Created $TABLE_COUNT tables${NC}"
echo ""

# ============================================================================
# STEP 7: Create Indexes
# ============================================================================

echo -e "${BLUE}[7/10]${NC} Creating 800+ indexes..."

psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/indexes/00-create-all-indexes.sql" > /dev/null 2>&1

INDEX_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_indexes WHERE schemaname IN ('public', 'availability');" 2>/dev/null)

echo -e "${GREEN}✓ Created $INDEX_COUNT indexes${NC}"
echo ""

# ============================================================================
# STEP 8: Create Constraints
# ============================================================================

echo -e "${BLUE}[8/10]${NC} Creating 600+ foreign key constraints..."

cd "$SCRIPTS_DIR/constraints"
psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "00-create-all-constraints.sql" > /dev/null 2>&1
cd "$SCRIPTS_DIR"

FK_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';" 2>/dev/null)

echo -e "${GREEN}✓ Created $FK_COUNT foreign key constraints${NC}"
echo ""

# ============================================================================
# STEP 9: Verification
# ============================================================================

echo -e "${BLUE}[9/10]${NC} Running verification..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/verify-all.sql" 2>&1 | tail -30

echo ""

# ============================================================================
# STEP 10: Load Sample Data
# ============================================================================

echo -e "${BLUE}[10/10]${NC} Loading sample data..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}⚠  Python 3 not found, skipping sample data load${NC}"
    echo -e "${YELLOW}⚠  You can load data manually later with: python3 scripts/load_sample_data_direct.py${NC}"
else
    # Set environment variables for the Python script
    export DB_HOST="$DB_HOST"
    export DB_PORT="$DB_PORT"
    export DB_NAME="$DB_NAME"
    export DB_USER="$DB_USER"
    export DB_PASSWORD="$DB_PASSWORD"

    # Run the sample data script
    python3 "$SCRIPTS_DIR/load_sample_data_direct.py" 2>&1 | tail -50

    if [ $? -eq 0 ]; then
        RECORD_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT
                (SELECT COUNT(*) FROM tenants) +
                (SELECT COUNT(*) FROM users) +
                (SELECT COUNT(*) FROM properties) +
                (SELECT COUNT(*) FROM rooms) +
                (SELECT COUNT(*) FROM reservations) +
                (SELECT COUNT(*) FROM guests)
            AS total_records;
        " 2>/dev/null)

        echo -e "${GREEN}✓ Sample data loaded successfully (~${RECORD_COUNT}+ records)${NC}"
    else
        echo -e "${YELLOW}⚠  Sample data load encountered issues${NC}"
        echo -e "${YELLOW}⚠  Database structure is complete, data can be loaded manually${NC}"
    fi
fi

echo ""

# ============================================================================
# Completion Summary
# ============================================================================

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║  ✓✓✓ TARTWARE PMS DATABASE SETUP COMPLETE ✓✓✓                ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Database Statistics:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Database:            ${GREEN}$DB_NAME${NC}"
echo -e "  Tables:              ${GREEN}$TABLE_COUNT${NC} (128 expected)"
echo -e "  Indexes:             ${GREEN}$INDEX_COUNT${NC} (800+ expected)"
echo -e "  Foreign Keys:        ${GREEN}$FK_COUNT${NC} (600+ expected)"
echo -e "  ENUM Types:          ${GREEN}$ENUM_COUNT${NC} (61 expected)"
echo -e "  Duration:            ${GREEN}${MINUTES}m ${SECONDS}s${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${CYAN}Quick Access:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Connect:       ${YELLOW}psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME${NC}"
echo -e "  List Tables:   ${YELLOW}\\dt${NC}"
echo -e "  View Data:     ${YELLOW}SELECT * FROM tenants;${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Database is ready for use!${NC}"
echo ""

exit 0
