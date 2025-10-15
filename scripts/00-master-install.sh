#!/bin/bash

# =====================================================
# Master Database Setup Script
# Tartware Property Management System
# Executes all scripts in correct order
# Date: 2025-10-15
# =====================================================

set -e  # Exit on error

echo "============================================="
echo "Tartware PMS - Database Setup"
echo "============================================="
echo ""

# Database connection settings
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-tartware}"
DB_USER="${DB_USER:-postgres}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo ""

# Function to execute SQL file
execute_sql() {
    local file=$1
    local description=$2
    echo "→ Executing: $description"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"
    echo "  ✓ Completed: $description"
    echo ""
}

# 1. Database Setup (Extensions & Schemas)
echo "============================================="
echo "STEP 1: Database Initialization"
echo "============================================="
execute_sql "$SCRIPT_DIR/01-database-setup.sql" "Database setup (extensions, schemas)"

# 2. ENUM Types
echo "============================================="
echo "STEP 2: ENUM Types"
echo "============================================="
execute_sql "$SCRIPT_DIR/02-enum-types.sql" "20 ENUM types"

# 3. Tables (in dependency order)
echo "============================================="
echo "STEP 3: Creating Tables (22 tables)"
echo "============================================="

# Core tables (no dependencies)
execute_sql "$SCRIPT_DIR/tables/01_tenants.sql" "Tenants table"
execute_sql "$SCRIPT_DIR/tables/02_users.sql" "Users table"

# Association tables
execute_sql "$SCRIPT_DIR/tables/03_user_tenant_associations.sql" "User-Tenant associations"

# Property hierarchy
execute_sql "$SCRIPT_DIR/tables/04_properties.sql" "Properties table"
execute_sql "$SCRIPT_DIR/tables/05_guests.sql" "Guests table"
execute_sql "$SCRIPT_DIR/tables/06_room_types.sql" "Room Types table"
execute_sql "$SCRIPT_DIR/tables/07_rooms.sql" "Rooms table"
execute_sql "$SCRIPT_DIR/tables/08_rates.sql" "Rates table"

# Availability (separate schema)
execute_sql "$SCRIPT_DIR/tables/09_availability_room_availability.sql" "Room Availability table"

# Reservations
execute_sql "$SCRIPT_DIR/tables/10_reservations.sql" "Reservations table"
execute_sql "$SCRIPT_DIR/tables/11_reservation_status_history.sql" "Reservation Status History"

# Financial
execute_sql "$SCRIPT_DIR/tables/12_payments.sql" "Payments table"
execute_sql "$SCRIPT_DIR/tables/13_invoices.sql" "Invoices table"
execute_sql "$SCRIPT_DIR/tables/14_invoice_items.sql" "Invoice Items table"

# Services
execute_sql "$SCRIPT_DIR/tables/15_services.sql" "Services table"
execute_sql "$SCRIPT_DIR/tables/16_reservation_services.sql" "Reservation Services"

# Operations
execute_sql "$SCRIPT_DIR/tables/17_housekeeping_tasks.sql" "Housekeeping Tasks"

# Integrations
execute_sql "$SCRIPT_DIR/tables/18_channel_mappings.sql" "Channel Mappings"

# Analytics
execute_sql "$SCRIPT_DIR/tables/19_analytics_metrics.sql" "Analytics Metrics"
execute_sql "$SCRIPT_DIR/tables/20_analytics_metric_dimensions.sql" "Analytics Dimensions"
execute_sql "$SCRIPT_DIR/tables/21_analytics_reports.sql" "Analytics Reports"
execute_sql "$SCRIPT_DIR/tables/22_report_property_ids.sql" "Report Property IDs"

echo "============================================="
echo "✓ DATABASE SETUP COMPLETED SUCCESSFULLY!"
echo "============================================="
echo ""
echo "Summary:"
echo "  - Extensions: uuid-ossp"
echo "  - Schemas: public, availability"
echo "  - ENUM Types: 20"
echo "  - Tables: 22"
echo ""
echo "Next steps:"
echo "  1. Create indexes: Run scripts in indexes/ folder"
echo "  2. Add constraints: Run scripts in constraints/ folder"
echo "  3. Create procedures: Run scripts in procedures/ folder (if any)"
echo "  4. Load sample data: Create and run sample data script"
echo ""
