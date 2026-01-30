#!/bin/bash
# ============================================================================
# Tartware PMS - Database Setup Script
# Supports Direct PostgreSQL and Docker deployments
# Uses modern tools: ripgrep (rg) and fd for better performance
# ============================================================================

set -e

# ============================================================================
# Parse Command Line Arguments
# ============================================================================

DEPLOY_MODE="direct"

for arg in "$@"; do
    case $arg in
        --mode=*)
            DEPLOY_MODE="${arg#*=}"
            shift
            ;;
        --mode)
            DEPLOY_MODE="$2"
            shift
            shift
            ;;
        --help|-h)
            echo "Tartware PMS Database Setup Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --mode=MODE    Deployment mode: direct or docker (default: direct)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Modes:"
            echo "  direct         Direct PostgreSQL installation (requires psql)"
            echo "  docker         Docker-based deployment (requires docker-compose)"
            echo ""
            echo "Examples:"
            echo "  $0                      # Direct mode (default)"
            echo "  $0 --mode=direct       # Direct mode (explicit)"
            echo "  $0 --mode=docker       # Docker mode"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate mode
if [[ ! "$DEPLOY_MODE" =~ ^(direct|docker)$ ]]; then
    echo "Invalid mode: $DEPLOY_MODE"
    echo "Must be 'direct' or 'docker'"
    exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Simple spinner for long-running commands
run_with_spinner() {
    local message="$1"
    shift
    local log_file
    log_file="$(mktemp)"
    local spin='|/-\\'
    local i=0

    "$@" >"$log_file" 2>&1 &
    local pid=$!

    while kill -0 "$pid" 2>/dev/null; do
        printf "\r%s %c" "$message" "${spin:i%4:1}"
        i=$((i + 1))
        sleep 0.2
    done

    wait "$pid"
    local status=$?
    if [ $status -ne 0 ]; then
        printf "\r%s ... failed\n" "$message"
        cat "$log_file"
        rm -f "$log_file"
        return $status
    fi

    printf "\r%s ... done\n" "$message"
    rm -f "$log_file"
    return 0
}

# Resolve repository paths (script now lives under executables/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SCRIPTS_DIR="${REPO_ROOT}/scripts"

# ============================================================================
# Docker Mode Handler
# ============================================================================

if [ "$DEPLOY_MODE" == "docker" ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                     TARTWARE PMS - Docker Mode                 ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""

    # Check Docker prerequisites
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker is not installed${NC}"
        echo "   Install: https://docs.docker.com/get-docker/"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker: $(docker --version)${NC}"

    # Check for docker compose (new) or docker-compose (old)
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
        echo -e "${GREEN}✓ Docker Compose: $(docker compose version --short)${NC}"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
        echo -e "${GREEN}✓ Docker Compose: $(docker-compose --version)${NC}"
    else
        echo -e "${RED}✗ Docker Compose is not installed${NC}"
        echo "   Install: https://docs.docker.com/compose/install/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo -e "${RED}✗ Docker daemon is not running${NC}"
        echo "   Start: sudo systemctl start docker"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker daemon: running${NC}"
    echo ""

    # Start containers
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Starting all Docker containers:"
    echo "    • PostgreSQL (database)"
    echo "    • Redis (cache)"
    echo "    • Kafka + Zookeeper (message queue)"
    echo "    • Redpanda (Kafka-compatible streaming)"
    echo "    • Kafka UI (management interface)"
    echo "    • OpenSearch (search and analytics)"
    echo "    • OpenTelemetry Collector (observability)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    run_with_spinner "Pulling Docker images" $DOCKER_COMPOSE_CMD -f "$REPO_ROOT/docker-compose.yml" pull --quiet
    run_with_spinner "Starting Docker containers" $DOCKER_COMPOSE_CMD -f "$REPO_ROOT/docker-compose.yml" up -d --pull=never
    echo ""
    echo -e "${GREEN}✓ All containers started${NC}"
    echo ""

    # Wait for PostgreSQL
    echo "Waiting for PostgreSQL to be ready..."
    RETRIES=30
    COUNT=0
    while [ $COUNT -lt $RETRIES ]; do
        if docker exec tartware-postgres pg_isready -U postgres &> /dev/null; then
            echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
            break
        fi
        COUNT=$((COUNT + 1))
        echo -n "."
        sleep 1
    done

    if [ $COUNT -eq $RETRIES ]; then
        echo ""
        echo -e "${RED}✗ PostgreSQL failed to start within 30 seconds${NC}"
        echo "   Check logs: docker-compose logs postgres"
        exit 1
    fi
    echo ""

    # Wait for initialization
    echo "Database initialization in progress..."
    sleep 10

    echo "Monitoring initialization..."
    # Count expected tables from scripts
    EXPECTED_TABLES=$(grep -r "CREATE TABLE" "$SCRIPTS_DIR/tables/" --include="*.sql" 2>/dev/null | grep -v "00-create-all-tables.sql" | wc -l)

    for i in {1..60}; do
        TABLE_COUNT=$(docker exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'availability');" 2>/dev/null | xargs || echo "0")
        if [ "$TABLE_COUNT" -ge "$EXPECTED_TABLES" ]; then
            echo -e "${GREEN}✓ Initialization complete!${NC}"
            break
        fi
        if [ $i -eq 60 ]; then
            echo -e "${YELLOW}⚠  Initialization taking longer than expected${NC}"
        fi
        sleep 1
    done
    echo ""

    # Verification
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Database Verification"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    TABLE_COUNT=$(docker exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'availability');" 2>/dev/null | xargs)
    INDEX_COUNT=$(docker exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname IN ('public', 'availability');" 2>/dev/null | xargs)
    FK_COUNT=$(docker exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema IN ('public', 'availability');" 2>/dev/null | xargs)

    echo "  Tables:       $TABLE_COUNT / $EXPECTED_TABLES"
    echo "  Indexes:      $INDEX_COUNT"
    echo "  Foreign Keys: $FK_COUNT"
    echo ""

    # Seed default data and reset passwords for local bootstrap user
    echo "Seeding default data and resetting passwords..."
    DEFAULT_DATA_SCRIPT="$SCRIPTS_DIR/data/defaults/seed-default-data.mjs"
    RESET_PASSWORD_SCRIPT="$REPO_ROOT/Apps/core-service/scripts/reset-default-password.ts"

    if [ -f "$DEFAULT_DATA_SCRIPT" ]; then
        if DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=tartware \
            node "$DEFAULT_DATA_SCRIPT"; then
            echo -e "${GREEN}✓ Default baseline data inserted${NC}"
        else
            echo -e "${YELLOW}⚠  Failed to insert default baseline data using $DEFAULT_DATA_SCRIPT${NC}"
        fi
    else
        echo -e "${YELLOW}⚠  Default data script not found at $DEFAULT_DATA_SCRIPT - skipping${NC}"
    fi

    if [ -f "$RESET_PASSWORD_SCRIPT" ]; then
        if DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=tartware \
            AUTH_DEFAULT_PASSWORD=TempPass123 NODE_ENV=development \
            npx tsx --tsconfig "$REPO_ROOT/Apps/core-service/tsconfig.json" \
            "$RESET_PASSWORD_SCRIPT"; then
            echo -e "${GREEN}✓ Default passwords reset to TempPass123${NC}"
        else
            echo -e "${YELLOW}⚠  Failed to reset default passwords using $RESET_PASSWORD_SCRIPT${NC}"
        fi
    else
        echo -e "${YELLOW}⚠  Reset password script not found at $RESET_PASSWORD_SCRIPT - skipping${NC}"
    fi

    # Success
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║           TARTWARE PMS DOCKER DEPLOYMENT COMPLETE              ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Quick Access:"
    echo "  Connect:      docker exec -it tartware-postgres psql -U postgres -d tartware"
    echo "  Logs:         docker-compose logs -f postgres"
    echo "  Stop:         docker-compose down"
    echo ""
    exit 0
fi

# ============================================================================
# Direct Mode - Continue with regular setup
# ============================================================================

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  TARTWARE PMS - Direct Mode                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# Automatic Tool Installation
# ============================================================================

INSTALL_NEEDED=false
MISSING_TOOLS=()

# Check for ripgrep (required - faster than grep)
if ! command -v rg &> /dev/null; then
    MISSING_TOOLS+=("ripgrep")
    INSTALL_NEEDED=true
fi

# Check for fd (required - faster than find)
if ! command -v fd &> /dev/null && ! command -v fdfind &> /dev/null; then
    MISSING_TOOLS+=("fd-find")
    INSTALL_NEEDED=true
fi

# Check for compiler toolchain (gcc/make)
if ! command -v gcc &> /dev/null || ! command -v make &> /dev/null; then
    MISSING_TOOLS+=("build-essential")
    INSTALL_NEEDED=true
fi

# Check for PostgreSQL client tools (psql/pg_isready)
if ! command -v psql &> /dev/null || ! command -v pg_isready &> /dev/null; then
    MISSING_TOOLS+=("postgresql-client")
    INSTALL_NEEDED=true
fi

# If tools are missing, install them automatically
if [ "$INSTALL_NEEDED" = true ]; then
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  Installing Required Tools                                    ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Missing tools:${NC}"
    for tool in "${MISSING_TOOLS[@]}"; do
        echo -e "  ${YELLOW}→${NC} $tool"
    done
    echo ""

    if command -v apt-get &> /dev/null; then
        echo -e "${CYAN}Running package update...${NC}"
        sudo apt-get update -qq

        echo -e "${CYAN}Installing required tools...${NC}"
        sudo apt-get install -y --no-install-recommends "${MISSING_TOOLS[@]}"

        echo ""
        echo -e "${GREEN}✓ All tools installed successfully${NC}"
        echo ""
    else
        echo -e "${RED}Automatic installation is not supported on this OS.${NC}"
        echo "Please install the following tools manually and re-run this script:"
        for tool in "${MISSING_TOOLS[@]}"; do
            echo "  - $tool"
        done
        exit 1
    fi
fi

# Detect fd command name (fd or fdfind)
if command -v fdfind &> /dev/null; then
    FD_CMD="fdfind"
else
    FD_CMD="fd"
fi

# Verify all tools are now available
if command -v rg &> /dev/null; then
    echo -e "${GREEN}✓ ripgrep (rg) is available${NC}"
else
    echo -e "${RED}✗ ripgrep (rg) is missing${NC}"
    exit 1
fi

if command -v "$FD_CMD" &> /dev/null; then
    echo -e "${GREEN}✓ fd ($FD_CMD) is available${NC}"
else
    echo -e "${RED}✗ fd command is missing${NC}"
    exit 1
fi

if command -v gcc &> /dev/null && command -v make &> /dev/null; then
    echo -e "${GREEN}✓ Compiler toolchain is available${NC}"
else
    echo -e "${RED}✗ gcc/make toolchain is missing${NC}"
    exit 1
fi

if command -v psql &> /dev/null && command -v pg_isready &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL client tools (psql, pg_isready) are available${NC}"
else
    echo -e "${RED}✗ PostgreSQL client tools are missing${NC}"
    echo -e "${YELLOW}Install package: postgresql-client${NC}"
    exit 1
fi
echo ""

# Configuration (Defaults for fresh install)
DB_NAME="tartware"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Set password for psql commands
export PGPASSWORD="$DB_PASSWORD"
export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD

# Start time
START_TIME=$(date +%s)

# Banner
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                                       ║${NC}"
echo -e "${CYAN}║  ${MAGENTA}████████╗ █████╗ ██████╗ ████████╗██╗    ██╗ █████╗ ██████╗ ███████╗${NC}    ${CYAN}║${NC}"
echo -e "${CYAN}║  ${MAGENTA}╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██║    ██║██╔══██╗██╔══██╗██╔════╝${NC}    ${CYAN}║${NC}"
echo -e "${CYAN}║     ${MAGENTA}██║   ███████║██████╔╝   ██║   ██║ █╗ ██║███████║██████╔╝█████╗${NC}      ${CYAN}║${NC}"
echo -e "${CYAN}║     ${MAGENTA}██║   ██╔══██║██╔══██╗   ██║   ██║███╗██║██╔══██║██╔══██╗██╔══╝${NC}      ${CYAN}║${NC}"
echo -e "${CYAN}║     ${MAGENTA}██║   ██║  ██║██║  ██║   ██║   ╚███╔███╔╝██║  ██║██║  ██║███████╗${NC}    ${CYAN}║${NC}"
echo -e "${CYAN}║     ${MAGENTA}╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝${NC}    ${CYAN}║${NC}"
echo -e "${CYAN}║                                                                                       ║${NC}"
echo -e "${CYAN}║                 Property Management System - Database Setup                        ║${NC}"
echo -e "${CYAN}║                                                                                       ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Initializing Tartware PMS Database...${NC}"
echo ""

# ============================================================================
# Installation Mode Selection (Non-interactive)
# ============================================================================

INSTALL_MODE=1
LOAD_DEFAULT_DATA=true

if [ "${TARTWARE_SEED_DEFAULTS:-true}" = "false" ]; then
    INSTALL_MODE=2
    LOAD_DEFAULT_DATA=false
fi

if [ "$LOAD_DEFAULT_DATA" = true ]; then
    echo -e "${GREEN}✓ Selected: Fresh Install + Industry Defaults${NC}"
else
    echo -e "${GREEN}✓ Selected: Fresh Install (schema only)${NC}"
fi

echo ""

# ============================================================================
# Pre-calculate Expected Counts from Scripts
# ============================================================================

echo -e "${CYAN}Analyzing database scripts...${NC}"

# Count definitively countable objects from scripts
EXPECTED_TABLES=$(rg --no-filename 'CREATE TABLE' "$SCRIPTS_DIR/tables/" 2>/dev/null | wc -l)
EXPECTED_ENUMS=$(rg 'CREATE TYPE' "$SCRIPTS_DIR/02-enum-types.sql" 2>/dev/null | wc -l)

# Count table files
TABLE_FILES=$(find "$SCRIPTS_DIR/tables/" -name "*.sql" -not -name "00-create-all-tables.sql" | wc -l)

# Validate required scripts exist
REQUIRED_SCRIPTS=(
    "$SCRIPTS_DIR/01-database-setup.sql"
    "$SCRIPTS_DIR/02-enum-types.sql"
    "$SCRIPTS_DIR/tables/00-create-all-tables.sql"
    "$SCRIPTS_DIR/indexes/00-create-all-indexes.sql"
    "$SCRIPTS_DIR/constraints/00-create-all-constraints.sql"
    "$SCRIPTS_DIR/verify-all.sql"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ ! -f "$script" ]; then
        echo -e "${RED}✗ Missing required script: $script${NC}"
        exit 1
    fi
done

# Validate table master includes
while read -r include_path; do
    include_path="$(echo "$include_path" | xargs)"
    if [ -z "$include_path" ]; then
        continue
    fi
    if [ ! -f "$SCRIPTS_DIR/tables/$include_path" ]; then
        echo -e "${RED}✗ Missing table script referenced in 00-create-all-tables.sql: $include_path${NC}"
        exit 1
    fi
done < <(rg -o '^\\ir\\s+.+$' "$SCRIPTS_DIR/tables/00-create-all-tables.sql" | sed 's/^\\ir\\s\\+//')

# For indexes and FKs, we'll use actual database counts after creation
# because PostgreSQL auto-creates additional indexes (PK, unique constraints)
# and inline FK definitions create actual constraints

echo -e "${GREEN}✓ Script analysis: ${CYAN}${EXPECTED_TABLES}${GREEN} tables, ${CYAN}${EXPECTED_ENUMS}${GREEN} enums${NC}"
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

echo -e "${BLUE}[1/14]${NC} Checking PostgreSQL connection..."

if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
    echo -e "${YELLOW}⚠  PostgreSQL is not accessible on $DB_HOST:$DB_PORT${NC}"
    echo ""

    # Check if Docker is available
    if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
        echo -e "${CYAN}Attempting to start PostgreSQL via Docker...${NC}"
        echo ""

        # Check for docker compose command
        if docker compose version &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker compose"
        elif command -v docker-compose &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker-compose"
        else
            echo -e "${RED}✗ Docker Compose is not installed${NC}"
            echo "  Install: https://docs.docker.com/compose/install/"
            exit 1
        fi

        # Start all Docker containers (will pull images if needed)
        echo "Starting all Docker services:"
        echo "  - PostgreSQL (database)"
        echo "  - Redis (cache)"
        echo "  - Kafka + Zookeeper (message queue)"
        echo "  - Redpanda (Kafka-compatible streaming)"
        echo "  - Kafka UI (management interface)"
        echo "  - OpenSearch (search and analytics)"
        echo "  - OpenTelemetry Collector (observability)"
        echo ""
        run_with_spinner "Pulling Docker images" $DOCKER_COMPOSE_CMD -f "$REPO_ROOT/docker-compose.yml" pull --quiet
        run_with_spinner "Starting Docker containers" $DOCKER_COMPOSE_CMD -f "$REPO_ROOT/docker-compose.yml" up -d --pull=never

        # Wait for PostgreSQL to be ready
        echo ""
        echo "Waiting for PostgreSQL to be ready..."
        RETRIES=30
        COUNT=0
        while [ $COUNT -lt $RETRIES ]; do
            if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
                echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
                break
            fi
            COUNT=$((COUNT + 1))
            echo -n "."
            sleep 1
        done

        if [ $COUNT -eq $RETRIES ]; then
            echo ""
            echo -e "${RED}✗ PostgreSQL failed to start within 30 seconds${NC}"
            echo "  Check logs: $DOCKER_COMPOSE_CMD logs postgres"
            exit 1
        fi
        echo ""

        # Give it a moment to fully initialize
        sleep 2
    else
        echo -e "${RED}✗ Docker is not available or not running${NC}"
        echo "  Please either:"
        echo "    1. Start PostgreSQL manually on $DB_HOST:$DB_PORT"
        echo "    2. Install and start Docker to use containerized PostgreSQL"
        echo "    3. Run with --mode=docker for full Docker deployment"
        exit 1
    fi
else
    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
fi

echo ""

# ============================================================================
# STEP 2: Drop Existing Database (Automatic Fresh Install)
# ============================================================================

echo -e "${BLUE}[2/14]${NC} Checking if database exists..."

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

echo -e "${BLUE}[3/14]${NC} Creating database '$DB_NAME'..."

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

echo -e "${BLUE}[4/14]${NC} Creating extensions and schemas..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/01-database-setup.sql" &> /dev/null

echo -e "${GREEN}✓ Extensions created: uuid-ossp, pg_trgm${NC}"
echo -e "${GREEN}✓ Schemas created: public, availability${NC}"
echo ""

# ============================================================================
# STEP 5: Create ENUM Types
# ============================================================================

echo -e "${BLUE}[5/14]${NC} Creating ${EXPECTED_ENUMS} ENUM types..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/02-enum-types.sql" &> /dev/null

ENUM_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_type WHERE typtype = 'e';" 2>/dev/null)

echo -e "${GREEN}✓ Created $ENUM_COUNT ENUM types${NC}"
echo ""

# ============================================================================
# STEP 6: Create Tables
# ============================================================================

echo -e "${BLUE}[6/14]${NC} Creating ${EXPECTED_TABLES} tables (${TABLE_FILES} files, some create multiple tables)..."

cd "$SCRIPTS_DIR"
psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/tables/00-create-all-tables.sql" > /dev/null 2>&1

TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'availability');" 2>/dev/null)

if [ "$TABLE_COUNT" -ne "$EXPECTED_TABLES" ]; then
    echo -e "${RED}✗ Table count mismatch! Expected $EXPECTED_TABLES, got $TABLE_COUNT${NC}"
    echo -e "${RED}✗ Database setup failed - not all tables were created${NC}"
    echo -e "${YELLOW}Check the logs above for errors${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Created $TABLE_COUNT tables${NC}"
echo ""

# ============================================================================
# STEP 7: Create Indexes
# ============================================================================

echo -e "${BLUE}[7/14]${NC} Creating indexes..."

psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/indexes/00-create-all-indexes.sql" > /dev/null 2>&1

INDEX_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_indexes WHERE schemaname IN ('public', 'availability');" 2>/dev/null)

echo -e "${GREEN}✓ Created $INDEX_COUNT indexes (includes auto-generated PK and unique indexes)${NC}"
echo ""

# ============================================================================
# STEP 8: Create Constraints
# ============================================================================

echo -e "${BLUE}[8/14]${NC} Creating foreign key constraints..."

cd "$SCRIPTS_DIR/constraints"
psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "00-create-all-constraints.sql" > /dev/null 2>&1
cd "$SCRIPTS_DIR"

FK_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';" 2>/dev/null)

echo -e "${GREEN}✓ Created $FK_COUNT foreign key constraints${NC}"
echo ""

# ============================================================================
# STEP 9: Auto-generate Missing FK Indexes
# ============================================================================

echo -e "${BLUE}[9/14]${NC} Creating missing foreign key indexes..."

psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/indexes/99_auto_fk_indexes.sql" > /dev/null 2>&1

echo -e "${GREEN}✓ Missing foreign key indexes created${NC}"
echo ""

# ============================================================================
# STEP 10: Seed Default Operational Data (optional)
# ============================================================================

if [ "$LOAD_DEFAULT_DATA" = true ]; then
    echo -e "${BLUE}[10/14]${NC} Seeding industry-standard default data..."
    DEFAULT_DATA_SCRIPT="$SCRIPTS_DIR/data/defaults/seed-default-data.mjs"

    if [ -f "$DEFAULT_DATA_SCRIPT" ]; then
        if node "$DEFAULT_DATA_SCRIPT"; then
            echo -e "${GREEN}✓ Default baseline data inserted${NC}"
        else
            echo -e "${RED}✗ Failed to seed default data via $DEFAULT_DATA_SCRIPT${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠  Default data script not found at $DEFAULT_DATA_SCRIPT - skipping${NC}"
    fi

    # Reset passwords to match AUTH_DEFAULT_PASSWORD
    RESET_PASSWORD_SCRIPT="$REPO_ROOT/Apps/core-service/scripts/reset-default-password.ts"
    DEFAULT_PASSWORD="${AUTH_DEFAULT_PASSWORD:-TempPass123}"
    if [ -f "$RESET_PASSWORD_SCRIPT" ]; then
        echo -e "${CYAN}Resetting user passwords to default...${NC}"
        if DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" DB_NAME="$DB_NAME" \
            AUTH_DEFAULT_PASSWORD="$DEFAULT_PASSWORD" NODE_ENV=development \
            npx tsx --tsconfig "$REPO_ROOT/Apps/core-service/tsconfig.json" "$RESET_PASSWORD_SCRIPT"; then
            echo -e "${GREEN}✓ Default passwords reset to '$DEFAULT_PASSWORD'${NC}"
        else
            echo -e "${YELLOW}⚠  Failed to reset default passwords${NC}"
        fi
    fi
else
    echo -e "${BLUE}[10/14]${NC} Skipping default data seed (mode does not require it)${NC}"
fi

echo ""

# ============================================================================
# STEP 11: Create Stored Procedures
# ============================================================================

echo -e "${BLUE}[11/14]${NC} Creating stored procedures..."

psql -q -v scripts_dir="$SCRIPTS_DIR" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/procedures/00-create-all-procedures.sql" > /dev/null 2>&1

PROCEDURE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p');" 2>/dev/null)

echo -e "${GREEN}✓ Created $PROCEDURE_COUNT stored procedures${NC}"
echo ""

# ============================================================================
# STEP 12: Install Trigger & Monitoring Suite
# ============================================================================

echo -e "${BLUE}[12/14]${NC} Installing trigger suite (query safety & optimistic locking)..."

psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/triggers/00-create-all-efficiency-triggers.sql" > /dev/null 2>&1

echo -e "${GREEN}✓ Trigger suite installed${NC}"
echo ""

# ============================================================================
# STEP 13: Add User-Friendly Constraint Messages
# ============================================================================

echo -e "${BLUE}[13/14]${NC} Adding user-friendly constraint error messages..."

psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/add_friendly_constraint_messages.sql" > /dev/null 2>&1

echo -e "${GREEN}✓ Friendly constraint messages added${NC}"
echo ""

# ============================================================================
# STEP 14: Verification
# ============================================================================

echo -e "${BLUE}[14/14]${NC} Running verification..."

psql -v scripts_dir="$SCRIPTS_DIR" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/verify-all.sql" 2>&1 | tail -30

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

# Tables - should match exactly
if [ "$TABLE_COUNT" -eq "$EXPECTED_TABLES" ]; then
    echo -e "  Tables:              ${GREEN}$TABLE_COUNT${NC} (from ${TABLE_FILES} SQL files) ${GREEN}✓${NC}"
else
    echo -e "  Tables:              ${YELLOW}$TABLE_COUNT${NC} / Expected: ${CYAN}$EXPECTED_TABLES${NC} ${YELLOW}⚠${NC}"
fi

# ENUMs - should match exactly
if [ "$ENUM_COUNT" -eq "$EXPECTED_ENUMS" ]; then
    echo -e "  ENUM Types:          ${GREEN}$ENUM_COUNT${NC} ${GREEN}✓${NC}"
else
    echo -e "  ENUM Types:          ${YELLOW}$ENUM_COUNT${NC} / Expected: ${CYAN}$EXPECTED_ENUMS${NC} ${YELLOW}⚠${NC}"
fi

# Indexes - actual count (includes auto-generated)
echo -e "  Indexes:             ${GREEN}$INDEX_COUNT${NC} ${CYAN}(includes auto-generated PK/unique indexes)${NC}"

# Foreign Keys - actual count (includes inline definitions)
echo -e "  Foreign Keys:        ${GREEN}$FK_COUNT${NC} ${CYAN}(from constraints + inline table definitions)${NC}"

echo ""
echo -e "  ${CYAN}Data Snapshot:${NC}"
if [ "$LOAD_DEFAULT_DATA" = true ]; then
    echo -e "    Default Seed:      ${GREEN}applied${NC}"
else
    echo -e "    Default Seed:      ${YELLOW}skipped (schema only)${NC}"
fi

# Ensure PGPASSWORD is exported for subshells
export PGPASSWORD="$DB_PASSWORD"

# Get exact total records from database
TOTAL_DATA_RECORDS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
    SELECT COALESCE(SUM(n_tup_ins)::bigint, 0)
    FROM pg_stat_user_tables
    WHERE schemaname IN ('public', 'availability');
" 2>/dev/null)

# Get count of tables with data
DATA_TABLES_POPULATED=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
    SELECT COUNT(*)
    FROM pg_stat_user_tables
    WHERE schemaname IN ('public', 'availability')
    AND n_tup_ins > 0;
" 2>/dev/null)

# Total tables (matches count from creation step)
TOTAL_TABLE_COUNT=$TABLE_COUNT

# Calculate coverage percentage
if [ "$TOTAL_TABLE_COUNT" -gt 0 ]; then
    DATA_COVERAGE=$((DATA_TABLES_POPULATED * 100 / TOTAL_TABLE_COUNT))
else
    DATA_COVERAGE=0
fi

# Show data statistics with color coding
if [ "$DATA_TABLES_POPULATED" -eq "$TOTAL_TABLE_COUNT" ]; then
    echo -e "  Total Records:       ${GREEN}${TOTAL_DATA_RECORDS}${NC}"
    echo -e "  Tables Populated:    ${GREEN}${DATA_TABLES_POPULATED}${NC} / ${CYAN}${TOTAL_TABLE_COUNT}${NC} ${GREEN}(${DATA_COVERAGE}%) ✓${NC}"
elif [ "$DATA_TABLES_POPULATED" -gt 0 ]; then
    echo -e "  Total Records:       ${GREEN}${TOTAL_DATA_RECORDS}${NC}"
    echo -e "  Tables Populated:    ${YELLOW}${DATA_TABLES_POPULATED}${NC} / ${CYAN}${TOTAL_TABLE_COUNT}${NC} ${YELLOW}(${DATA_COVERAGE}%)${NC}"

    EMPTY_COUNT=$((TOTAL_TABLE_COUNT - DATA_TABLES_POPULATED))
    echo ""
    echo -e "  ${YELLOW}⚠  ${EMPTY_COUNT} tables without data:${NC}"
    echo -e "     ${CYAN}Use information_schema.tables to inspect empty tables if needed.${NC}"
else
    echo -e "  Total Records:       ${YELLOW}${TOTAL_DATA_RECORDS}${NC}"
    echo -e "  Tables Populated:    ${YELLOW}${DATA_TABLES_POPULATED}${NC} / ${CYAN}${TOTAL_TABLE_COUNT}${NC} ${YELLOW}(${DATA_COVERAGE}%)${NC}"
fi

echo ""
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
