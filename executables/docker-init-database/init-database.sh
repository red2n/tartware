#!/bin/bash
# =====================================================
# init-database.sh
# Main Database Initialization Orchestrator
#
# This is the entry point for Docker database initialization.
# It handles:
# - Checking if database exists
# - Optionally dropping and recreating database
# - Running all SQL scripts
# - Verification
#
# Environment Variables:
#   TARTWARE_DROP_EXISTING: Drop database if exists (default: true for dev)
#   TARTWARE_RUN_VERIFICATION: Run verify-all.sql (default: true)
#   TARTWARE_BACKUP_BEFORE_DROP: Backup before drop (default: false)
#
# Date: October 15, 2025
# =====================================================

set -e  # Exit on any error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration from environment
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="tartware"
DROP_EXISTING="${TARTWARE_DROP_EXISTING:-true}"
RUN_VERIFICATION="${TARTWARE_RUN_VERIFICATION:-true}"
BACKUP_BEFORE_DROP="${TARTWARE_BACKUP_BEFORE_DROP:-false}"
SCRIPTS_DIR="/docker-entrypoint-initdb.d/scripts"
BACKUP_DIR="/backups"
LOG_FILE="/tmp/tartware-init-main.log"

# Start logging
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

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
echo -e "${CYAN}║            ${BLUE}Property Management System - Database Setup${NC}           ${CYAN}║${NC}"
echo -e "${CYAN}║                                                                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} Initializing Tartware PMS Database..."
echo ""

# Configuration Summary
echo -e "${BLUE}Configuration:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Database:            ${CYAN}$POSTGRES_DB${NC}"
echo -e "  User:                ${CYAN}$POSTGRES_USER${NC}"
echo -e "  Drop Existing:       ${CYAN}$DROP_EXISTING${NC}"
echo -e "  Run Verification:    ${CYAN}$RUN_VERIFICATION${NC}"
echo -e "  Backup Before Drop:  ${CYAN}$BACKUP_BEFORE_DROP${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =====================================================
# FUNCTION: Check if database exists
# =====================================================
check_database_exists() {
    psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'" | grep -q 1
}

# =====================================================
# FUNCTION: Backup database
# =====================================================
backup_database() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} Creating backup..."

    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"

    # Backup filename with timestamp
    BACKUP_FILE="$BACKUP_DIR/tartware_backup_$(date +%Y%m%d_%H%M%S).sql"

    if pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE" 2>&1; then
        echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✓ Backup created: $BACKUP_FILE"
        echo -e "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
    else
        echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✗ Backup failed (continuing anyway)"
    fi
    echo ""
}

# =====================================================
# MAIN LOGIC
# =====================================================

# Step 1: Check if database exists
echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} Checking if database exists..."

if check_database_exists; then
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} Database '$POSTGRES_DB' already exists"

    if [ "$DROP_EXISTING" = "true" ]; then
        echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} DROP_EXISTING=true, will recreate database"
        echo ""

        # Optional: Backup before drop
        if [ "$BACKUP_BEFORE_DROP" = "true" ]; then
            backup_database
        fi

        # Drop and recreate
        echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} Executing drop-and-recreate.sql..."
        if psql -U "$POSTGRES_USER" -d postgres -f "$SCRIPTS_DIR/docker/drop-and-recreate.sql" 2>&1; then
            echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✓ Database dropped and recreated"
        else
            echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✗ Failed to drop/recreate database"
            exit 1
        fi
    else
        echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} DROP_EXISTING=false, skipping initialization"
        echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} Database already exists and ready to use"
        echo ""
        echo -e "${CYAN}Tip: To reinitialize, set TARTWARE_DROP_EXISTING=true${NC}"
        echo ""
        exit 0
    fi
else
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} Database does not exist, will create fresh"
    echo ""

    # Create database
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} Creating database '$POSTGRES_DB'..."
    if psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $POSTGRES_DB;" 2>&1; then
        echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✓ Database created"
    else
        echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✗ Failed to create database"
        exit 1
    fi
fi

echo ""

# Step 2: Run all SQL scripts
echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} Starting script execution..."
echo ""

if bash "$SCRIPTS_DIR/docker/run-all-scripts.sh"; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║  ✓✓✓ TARTWARE PMS DATABASE INITIALIZATION COMPLETE ✓✓✓   ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Database is ready for use!${NC}"
    echo ""
    echo -e "Quick Access:"
    echo -e "  • PostgreSQL: ${CYAN}psql -U postgres -d tartware${NC}"
    echo -e "  • PgAdmin:    ${CYAN}http://localhost:5050${NC}"
    echo -e "  • Container:  ${CYAN}docker exec -it tartware-postgres bash${NC}"
    echo ""
    echo -e "Logs: $LOG_FILE"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}║  ✗✗✗ DATABASE INITIALIZATION FAILED ✗✗✗                   ║${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Check logs for details: $LOG_FILE${NC}"
    echo ""
    exit 1
fi
