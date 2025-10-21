#!/bin/bash
# ============================================================================
# Tartware PMS - Quick Start Script
# Automated database deployment with Docker Compose
# ============================================================================

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║  ████████╗ █████╗ ██████╗ ████████╗██╗    ██╗ █████╗ ██████╗ ███████╗ ║"
echo "║  ╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██║    ██║██╔══██╗██╔══██╗██╔════╝ ║"
echo "║     ██║   ███████║██████╔╝   ██║   ██║ █╗ ██║███████║██████╔╝█████╗   ║"
echo "║     ██║   ██╔══██║██╔══██╗   ██║   ██║███╗██║██╔══██║██╔══██╗██╔══╝   ║"
echo "║     ██║   ██║  ██║██║  ██║   ██║   ╚███╔███╔╝██║  ██║██║  ██║███████╗ ║"
echo "║     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ║"
echo "║                                                                ║"
echo "║               Property Management System - Quick Start         ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "This script will deploy the complete Tartware PMS database:"
echo "  • 132 Tables (89 core + 43 advanced features)"
echo "  • 800+ Indexes (B-tree, GIN, Trigram, Partial, Composite)"
echo "  • 500+ Foreign Key Constraints (referential integrity)"
echo "  • 30+ ENUM Types (type-safe enumerations)"
echo "  • 20 Functional Categories (from core to AI/ML)"
echo ""

# ============================================================================
# Check Prerequisites
# ============================================================================

echo "Checking prerequisites..."
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "   Install: https://docs.docker.com/get-docker/"
    exit 1
fi
echo "✅ Docker: $(docker --version)"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    echo "   Install: https://docs.docker.com/compose/install/"
    exit 1
fi
echo "✅ Docker Compose: $(docker-compose --version)"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running"
    echo "   Start: sudo systemctl start docker"
    exit 1
fi
echo "✅ Docker daemon: running"

echo ""

# ============================================================================
# Deploy Database
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Starting Tartware PMS Database Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start containers
echo "Starting Docker containers..."
docker-compose up -d

echo ""
echo "✅ Containers started"
echo ""

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
RETRIES=30
COUNT=0

while [ $COUNT -lt $RETRIES ]; do
    if docker exec tartware-postgres pg_isready -U postgres &> /dev/null; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    COUNT=$((COUNT + 1))
    echo -n "."
    sleep 1
done

if [ $COUNT -eq $RETRIES ]; then
    echo ""
    echo "❌ PostgreSQL failed to start within 30 seconds"
    echo "   Check logs: docker-compose logs postgres"
    exit 1
fi

echo ""

# Wait for initialization to complete
echo "Database initialization in progress (30-60 seconds)..."
echo "You can view logs in another terminal: docker-compose logs -f postgres"
echo ""

sleep 10  # Give it time to start initialization

# Monitor for completion
echo "Monitoring initialization..."
for i in {1..60}; do
    if docker exec tartware-postgres psql -U postgres -d tartware -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | grep -q "132"; then
        echo "✅ Initialization complete!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "⚠️  Initialization taking longer than expected"
        echo "   Check logs: docker-compose logs postgres"
    fi
    sleep 1
done

echo ""

# ============================================================================
# Verification
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Verifying Database Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get counts
TABLE_COUNT=$(docker exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
INDEX_COUNT=$(docker exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" 2>/dev/null | xargs)
FK_COUNT=$(docker exec tartware-postgres psql -U postgres -d tartware -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';" 2>/dev/null | xargs)

echo "Database Statistics:"
echo "  Tables:           $TABLE_COUNT / 132 expected"
echo "  Indexes:          $INDEX_COUNT / 800+ expected"
echo "  Foreign Keys:     $FK_COUNT / 500+ expected"
echo ""

if [ "$TABLE_COUNT" -ge "130" ]; then
    echo "✅ All tables created successfully"
else
    echo "⚠️  Table count lower than expected"
    echo "   Run verification: docker exec -it tartware-postgres psql -U postgres -d tartware -f /docker-entrypoint-initdb.d/scripts/verify-all.sql"
fi

echo ""

# ============================================================================
# Success Summary
# ============================================================================

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║  ✓✓✓ TARTWARE PMS DATABASE DEPLOYMENT COMPLETE ✓✓✓           ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Quick Access:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Connect to Database:"
echo "    docker exec -it tartware-postgres psql -U postgres -d tartware"
echo ""
echo "  View Logs:"
echo "    docker-compose logs -f postgres"
echo ""
echo "  Load Sample Data:"
echo "    python3 scripts/load_sample_data_direct.py"
echo ""
echo "  Run Verification:"
echo "    docker exec -it tartware-postgres psql -U postgres -d tartware -f /docker-entrypoint-initdb.d/scripts/verify-all.sql"
echo ""
echo "  Container Shell:"
echo "    docker exec -it tartware-postgres bash"
echo ""
echo "  Stop Containers:"
echo "    docker-compose down"
echo ""
echo "  Fresh Restart (⚠️ deletes all data):"
echo "    docker-compose down -v && docker-compose up -d"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Documentation:"
echo "  📖 Docker Setup Guide:  docs/DOCKER_SETUP_GUIDE.md"
echo "  📖 Update Summary:      docs/DOCKER_UPDATE_SUMMARY.md"
echo "  📖 Database Architecture: docs/database-architecture.md"
echo ""
echo "Next Steps:"
echo "  1. Load sample data (optional)"
echo "  2. Run verification script"
echo "  3. Start building your application!"
echo ""
echo "Need help? Check the documentation or run: docker-compose logs postgres"
echo ""

exit 0
