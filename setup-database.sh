#!/bin/bash
# ============================================================================
# Tartware PMS - Database Setup Script
# Supports Direct PostgreSQL and Docker deployments
# Uses modern tools: ripgrep (rg) and fd for better performance
# ============================================================================

set -e

# ============================================================================
# Parse Command Line Arguments & Auto-detect Docker
# ============================================================================

DEPLOY_MODE="auto"

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
            echo "  --mode=MODE    Deployment mode: auto, direct, or docker (default: auto)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Modes:"
            echo "  auto           Auto-detect (checks for Docker container, falls back to direct)"
            echo "  direct         Direct PostgreSQL installation (requires psql)"
            echo "  docker         Docker-based deployment (requires docker-compose)"
            echo ""
            echo "Examples:"
            echo "  $0                      # Auto-detect mode (default)"
            echo "  $0 --mode=auto         # Auto-detect mode (explicit)"
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
if [[ ! "$DEPLOY_MODE" =~ ^(auto|direct|docker)$ ]]; then
    echo "Invalid mode: $DEPLOY_MODE"
    echo "Must be 'auto', 'direct', or 'docker'"
    exit 1
fi

# Auto-detect Docker deployment
if [ "$DEPLOY_MODE" == "auto" ]; then
    DOCKER_FOUND=false

    # Try without sudo first
    if command -v docker &> /dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "tartware-postgres"; then
        DOCKER_FOUND=true
    # Try with sudo if user docker fails
    elif command -v docker &> /dev/null && sudo docker ps --format '{{.Names}}' 2>/dev/null | grep -q "tartware-postgres"; then
        DOCKER_FOUND=true
    fi

    if [ "$DOCKER_FOUND" = true ]; then
        DEPLOY_MODE="docker"
        echo -e "${GREEN}✓ Auto-detected: Docker deployment (tartware-postgres container running)${NC}"
    else
        DEPLOY_MODE="direct"
        echo -e "${CYAN}ℹ Auto-detected: Direct deployment (no Docker container found)${NC}"
    fi
    echo ""
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

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

    # Determine if sudo is needed for docker commands
    DOCKER_NEEDS_SUDO=false
    if ! docker info &> /dev/null; then
        if sudo docker info &> /dev/null; then
            DOCKER_NEEDS_SUDO=true
        else
            echo -e "${RED}✗ Docker daemon is not running${NC}"
            echo "   Start: sudo systemctl start docker"
            exit 1
        fi
    fi

    # Check for docker compose (new) or docker-compose (old)
    if [ "$DOCKER_NEEDS_SUDO" = true ]; then
        DOCKER_COMPOSE_CMD="sudo docker compose"
        DOCKER_CMD="sudo docker"
        echo -e "${GREEN}✓ Docker Compose: $(sudo docker compose version --short)${NC}"
    else
        if docker compose version &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker compose"
            DOCKER_CMD="docker"
            echo -e "${GREEN}✓ Docker Compose: $(docker compose version --short)${NC}"
        elif command -v docker-compose &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker-compose"
            DOCKER_CMD="docker"
            echo -e "${GREEN}✓ Docker Compose: $(docker-compose --version)${NC}"
        else
            echo -e "${RED}✗ Docker Compose is not installed${NC}"
            echo "   Install: https://docs.docker.com/compose/install/"
            exit 1
        fi
    fi

    echo -e "${GREEN}✓ Docker daemon: running${NC}"
    echo ""

    # Start containers
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Starting Docker containers..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    $DOCKER_COMPOSE_CMD up -d
    echo ""
    echo -e "${GREEN}✓ Containers started${NC}"
    echo ""

    # Wait for PostgreSQL
    echo "Waiting for PostgreSQL to be ready..."
    RETRIES=30
    COUNT=0
    while [ $COUNT -lt $RETRIES ]; do
        if $DOCKER_CMD exec tartware-postgres pg_isready -U postgres &> /dev/null; then
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
    SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)"
    EXPECTED_TABLES=$(grep -r "CREATE TABLE" "$SCRIPTS_DIR/tables/" --include="*.sql" 2>/dev/null | grep -v "00-create-all-tables.sql" | wc -l)

    for i in {1..60}; do
        TABLE_COUNT=$($DOCKER_CMD exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'availability');" 2>/dev/null | xargs || echo "0")
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
    TABLE_COUNT=$($DOCKER_CMD exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'availability');" 2>/dev/null | xargs)
    INDEX_COUNT=$($DOCKER_CMD exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname IN ('public', 'availability');" 2>/dev/null | xargs)
    FK_COUNT=$($DOCKER_CMD exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema IN ('public', 'availability');" 2>/dev/null | xargs)

    echo "  Tables:       $TABLE_COUNT / $EXPECTED_TABLES"
    echo "  Indexes:      $INDEX_COUNT"
    echo "  Foreign Keys: $FK_COUNT"
    echo ""

    # ============================================================================
    # Interactive Mode Selection for Docker
    # ============================================================================

    echo -e "${CYAN}Select Installation Mode:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  ${GREEN}1)${NC} Load Sample Data (recommended for development/testing) ${YELLOW}[DEFAULT]${NC}"
    echo -e "  ${GREEN}2)${NC} Skip Sample Data (empty database structure only)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -ne "${CYAN}Enter your choice [1-2] (press Enter for default):${NC} "
    read -r DOCKER_DATA_MODE

    # Default to load sample data if no input
    if [ -z "$DOCKER_DATA_MODE" ]; then
        DOCKER_DATA_MODE=1
    fi

    # Validate input
    if [[ ! "$DOCKER_DATA_MODE" =~ ^[1-2]$ ]]; then
        echo -e "${RED}✗ Invalid option. Defaulting to Load Sample Data.${NC}"
        DOCKER_DATA_MODE=1
    fi

    echo ""

    if [ "$DOCKER_DATA_MODE" -eq 1 ]; then
        echo -e "${GREEN}✓ Selected: Load Sample Data${NC}"
        LOAD_SAMPLE_DATA=true
    else
        echo -e "${GREEN}✓ Selected: Skip Sample Data${NC}"
        LOAD_SAMPLE_DATA=false
    fi

    echo ""

    # ============================================================================
    # Load Sample Data in Docker Mode
    # ============================================================================

    if [ "$LOAD_SAMPLE_DATA" = true ]; then
        echo -e "${BLUE}Loading sample data with category tracking...${NC}"
        echo ""

        # Check if Python 3 is available
        if ! command -v python3 &> /dev/null; then
            echo -e "${YELLOW}⚠  Python 3 not found${NC}"

            # Attempt to install Python if on supported OS
            if command -v apt-get &> /dev/null; then
                echo -e "${CYAN}Installing Python 3...${NC}"
                sudo apt-get update -qq
                sudo apt-get install -y python3 python3-pip

                if command -v python3 &> /dev/null; then
                    echo -e "${GREEN}✓ Python 3 installed successfully${NC}"
                else
                    echo -e "${RED}✗ Failed to install Python 3${NC}"
                    echo -e "${YELLOW}⚠  You can load data manually later with: cd scripts/data && python3 load_all.py${NC}"
                    LOAD_SAMPLE_DATA=false
                fi
            else
                echo -e "${YELLOW}⚠  You can load data manually later with: cd scripts/data && python3 load_all.py${NC}"
                LOAD_SAMPLE_DATA=false
            fi
        fi

        # Check and install Python dependencies if Python is available
        if [ "$LOAD_SAMPLE_DATA" = true ]; then
            echo -e "${CYAN}Checking Python dependencies...${NC}"

            # First check if pip is available
            if ! python3 -m pip --version &> /dev/null; then
                echo -e "${YELLOW}pip not found, installing...${NC}"

                if command -v apt-get &> /dev/null; then
                    sudo apt-get update -qq
                    sudo apt-get install -y python3-pip

                    if python3 -m pip --version &> /dev/null; then
                        echo -e "${GREEN}✓ pip installed successfully${NC}"
                    else
                        echo -e "${RED}✗ Failed to install pip${NC}"
                        echo -e "${YELLOW}⚠  Cannot install Python packages${NC}"
                        LOAD_SAMPLE_DATA=false
                    fi
                else
                    echo -e "${RED}✗ Cannot install pip automatically${NC}"
                    LOAD_SAMPLE_DATA=false
                fi
            fi

            if [ "$LOAD_SAMPLE_DATA" = true ]; then
                PYTHON_PACKAGES_NEEDED=false
                MISSING_PY_PACKAGES=()

                # Check for required Python packages
                if ! python3 -c "import faker" &> /dev/null; then
                    MISSING_PY_PACKAGES+=("faker")
                    PYTHON_PACKAGES_NEEDED=true
                fi

                if ! python3 -c "import psycopg2" &> /dev/null; then
                    MISSING_PY_PACKAGES+=("psycopg2-binary")
                    PYTHON_PACKAGES_NEEDED=true
                fi

                if [ "$PYTHON_PACKAGES_NEEDED" = true ]; then
                    echo -e "${YELLOW}Installing missing Python packages: ${MISSING_PY_PACKAGES[*]}${NC}"

                    # Try installing via apt first (Debian packages)
                    APT_PACKAGES=()
                    for pkg in "${MISSING_PY_PACKAGES[@]}"; do
                        case "$pkg" in
                            "faker")
                                APT_PACKAGES+=("python3-faker")
                                ;;
                            "psycopg2-binary")
                                APT_PACKAGES+=("python3-psycopg2")
                                ;;
                        esac
                    done

                    if [ ${#APT_PACKAGES[@]} -gt 0 ] && command -v apt-get &> /dev/null; then
                        echo -e "${CYAN}Installing via apt: ${APT_PACKAGES[*]}${NC}"
                        DEBIAN_FRONTEND=noninteractive sudo apt-get install -y -qq "${APT_PACKAGES[@]}" 2>&1 | grep -v "^debconf:" || true

                        # Verify installation
                        ALL_INSTALLED=true
                        if ! python3 -c "import faker" &> /dev/null; then
                            ALL_INSTALLED=false
                        fi
                        if ! python3 -c "import psycopg2" &> /dev/null; then
                            ALL_INSTALLED=false
                        fi

                        if [ "$ALL_INSTALLED" = true ]; then
                            echo -e "${GREEN}✓ Python packages installed successfully${NC}"
                        else
                            echo -e "${YELLOW}⚠  Some packages failed via apt, trying pip with --break-system-packages...${NC}"
                            python3 -m pip install --break-system-packages "${MISSING_PY_PACKAGES[@]}" --quiet 2>&1 || true

                            # Check again
                            if python3 -c "import faker; import psycopg2" &> /dev/null; then
                                echo -e "${GREEN}✓ Python packages installed successfully via pip${NC}"
                            else
                                echo -e "${RED}✗ Failed to install Python packages${NC}"
                                echo -e "${YELLOW}⚠  Sample data loading may fail${NC}"
                            fi
                        fi
                    else
                        # Fallback to pip with --break-system-packages
                        python3 -m pip install --break-system-packages "${MISSING_PY_PACKAGES[@]}" --quiet 2>&1 || true

                        if python3 -c "import faker; import psycopg2" &> /dev/null; then
                            echo -e "${GREEN}✓ Python packages installed successfully${NC}"
                        else
                            echo -e "${RED}✗ Failed to install Python packages${NC}"
                            echo -e "${YELLOW}⚠  Sample data loading may fail${NC}"
                        fi
                    fi
                else
                    echo -e "${GREEN}✓ All required Python packages are installed${NC}"
                fi
            fi
            echo ""
        fi

        # Load sample data if all checks passed
        if [ "$LOAD_SAMPLE_DATA" = true ]; then
            echo -e "${CYAN}Starting data import process...${NC}"
            echo ""

            # Set environment variables for Docker connection
            export DB_HOST="localhost"
            export DB_PORT="5432"
            export DB_NAME="tartware"
            export DB_USER="postgres"
            export DB_PASSWORD="postgres"

            # Run the sample data script with live output, using unbuffered mode and timeout
            timeout 600 bash -c "cd '$SCRIPTS_DIR/data' && python3 -u load_all.py" 2>&1 | while IFS= read -r line; do
                echo "$line"

                # Detect category completion and add visual flags
                if [[ "$line" == *"CORE BUSINESS DATA"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"housekeeping tasks"* ]]; then
                    echo -e "${GREEN}✓✓✓ CORE BUSINESS DATA - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"FINANCIAL OPERATIONS"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"financial closures"* ]]; then
                    echo -e "${GREEN}✓✓✓ FINANCIAL OPERATIONS - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"CHANNEL MANAGEMENT"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"commission rules"* ]]; then
                    echo -e "${GREEN}✓✓✓ CHANNEL MANAGEMENT & OTA - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"GUEST MANAGEMENT"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"GDPR consent logs"* ]]; then
                    echo -e "${GREEN}✓✓✓ GUEST MANAGEMENT - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"REVENUE MANAGEMENT"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"revenue goals"* ]]; then
                    echo -e "${GREEN}✓✓✓ REVENUE MANAGEMENT & PRICING - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"ANALYTICS & REPORTING"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"audit logs"* ]]; then
                    echo -e "${GREEN}✓✓✓ ANALYTICS & REPORTING - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"STAFF & OPERATIONS"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"reservation status history"* ]]; then
                    echo -e "${GREEN}✓✓✓ STAFF & OPERATIONS - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"MARKETING & SALES"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"commission tracking"* ]]; then
                    echo -e "${GREEN}✓✓✓ MARKETING & SALES - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"MOBILE & DIGITAL"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"push notifications"* ]]; then
                    echo -e "${GREEN}✓✓✓ MOBILE & DIGITAL - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"COMPLIANCE & LEGAL"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"lost and found"* ]]; then
                    echo -e "${GREEN}✓✓✓ COMPLIANCE & LEGAL - COMPLETED${NC}"
                    echo ""
                elif [[ "$line" == *"INTEGRATIONS & TECHNICAL"* ]]; then
                    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                elif [[ "$line" == *"vendor contracts"* ]]; then
                    echo -e "${GREEN}✓✓✓ INTEGRATIONS & TECHNICAL - COMPLETED${NC}"
                    echo ""
                fi
            done

            PIPE_STATUS=${PIPESTATUS[0]}

            if [ $PIPE_STATUS -eq 0 ]; then
                # Calculate exact total records across all tables
                TOTAL_RECORDS=$($DOCKER_CMD exec tartware-postgres psql -U postgres -d tartware -tAc "
                    SELECT SUM(n_tup_ins)::bigint
                    FROM pg_stat_user_tables
                    WHERE schemaname IN ('public', 'availability');
                " 2>/dev/null)

                # Get count of tables with data
                TABLES_WITH_DATA=$($DOCKER_CMD exec tartware-postgres psql -U postgres -d tartware -tAc "
                    SELECT COUNT(*)
                    FROM pg_stat_user_tables
                    WHERE schemaname IN ('public', 'availability')
                    AND n_tup_ins > 0;
                " 2>/dev/null)

                echo ""
                echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
                echo -e "${GREEN}║  ✓✓✓ ALL DATA LOADING COMPLETE ✓✓✓                       ║${NC}"
                echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
                echo -e "${GREEN}✓ Sample data loaded successfully${NC}"
                echo -e "  Total Records: ${CYAN}${TOTAL_RECORDS}${NC}"
                echo -e "  Tables with Data: ${CYAN}${TABLES_WITH_DATA}${NC} / ${CYAN}${TABLE_COUNT}${NC}"
            else
                echo -e "${YELLOW}⚠  Sample data load encountered issues${NC}"
                echo -e "${YELLOW}⚠  Database structure is complete, data can be loaded manually${NC}"
            fi
        fi
    fi

    echo ""

    # Success
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║           TARTWARE PMS DOCKER DEPLOYMENT COMPLETE              ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Quick Access:"
    echo "  Connect:      $DOCKER_CMD exec -it tartware-postgres psql -U postgres -d tartware"
    echo "  Logs:         $DOCKER_COMPOSE_CMD logs -f postgres"
    echo "  Stop:         $DOCKER_COMPOSE_CMD down"
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

# Check for Python 3 and pip
if ! command -v python3 &> /dev/null; then
    MISSING_TOOLS+=("python3")
    INSTALL_NEEDED=true
fi

if ! command -v pip3 &> /dev/null && ! python3 -m pip --version &> /dev/null 2>&1; then
    MISSING_TOOLS+=("python3-pip")
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

if command -v python3 &> /dev/null; then
    echo -e "${GREEN}✓ Python 3 is available ($(python3 --version))${NC}"
else
    echo -e "${RED}✗ Python 3 is missing${NC}"
    exit 1
fi

if command -v pip3 &> /dev/null || python3 -m pip --version &> /dev/null 2>&1; then
    echo -e "${GREEN}✓ pip is available${NC}"
else
    echo -e "${RED}✗ pip is missing${NC}"
    exit 1
fi

# Check and install Python packages for sample data loading
echo ""
echo -e "${CYAN}Checking Python dependencies for sample data loading...${NC}"

PYTHON_PACKAGES_NEEDED=false
MISSING_PACKAGES=()

# Check for required Python packages
if ! python3 -c "import faker" &> /dev/null; then
    MISSING_PACKAGES+=("faker")
    PYTHON_PACKAGES_NEEDED=true
fi

if ! python3 -c "import psycopg2" &> /dev/null; then
    MISSING_PACKAGES+=("psycopg2-binary")
    PYTHON_PACKAGES_NEEDED=true
fi

if [ "$PYTHON_PACKAGES_NEEDED" = true ]; then
    echo -e "${YELLOW}Missing Python packages:${NC}"
    for pkg in "${MISSING_PACKAGES[@]}"; do
        echo -e "  ${YELLOW}→${NC} $pkg"
    done
    echo ""
    echo -e "${CYAN}Installing Python packages...${NC}"

    # Try installing via apt first (Debian packages)
    APT_PACKAGES=()
    for pkg in "${MISSING_PACKAGES[@]}"; do
        case "$pkg" in
            "faker")
                APT_PACKAGES+=("python3-faker")
                ;;
            "psycopg2-binary")
                APT_PACKAGES+=("python3-psycopg2")
                ;;
        esac
    done

    if [ ${#APT_PACKAGES[@]} -gt 0 ] && command -v apt-get &> /dev/null; then
        echo -e "${CYAN}Installing via apt: ${APT_PACKAGES[*]}${NC}"
        DEBIAN_FRONTEND=noninteractive sudo apt-get install -y -qq "${APT_PACKAGES[@]}" 2>&1 | grep -v "^debconf:" || true

        # Verify installation
        ALL_INSTALLED=true
        if ! python3 -c "import faker" &> /dev/null; then
            ALL_INSTALLED=false
        fi
        if ! python3 -c "import psycopg2" &> /dev/null; then
            ALL_INSTALLED=false
        fi

        if [ "$ALL_INSTALLED" = true ]; then
            echo -e "${GREEN}✓ Python packages installed successfully${NC}"
        else
            echo -e "${YELLOW}⚠  Some packages failed via apt, trying pip with --break-system-packages...${NC}"
            python3 -m pip install --break-system-packages "${MISSING_PACKAGES[@]}" --quiet 2>&1 || true

            # Check again
            if python3 -c "import faker; import psycopg2" &> /dev/null; then
                echo -e "${GREEN}✓ Python packages installed successfully via pip${NC}"
            else
                echo -e "${RED}✗ Failed to install Python packages${NC}"
                echo -e "${YELLOW}⚠  Sample data loading may not work properly${NC}"
            fi
        fi
    else
        # Fallback to pip with --break-system-packages
        python3 -m pip install --break-system-packages "${MISSING_PACKAGES[@]}" --quiet 2>&1 || true

        if python3 -c "import faker; import psycopg2" &> /dev/null; then
            echo -e "${GREEN}✓ Python packages installed successfully${NC}"
        else
            echo -e "${RED}✗ Failed to install Python packages${NC}"
            echo -e "${YELLOW}⚠  Sample data loading may not work properly${NC}"
        fi
    fi
else
    echo -e "${GREEN}✓ All required Python packages are installed${NC}"
fi

echo ""

# Configuration (Defaults for fresh install)
DB_NAME="tartware"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)"

# Set password for psql commands
export PGPASSWORD="$DB_PASSWORD"

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
# Installation Mode Selection
# ============================================================================

echo -e "${CYAN}Select Installation Mode:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}1)${NC} Fresh Install (Drop existing DB, create everything, load sample data) ${YELLOW}[DEFAULT]${NC}"
echo -e "  ${GREEN}2)${NC} Load Sample Data Only (Keep existing DB structure, reload data)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -ne "${CYAN}Enter your choice [1-2] (press Enter for default):${NC} "
read -r INSTALL_MODE

# Default to fresh install if no input
if [ -z "$INSTALL_MODE" ]; then
    INSTALL_MODE=1
fi

# Validate input
if [[ ! "$INSTALL_MODE" =~ ^[1-2]$ ]]; then
    echo -e "${RED}✗ Invalid option. Defaulting to Fresh Install.${NC}"
    INSTALL_MODE=1
fi

echo ""

if [ "$INSTALL_MODE" -eq 1 ]; then
    echo -e "${GREEN}✓ Selected: Fresh Install${NC}"
    DO_FRESH_INSTALL=true
    LOAD_SAMPLE_DATA=true
else
    echo -e "${GREEN}✓ Selected: Load Sample Data Only${NC}"
    DO_FRESH_INSTALL=false
    LOAD_SAMPLE_DATA=true
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

# Skip structure creation if only loading data
if [ "$DO_FRESH_INSTALL" = false ]; then
    echo -e "${BLUE}Skipping database structure creation - loading data only${NC}"
    echo ""

    # Check if database exists
    DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "")

    if [ "$DB_EXISTS" != "1" ]; then
        echo -e "${RED}✗ Database '$DB_NAME' does not exist!${NC}"
        echo -e "${YELLOW}⚠  Please run Fresh Install first to create the database structure.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Database '$DB_NAME' exists${NC}"
    echo ""

    # Jump to sample data loading
    jump_to_sample_data=true
else
    jump_to_sample_data=false
fi

if [ "$jump_to_sample_data" = false ]; then

echo -e "${BLUE}[1/12]${NC} Checking PostgreSQL connection..."

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

echo -e "${BLUE}[2/12]${NC} Checking if database exists..."

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

echo -e "${BLUE}[3/12]${NC} Creating database '$DB_NAME'..."

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

echo -e "${BLUE}[4/12]${NC} Creating extensions and schemas..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/01-database-setup.sql" &> /dev/null

echo -e "${GREEN}✓ Extensions created: uuid-ossp, pg_trgm${NC}"
echo -e "${GREEN}✓ Schemas created: public, availability${NC}"
echo ""

# ============================================================================
# STEP 5: Create ENUM Types
# ============================================================================

echo -e "${BLUE}[5/12]${NC} Creating ${EXPECTED_ENUMS} ENUM types..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/02-enum-types.sql" &> /dev/null

ENUM_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_type WHERE typtype = 'e';" 2>/dev/null)

echo -e "${GREEN}✓ Created $ENUM_COUNT ENUM types${NC}"
echo ""

# ============================================================================
# STEP 6: Create Tables
# ============================================================================

echo -e "${BLUE}[6/12]${NC} Creating ${EXPECTED_TABLES} tables (${TABLE_FILES} files, some create multiple tables)..."

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

echo -e "${BLUE}[7/12]${NC} Creating indexes..."

psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/indexes/00-create-all-indexes.sql" > /dev/null 2>&1

INDEX_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_indexes WHERE schemaname IN ('public', 'availability');" 2>/dev/null)

echo -e "${GREEN}✓ Created $INDEX_COUNT indexes (includes auto-generated PK and unique indexes)${NC}"
echo ""

# ============================================================================
# STEP 8: Create Constraints
# ============================================================================

echo -e "${BLUE}[8/12]${NC} Creating foreign key constraints..."

cd "$SCRIPTS_DIR/constraints"
psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "00-create-all-constraints.sql" > /dev/null 2>&1
cd "$SCRIPTS_DIR"

FK_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';" 2>/dev/null)

echo -e "${GREEN}✓ Created $FK_COUNT foreign key constraints${NC}"
echo ""

# ============================================================================
# STEP 9: Create Stored Procedures
# ============================================================================

echo -e "${BLUE}[9/13]${NC} Creating stored procedures..."

psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/procedures/00-create-all-procedures.sql" > /dev/null 2>&1

PROCEDURE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p');" 2>/dev/null)

echo -e "${GREEN}✓ Created $PROCEDURE_COUNT stored procedures${NC}"
echo ""

# ============================================================================
# STEP 10: Install Trigger & Monitoring Suite
# ============================================================================

echo -e "${BLUE}[10/13]${NC} Installing trigger suite (query safety & optimistic locking)..."

psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/triggers/00-create-all-efficiency-triggers.sql" > /dev/null 2>&1

echo -e "${GREEN}✓ Trigger suite installed${NC}"
echo ""

# ============================================================================
# STEP 11: Add User-Friendly Constraint Messages
# ============================================================================

echo -e "${BLUE}[11/13]${NC} Adding user-friendly constraint error messages..."

psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/add_friendly_constraint_messages.sql" > /dev/null 2>&1

echo -e "${GREEN}✓ Friendly constraint messages added${NC}"
echo ""

fi  # End of structure creation block (DO_FRESH_INSTALL)

# ============================================================================
# STEP 12: Verification
# ============================================================================

if [ "$DO_FRESH_INSTALL" = true ]; then
    echo -e "${BLUE}[12/13]${NC} Running verification..."

    VERIFY_LOG=$(mktemp -t tartware-verify-XXXX.log)
    echo -e "${CYAN}Verification output will be written to:${NC} ${VERIFY_LOG}"

    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/verify-all.sql" &> "$VERIFY_LOG"; then
        tail -30 "$VERIFY_LOG"
        rm -f "$VERIFY_LOG"
    else
        tail -30 "$VERIFY_LOG"
        echo ""
        echo -e "${RED}✗ Verification failed. Full log:${NC} ${VERIFY_LOG}"
        echo -e "${YELLOW}⚠  See log for detailed failure output.${NC}"
        exit 1
    fi

    echo ""
fi

# ============================================================================
# STEP 13: Load Sample Data
# ============================================================================

if [ "$LOAD_SAMPLE_DATA" = true ]; then

if [ "$DO_FRESH_INSTALL" = true ]; then
    echo -e "${BLUE}[13/13]${NC} Loading sample data with category tracking..."
else
    echo -e "${BLUE}Loading sample data with category tracking...${NC}"
fi
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}⚠  Python 3 not found, skipping sample data load${NC}"
    echo -e "${YELLOW}⚠  You can load data manually later with: cd scripts/data && python3 load_all.py${NC}"
else
    # Set environment variables for the Python script
    export DB_HOST="$DB_HOST"
    export DB_PORT="$DB_PORT"
    export DB_NAME="$DB_NAME"
    export DB_USER="$DB_USER"
    export DB_PASSWORD="$DB_PASSWORD"

    # Run the sample data script (new modular structure) with live output
    cd "$SCRIPTS_DIR/data" && python3 load_all.py 2>&1 | while IFS= read -r line; do
        echo "$line"

        # Detect category completion and add visual flags
        if [[ "$line" == *"CORE BUSINESS DATA"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"housekeeping tasks"* ]]; then
            echo -e "${GREEN}✓✓✓ CORE BUSINESS DATA - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"FINANCIAL OPERATIONS"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"financial closures"* ]]; then
            echo -e "${GREEN}✓✓✓ FINANCIAL OPERATIONS - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"CHANNEL MANAGEMENT"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"commission rules"* ]]; then
            echo -e "${GREEN}✓✓✓ CHANNEL MANAGEMENT & OTA - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"GUEST MANAGEMENT"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"GDPR consent logs"* ]]; then
            echo -e "${GREEN}✓✓✓ GUEST MANAGEMENT - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"REVENUE MANAGEMENT"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"revenue goals"* ]]; then
            echo -e "${GREEN}✓✓✓ REVENUE MANAGEMENT & PRICING - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"ANALYTICS & REPORTING"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"audit logs"* ]]; then
            echo -e "${GREEN}✓✓✓ ANALYTICS & REPORTING - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"STAFF & OPERATIONS"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"reservation status history"* ]]; then
            echo -e "${GREEN}✓✓✓ STAFF & OPERATIONS - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"MARKETING & SALES"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"commission tracking"* ]]; then
            echo -e "${GREEN}✓✓✓ MARKETING & SALES - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"MOBILE & DIGITAL"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"push notifications"* ]]; then
            echo -e "${GREEN}✓✓✓ MOBILE & DIGITAL - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"COMPLIANCE & LEGAL"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"lost and found"* ]]; then
            echo -e "${GREEN}✓✓✓ COMPLIANCE & LEGAL - COMPLETED${NC}"
            echo ""
        elif [[ "$line" == *"INTEGRATIONS & TECHNICAL"* ]]; then
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        elif [[ "$line" == *"vendor contracts"* ]]; then
            echo -e "${GREEN}✓✓✓ INTEGRATIONS & TECHNICAL - COMPLETED${NC}"
            echo ""
        fi
    done

    PIPE_STATUS=${PIPESTATUS[0]}

    # Re-seed system settings catalog (sample loader truncates via cascade)
    psql -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPTS_DIR/tables/01-core/06_settings.sql" > /dev/null 2>&1

    if [ $PIPE_STATUS -eq 0 ]; then
        # Calculate exact total records across all tables
        TOTAL_RECORDS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT SUM(n_tup_ins)::bigint
            FROM pg_stat_user_tables
            WHERE schemaname IN ('public', 'availability');
        " 2>/dev/null)

        # Get count of tables with data
        TABLES_WITH_DATA=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT COUNT(*)
            FROM pg_stat_user_tables
            WHERE schemaname IN ('public', 'availability')
            AND n_tup_ins > 0;
        " 2>/dev/null)

        # Get count of total tables
        TOTAL_TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema IN ('public', 'availability');
        " 2>/dev/null)

        echo ""
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓✓✓ ALL DATA LOADING COMPLETE ✓✓✓                       ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        echo -e "${GREEN}✓ Sample data loaded successfully${NC}"
        echo -e "  Total Records: ${CYAN}${TOTAL_RECORDS}${NC}"
        echo -e "  Tables with Data: ${CYAN}${TABLES_WITH_DATA}${NC} / ${CYAN}${TOTAL_TABLES}${NC}"
    else
        echo -e "${YELLOW}⚠  Sample data load encountered issues${NC}"
        echo -e "${YELLOW}⚠  Database structure is complete, data can be loaded manually${NC}"
    fi
fi  # End of Python check

fi  # End of LOAD_SAMPLE_DATA block

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
if [ "$DO_FRESH_INSTALL" = true ]; then
    echo -e "${GREEN}║  ✓✓✓ TARTWARE PMS DATABASE SETUP COMPLETE ✓✓✓                ║${NC}"
else
    echo -e "${GREEN}║  ✓✓✓ TARTWARE PMS SAMPLE DATA LOADED ✓✓✓                     ║${NC}"
fi
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}Database Statistics:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Database:            ${GREEN}$DB_NAME${NC}"

if [ "$DO_FRESH_INSTALL" = true ]; then

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

fi  # End of DO_FRESH_INSTALL stats

echo ""
echo -e "  ${CYAN}Sample Data:${NC}"

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

# Get total table count
if [ "$DO_FRESH_INSTALL" = true ]; then
    TOTAL_TABLE_COUNT=$TABLE_COUNT
else
    TOTAL_TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema IN ('public', 'availability');
    " 2>/dev/null)
fi

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

    # Show list of empty tables using the Python script
    EMPTY_COUNT=$((TOTAL_TABLE_COUNT - DATA_TABLES_POPULATED))
    echo ""
    echo -e "  ${YELLOW}⚠  ${EMPTY_COUNT} tables without data:${NC}"

    # Run the Python script and format output
    python3 scripts/data/list_empty_tables.py 2>/dev/null | rg "^ *[0-9]+\." | head -20 | while IFS= read -r line; do
        echo -e "     ${CYAN}${line}${NC}"
    done

    if [ "$EMPTY_COUNT" -gt 20 ]; then
        echo -e "     ${CYAN}... and $((EMPTY_COUNT - 20)) more${NC}"
    fi
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
