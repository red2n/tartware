#!/bin/bash
# Tartware PostgreSQL Custom Entrypoint Script
# This script wraps the standard PostgreSQL entrypoint to add Tartware-specific initialization

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[Tartware Init]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[Tartware Init]${NC} $1"
}

log_error() {
    echo -e "${RED}[Tartware Init]${NC} $1"
}

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    log_info "Waiting for PostgreSQL to be ready..."
    until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q; do
        echo -n "."
        sleep 1
    done
    echo ""
    log_info "PostgreSQL is ready"
}

# Function to check if database needs initialization
needs_initialization() {
    if [ -z "$(ls -A /var/lib/postgresql/data 2>/dev/null)" ]; then
        return 0  # Empty directory, needs initialization
    fi
    return 1  # Data exists
}

# Function to setup Tartware initialization scripts
setup_init_scripts() {
    log_info "Setting up Tartware initialization scripts..."
    
    local init_dir="/docker-entrypoint-initdb.d"
    
    # Make scripts executable
    if [ -d "${init_dir}/scripts" ]; then
        log_info "Making scripts executable..."
        find "${init_dir}/scripts" -type f -name "*.sql" -o -name "*.sh" | while read -r script; do
            chmod +r "$script" 2>/dev/null || true
        done
        find "${init_dir}/scripts" -type f -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true
    fi
    
    # Create a master initialization script
    cat > "${init_dir}/00-tartware-init.sh" << 'INIT_SCRIPT'
#!/bin/bash
# Tartware Database Initialization Master Script

set -e

echo "============================================"
echo "Tartware Database Initialization"
echo "============================================"
echo ""

# Check environment variables
TARTWARE_DROP_EXISTING=${TARTWARE_DROP_EXISTING:-false}
TARTWARE_RUN_VERIFICATION=${TARTWARE_RUN_VERIFICATION:-false}
TARTWARE_BACKUP_BEFORE_DROP=${TARTWARE_BACKUP_BEFORE_DROP:-false}

echo "Configuration:"
echo "  Drop existing: $TARTWARE_DROP_EXISTING"
echo "  Run verification: $TARTWARE_RUN_VERIFICATION"
echo "  Backup before drop: $TARTWARE_BACKUP_BEFORE_DROP"
echo ""

# Function to run SQL file
run_sql() {
    local file=$1
    local db=${2:-$POSTGRES_DB}
    echo "Running: $(basename $file)"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" -f "$file"
}

# Check if tartware database exists
DB_EXISTS=$(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname='tartware'")

if [ "$DB_EXISTS" = "1" ]; then
    echo "Database 'tartware' already exists"
    
    if [ "$TARTWARE_DROP_EXISTING" = "true" ]; then
        echo "Dropping existing database..."
        
        if [ "$TARTWARE_BACKUP_BEFORE_DROP" = "true" ]; then
            echo "Creating backup..."
            pg_dump -U "$POSTGRES_USER" tartware > /tmp/tartware_backup_$(date +%Y%m%d_%H%M%S).sql || true
        fi
        
        # Terminate existing connections
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" -c \
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='tartware' AND pid <> pg_backend_pid();" || true
        
        # Drop database
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" -c "DROP DATABASE IF EXISTS tartware;"
        echo "Database dropped"
    else
        echo "Skipping database initialization (already exists)"
        exit 0
    fi
fi

# Create tartware database
echo "Creating database 'tartware'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" -c "CREATE DATABASE tartware;"

# Run initialization scripts in order
SCRIPTS_DIR="/docker-entrypoint-initdb.d/scripts"

if [ -d "$SCRIPTS_DIR" ]; then
    echo ""
    echo "Running initialization scripts..."
    
    # Run scripts in specific order
    for script_num in 01 02; do
        for script in "$SCRIPTS_DIR"/${script_num}-*.sql; do
            if [ -f "$script" ]; then
                run_sql "$script" "tartware"
            fi
        done
    done
    
    # Run table creation scripts
    if [ -d "$SCRIPTS_DIR/tables" ]; then
        echo ""
        echo "Creating tables..."
        for script in "$SCRIPTS_DIR/tables"/*.sql; do
            if [ -f "$script" ]; then
                run_sql "$script" "tartware"
            fi
        done
    fi
    
    # Run constraint scripts
    if [ -d "$SCRIPTS_DIR/constraints" ]; then
        echo ""
        echo "Adding constraints..."
        for script in "$SCRIPTS_DIR/constraints"/*.sql; do
            if [ -f "$script" ]; then
                run_sql "$script" "tartware"
            fi
        done
    fi
    
    # Run index scripts
    if [ -d "$SCRIPTS_DIR/indexes" ]; then
        echo ""
        echo "Creating indexes..."
        for script in "$SCRIPTS_DIR/indexes"/*.sql; do
            if [ -f "$script" ]; then
                run_sql "$script" "tartware"
            fi
        done
    fi
    
    # Run procedure scripts
    if [ -d "$SCRIPTS_DIR/procedures" ]; then
        echo ""
        echo "Creating procedures..."
        for script in "$SCRIPTS_DIR/procedures"/*.sql; do
            if [ -f "$script" ]; then
                run_sql "$script" "tartware"
            fi
        done
    fi
    
    # Run trigger scripts
    if [ -d "$SCRIPTS_DIR/triggers" ]; then
        echo ""
        echo "Creating triggers..."
        for script in "$SCRIPTS_DIR/triggers"/*.sql; do
            if [ -f "$script" ]; then
                run_sql "$script" "tartware"
            fi
        done
    fi
    
    # Run friendly constraint messages
    if [ -f "$SCRIPTS_DIR/add_friendly_constraint_messages.sql" ]; then
        echo ""
        echo "Adding friendly constraint messages..."
        run_sql "$SCRIPTS_DIR/add_friendly_constraint_messages.sql" "tartware"
    fi
    
    # Run verification if requested
    if [ "$TARTWARE_RUN_VERIFICATION" = "true" ]; then
        echo ""
        echo "Running verification scripts..."
        for script in "$SCRIPTS_DIR"/verify-*.sql; do
            if [ -f "$script" ]; then
                echo "Verifying: $(basename $script)"
                run_sql "$script" "tartware" || echo "Warning: Verification failed"
            fi
        done
    fi
    
    echo ""
    echo "============================================"
    echo "Tartware Database Initialization Complete"
    echo "============================================"
else
    echo "Warning: Scripts directory not found: $SCRIPTS_DIR"
fi
INIT_SCRIPT

    chmod +x "${init_dir}/00-tartware-init.sh"
    log_info "Initialization scripts ready"
}

# Main execution
log_info "Starting Tartware PostgreSQL container..."
log_info "PostgreSQL Version: $(postgres --version)"

# Check if this is first run
if needs_initialization; then
    log_info "First run detected - database will be initialized"
    setup_init_scripts
else
    log_info "Data directory exists - using existing data"
    
    # Still setup scripts in case of re-initialization
    if [ "${TARTWARE_DROP_EXISTING:-false}" = "true" ]; then
        log_warn "TARTWARE_DROP_EXISTING is set - database will be dropped and recreated"
        setup_init_scripts
    fi
fi

# Export environment variables for the PostgreSQL entrypoint
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-postgres}"

log_info "Handing off to PostgreSQL entrypoint..."
echo ""

# Call the original PostgreSQL entrypoint
exec docker-entrypoint.sh postgres "$@"
