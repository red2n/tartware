#!/bin/bash
# =====================================================
# Quick Start: Generate and Load Sample Data
# Tartware PMS Database
# =====================================================

set -e  # Exit on error

echo "=================================================="
echo "Tartware PMS - Sample Data Generator"
echo "=================================================="
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is required but not found."
    echo "Please install Python 3.8 or higher."
    exit 1
fi

# Check if Faker is installed
echo "Checking dependencies..."
if ! python3 -c "import faker" 2>/dev/null; then
    echo "Installing Faker library..."
    pip3 install faker
fi

echo "✓ Dependencies satisfied"
echo ""

# Generate sample data
echo "Generating sample data..."
python3 scripts/generate_sample_data.py > scripts/sample_data.sql

if [ $? -eq 0 ]; then
    echo "✓ Sample data SQL generated: scripts/sample_data.sql"
    echo ""

    # Check file size
    FILE_SIZE=$(wc -l < scripts/sample_data.sql)
    echo "Generated SQL file: $FILE_SIZE lines"
    echo ""

    # Ask user if they want to load the data
    read -p "Do you want to load this data into the database? (y/n) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Loading data into database..."
        echo ""

        # Check if psql is available
        if ! command -v psql &> /dev/null; then
            echo "ERROR: psql command not found."
            echo "Please install PostgreSQL client tools."
            exit 1
        fi

        # Load the data
        psql -U postgres -d tartware -f scripts/sample_data.sql

        if [ $? -eq 0 ]; then
            echo ""
            echo "=================================================="
            echo "✓ Sample data loaded successfully!"
            echo "=================================================="
            echo ""
            echo "Quick verification:"
            echo ""

            # Run quick counts
            psql -U postgres -d tartware -c "
                SELECT 'Tenants' as table_name, COUNT(*) as records FROM tenants
                UNION ALL
                SELECT 'Users', COUNT(*) FROM users
                UNION ALL
                SELECT 'Properties', COUNT(*) FROM properties
                UNION ALL
                SELECT 'Guests', COUNT(*) FROM guests
                UNION ALL
                SELECT 'Reservations', COUNT(*) FROM reservations
                UNION ALL
                SELECT 'Payments', COUNT(*) FROM payments
                UNION ALL
                SELECT 'Invoices', COUNT(*) FROM invoices
                ORDER BY records DESC;
            "

            echo ""
            echo "Next steps:"
            echo "  1. Run: psql -U postgres -d tartware"
            echo "  2. Query: SELECT * FROM reservations LIMIT 10;"
            echo "  3. Test API endpoints with the sample data"
            echo ""
        else
            echo "ERROR: Failed to load data into database"
            exit 1
        fi
    else
        echo ""
        echo "Data generation complete. To load manually:"
        echo "  psql -U postgres -d tartware -f scripts/sample_data.sql"
        echo ""
    fi
else
    echo "ERROR: Failed to generate sample data"
    exit 1
fi

echo "=================================================="
echo "Done!"
echo "=================================================="
