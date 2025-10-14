#!/bin/bash

# =====================================================
# Database Setup Script for Tartware PMS
# Creates database and executes schema and sample data
# =====================================================

set -e  # Exit on error

# Configuration
CONTAINER_NAME="tartware-postgres"
PGADMIN_CONTAINER="tartware-pgadmin"
DB_USER="postgres"
DB_NAME="tartware"
DB_HOST="tartware-postgres"
DB_PORT="5432"
SCHEMA_FILE="02-core-tables.sql"
DATA_FILE="03-sample-data.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
}

# Check if Docker is running
check_docker() {
    print_info "Checking if Docker is running..."
    if ! sudo docker ps > /dev/null 2>&1; then
        print_error "Docker is not running or you don't have permission to access it."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if PostgreSQL container exists and is running
check_postgres_container() {
    print_info "Checking PostgreSQL container..."
    if ! sudo docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_error "PostgreSQL container '${CONTAINER_NAME}' is not running."
        print_info "Available containers:"
        sudo docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
        exit 1
    fi
    print_success "PostgreSQL container is running"
}

# Check if SQL files exist
check_sql_files() {
    print_info "Checking SQL files..."

    if [ ! -f "$SCHEMA_FILE" ]; then
        print_error "Schema file '$SCHEMA_FILE' not found!"
        exit 1
    fi
    print_success "Found schema file: $SCHEMA_FILE"

    if [ ! -f "$DATA_FILE" ]; then
        print_error "Data file '$DATA_FILE' not found!"
        exit 1
    fi
    print_success "Found data file: $DATA_FILE"
}

# Check if database already exists
check_database_exists() {
    print_info "Checking if database '$DB_NAME' already exists..."
    if sudo docker exec -i $CONTAINER_NAME psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        print_warning "Database '$DB_NAME' already exists!"
        read -p "Do you want to drop and recreate it? (yes/no): " -r
        echo
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            print_info "Dropping existing database..."
            sudo docker exec -i $CONTAINER_NAME psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
            print_success "Database dropped"
            return 1
        else
            print_info "Keeping existing database. Skipping creation."
            return 0
        fi
    fi
    return 1
}

# Create database
create_database() {
    print_info "Creating database '$DB_NAME'..."
    sudo docker exec -i $CONTAINER_NAME psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;"
    print_success "Database created successfully"
}

# Enable UUID extension
enable_uuid_extension() {
    print_info "Enabling uuid-ossp extension..."
    sudo docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
    print_success "UUID extension enabled"
}

# Execute schema script
execute_schema() {
    print_info "Executing schema script ($SCHEMA_FILE)..."
    print_info "This may take a few moments..."

    if sudo docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $SCHEMA_FILE 2>&1 | tee /tmp/schema_output.log; then
        print_success "Schema created successfully"
    else
        print_error "Failed to execute schema script. Check /tmp/schema_output.log for details."
        exit 1
    fi
}

# Execute sample data script
execute_sample_data() {
    print_info "Executing sample data script ($DATA_FILE)..."
    print_info "Generating 100,000+ records... This will take several minutes..."

    start_time=$(date +%s)

    if sudo docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $DATA_FILE 2>&1 | tee /tmp/data_output.log; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        print_success "Sample data loaded successfully in ${duration} seconds"
    else
        print_error "Failed to execute sample data script. Check /tmp/data_output.log for details."
        exit 1
    fi
}

# Configure PgAdmin server
configure_pgadmin() {
    print_header "CONFIGURING PGADMIN"

    # Check if PgAdmin container is running
    if ! sudo docker ps --format '{{.Names}}' | grep -q "^${PGADMIN_CONTAINER}$"; then
        print_warning "PgAdmin container is not running. Skipping PgAdmin configuration."
        return
    fi

    print_info "Configuring PgAdmin server for '$DB_NAME' database..."

    # Create servers.json configuration
    cat > /tmp/servers.json <<EOF
{
  "Servers": {
    "1": {
      "Name": "Tartware PMS - PostgreSQL 16",
      "Group": "Property Management",
      "Host": "${DB_HOST}",
      "Port": ${DB_PORT},
      "MaintenanceDB": "postgres",
      "Username": "${DB_USER}",
      "SSLMode": "prefer",
      "Comment": "Tartware Property Management System Database"
    }
  }
}
EOF

    # Copy servers.json to PgAdmin container
    if sudo docker cp /tmp/servers.json ${PGADMIN_CONTAINER}:/pgadmin4/servers.json; then
        print_success "PgAdmin server configuration created"

        # Set proper permissions
        sudo docker exec -i ${PGADMIN_CONTAINER} chown pgadmin:pgadmin /pgadmin4/servers.json 2>/dev/null || true

        print_info "Restarting PgAdmin container to apply configuration..."
        sudo docker restart ${PGADMIN_CONTAINER} > /dev/null 2>&1

        # Wait for PgAdmin to start
        print_info "Waiting for PgAdmin to start (10 seconds)..."
        sleep 10

        print_success "PgAdmin configured successfully!"
        print_info "Server 'Tartware PMS - PostgreSQL 16' has been added to PgAdmin"
        print_info "You may need to enter the password when connecting for the first time"
    else
        print_warning "Failed to copy server configuration to PgAdmin"
    fi

    # Cleanup
    rm -f /tmp/servers.json
}

# Verify installation
verify_installation() {
    print_info "Verifying installation..."

    # Count tables
    table_count=$(sudo docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
    print_info "Tables created: $(echo $table_count | xargs)"

    # Get sample counts from key tables
    print_info "Sample record counts:"
    sudo docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "
        SELECT
            'tenants' as table_name, COUNT(*) as count FROM tenants
        UNION ALL SELECT 'properties', COUNT(*) FROM properties
        UNION ALL SELECT 'guests', COUNT(*) FROM guests
        UNION ALL SELECT 'rooms', COUNT(*) FROM rooms
        UNION ALL SELECT 'reservations', COUNT(*) FROM reservations
        UNION ALL SELECT 'payments', COUNT(*) FROM payments
        ORDER BY table_name;
    "

    print_success "Database verification complete!"
}

# Display connection information
display_connection_info() {
    print_header "CONNECTION INFORMATION"
    echo "Database Name:    $DB_NAME"
    echo "Container:        $CONTAINER_NAME"
    echo "User:             $DB_USER"
    echo "Port:             5432 (mapped to host)"
    echo ""
    echo "Connect using:"
    echo "  docker exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
    echo ""
    echo "Or from host (if port is exposed):"
    echo "  psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME"
    echo ""
    echo -e "${GREEN}PgAdmin Web Interface:${NC}"
    echo "  URL:      http://localhost:5050"
    echo "  Server:   Tartware PMS - PostgreSQL 16"
    echo "  Database: $DB_NAME"
    echo ""
    echo -e "${YELLOW}Note:${NC} When connecting in PgAdmin for the first time,"
    echo "      you may need to enter the PostgreSQL password."
    echo ""
}

# Main execution
main() {
    print_header "TARTWARE PMS - DATABASE SETUP"

    check_docker
    check_postgres_container
    check_sql_files

    # Check if database exists
    if ! check_database_exists; then
        create_database
    fi

    enable_uuid_extension
    execute_schema

    # Ask if user wants to load sample data
    echo ""
    read -p "Do you want to load sample data (100,000+ records)? This will take several minutes. (yes/no): " -r
    echo
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        execute_sample_data
    else
        print_info "Skipping sample data load"
    fi

    verify_installation
    configure_pgadmin
    display_connection_info

    print_header "SETUP COMPLETE!"
    print_success "Database '$DB_NAME' is ready to use!"
    print_success "PgAdmin is configured and ready at http://localhost:5050"
}

# Run main function
main
