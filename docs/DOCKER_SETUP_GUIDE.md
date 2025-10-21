# Tartware PMS - Docker Setup Guide

**Complete Guide for Docker-Based Database Deployment**
**Updated:** October 21, 2025
**Database:** PostgreSQL 16 with 132 Tables (89 Core + 43 Advanced)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [Database Initialization](#database-initialization)
6. [Sample Data Loading](#sample-data-loading)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)
9. [Production Deployment](#production-deployment)

---

## 🎯 Overview

### What Gets Created

The Docker setup automatically creates a complete Tartware PMS database:

- **132 Tables** (89 core + 43 advanced features)
- **800+ Indexes** (B-tree, GIN, Trigram, Partial, Composite)
- **500+ Foreign Key Constraints** (referential integrity)
- **30+ ENUM Types** (type-safe enumerations)
- **2 Schemas** (public, availability)
- **2 Extensions** (uuid-ossp, pg_trgm)

### Architecture Categories

The database spans **20 functional categories**:

1. **Core Foundation** - Tenants, users, multi-tenancy
2. **Property Management** - Properties, rooms, room types
3. **Guest Management** - Guests, preferences, loyalty
4. **Reservations** - Bookings, status, history
5. **Financial** - Payments, invoices, folios, refunds
6. **Housekeeping** - Tasks, maintenance, incidents
7. **Channel Management** - OTA integrations, rate parity
8. **B2B & Corporate** - Companies, groups, packages
9. **Analytics & Reporting** - Metrics, reports, dashboards
10. **Performance Monitoring** - Alerts, baselines, thresholds
11. **Communication** - Guest comms, templates, feedback
12. **Revenue Management** - Forecasts, pricing, competitors
13. **Operations** - Night audit, business dates, cashiers
14. **Marketing** - Campaigns, promotions, referrals
15. **Mobile & Digital** - Mobile keys, QR codes, push notifications
16. **AI/ML Innovation** - Demand prediction, personalization, sentiment analysis
17. **Sustainability & ESG** - Carbon tracking, green certifications
18. **IoT & Smart Rooms** - Device management, energy monitoring
19. **Contactless Operations** - Mobile check-in, digital registration
20. **Asset Management** - Inventory, predictive maintenance

---

## ✅ Prerequisites

### Required Software

```bash
# Docker & Docker Compose
docker --version          # 20.10+ recommended
docker-compose --version  # 1.29+ recommended

# Python (for sample data)
python3 --version         # 3.8+ required
pip3 --version
```

### Install Dependencies

```bash
# Install Python dependencies for sample data loader
pip3 install psycopg2-binary faker --break-system-packages

# Or with virtual environment
python3 -m venv venv
source venv/bin/activate
pip install psycopg2-binary faker
```

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/red2n/tartware.git
cd tartware
```

### 2. Start Docker Containers

```bash
# Start PostgreSQL with automatic initialization
docker-compose up -d

# View initialization logs
docker-compose logs -f postgres
```

### 3. Wait for Initialization

The initialization takes **30-60 seconds** and includes:

```
✓ Database created
✓ Extensions installed (uuid-ossp, pg_trgm)
✓ Schemas created (public, availability)
✓ ENUM types created (30+)
✓ Tables created (132)
✓ Indexes created (800+)
✓ Constraints created (500+)
✓ Verification passed (A+)
```

### 4. Verify Installation

```bash
# Connect to database
docker exec -it tartware-postgres psql -U postgres -d tartware

# Check tables count
\dt

# Exit
\q
```

### 5. Load Sample Data (Optional)

```bash
# Run sample data loader
python3 scripts/load_sample_data_direct.py

# Expected: ~5,000+ records across all tables
```

---

## ⚙️ Configuration

### Docker Compose Variables

Edit `docker-compose.yml` or create `.env` file:

```yaml
# Database Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres  # Default, tartware created automatically

# Tartware Initialization Settings
TARTWARE_DROP_EXISTING=true         # Drop & recreate on restart (dev mode)
TARTWARE_RUN_VERIFICATION=true      # Run verify-all.sql after setup
TARTWARE_BACKUP_BEFORE_DROP=false   # Create backup before drop
```

### Environment File (.env)

```bash
# Create .env file
cat > .env << 'EOF'
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=postgres

# Tartware Settings (Development)
TARTWARE_DROP_EXISTING=true
TARTWARE_RUN_VERIFICATION=true
TARTWARE_BACKUP_BEFORE_DROP=false
EOF

# Start with .env
docker-compose up -d
```

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `TARTWARE_DROP_EXISTING` | `true` | Drop database if exists (⚠️ dev only) |
| `TARTWARE_RUN_VERIFICATION` | `true` | Run comprehensive verification |
| `TARTWARE_BACKUP_BEFORE_DROP` | `false` | Backup before dropping database |

---

## 🗄️ Database Initialization

### Automatic Initialization Flow

```
Docker Container Starts
    ↓
docker-entrypoint-custom.sh (Wrapper)
    ↓
00-tartware-init.sh (Main Orchestrator)
    ↓
    ├─→ Create tartware database
    ├─→ Phase 1: Extensions & Schemas (01-database-setup.sql)
    ├─→ Phase 2: ENUM Types (02-enum-types.sql)
    ├─→ Phase 3: Create 132 Tables (tables/00-create-all-tables.sql)
    ├─→ Phase 4: Create 800+ Indexes (indexes/00-create-all-indexes.sql)
    ├─→ Phase 5: Create 500+ Constraints (constraints/00-create-all-constraints.sql)
    └─→ Phase 6: Verification (verify-all.sql)
        ↓
    ✓ Database Ready
```

### Manual Re-initialization

```bash
# Stop containers
docker-compose down

# Remove volumes (⚠️ deletes all data)
docker volume rm tartware_postgres_data

# Start fresh
docker-compose up -d

# Or with explicit drop
TARTWARE_DROP_EXISTING=true docker-compose up -d
```

### Backup Before Re-initialization

```bash
# Create backup first
docker exec -it tartware-postgres pg_dump -U postgres tartware > backup_$(date +%Y%m%d_%H%M%S).sql

# Then re-initialize
docker-compose down -v
docker-compose up -d
```

---

## 📊 Sample Data Loading

### Using load_sample_data_direct.py

The script generates realistic sample data for all tables:

```bash
# Basic usage
python3 scripts/load_sample_data_direct.py

# Expected output:
# ✓ Inserting 5 Tenants...
# ✓ Inserting 25 Users...
# ✓ Inserting Properties (3 per tenant)...
# ✓ Inserting 200 Guests...
# ✓ Inserting Room Types (3 per property)...
# ✓ Inserting Rooms (20 per property)...
# ✓ Inserting 500 Reservations...
# ... (65+ tables with data)
# ✓ COMPLETE: 5000+ records inserted
```

### Sample Data Volumes

| Category | Records | Description |
|----------|---------|-------------|
| Tenants | 5 | Multi-tenant organizations |
| Users | 25 | Staff across all tenants |
| Properties | 15 | Hotels/resorts (3 per tenant) |
| Guests | 200 | Customer profiles |
| Rooms | 300 | Physical rooms (20 per property) |
| Reservations | 500 | Bookings (main data volume) |
| Payments | 400 | Payment transactions |
| Invoices | 500 | Billing documents |
| Services | 120 | Property services |
| Housekeeping | 900 | Cleaning tasks |
| **Total** | **5,000+** | Across all tables |

### UUID v7 Generation

The loader uses **UUID v7** (time-ordered) for optimal performance:

```python
# Benefits:
# - Time-ordered for B-tree index efficiency
# - Better database cache locality
# - Reduced index fragmentation
# - Suitable for time-range queries
```

### Customizing Sample Data

Edit configuration in `load_sample_data_direct.py`:

```python
# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'tartware',
    'user': 'postgres',
    'password': 'postgres'
}

# UUID strategy
UUID_VERSION = "v7"  # or "v4" for random

# Adjust volumes
def main():
    insert_tenants(conn, count=10)      # 5 → 10
    insert_guests(conn, count=500)       # 200 → 500
    insert_reservations(conn, count=1000) # 500 → 1000
```

---

## ✅ Verification

### Automated Verification

Runs automatically during initialization:

```sql
-- verify-all.sql checks:
✓ Table count (132 expected)
✓ Indexes (800+ expected)
✓ Foreign keys (500+ expected)
✓ Soft delete pattern (125+ tables)
✓ Multi-tenancy (128+ tables)
✓ Audit trails (132 tables)
✓ Quality score (A+ grade)
```

### Manual Verification

```bash
# Inside container
docker exec -it tartware-postgres psql -U postgres -d tartware -f /docker-entrypoint-initdb.d/scripts/verify-all.sql

# From host
docker exec -it tartware-postgres psql -U postgres -d tartware << 'EOF'
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';
SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public';
SELECT COUNT(*) as total_foreign_keys FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';
EOF
```

### Expected Results

```
TARTWARE PMS - DATABASE VERIFICATION REPORT
════════════════════════════════════════════

DATABASE COMPONENT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Tables:        132 (89 core + 43 advanced)
Total Indexes:       800+ (comprehensive coverage)
Foreign Keys:        500+ (referential integrity)
Soft Delete Tables:  125+ (data preservation)
Multi-tenant Tables: 128+ (tenant isolation)
Full Audit Trails:   132 (complete traceability)

QUALITY SCORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 100/100
Grade: A+ (EXCELLENT)

STATUS: ✓ ALL VERIFICATIONS PASSED
```

### Verification Scripts

| Script | Purpose | Location |
|--------|---------|----------|
| `verify-all.sql` | Comprehensive verification | `/scripts/` |
| `verify-all-categories.sql` | Category-by-category | `/scripts/` |
| `verify-installation.sql` | Quick check | `/scripts/` |
| `tables/verify-tables.sql` | Table verification | `/scripts/tables/` |
| `indexes/verify-indexes.sql` | Index verification | `/scripts/indexes/` |
| `constraints/verify-constraints.sql` | Constraint verification | `/scripts/constraints/` |

---

## 🔧 Troubleshooting

### Issue: Container Won't Start

```bash
# Check logs
docker-compose logs postgres

# Common causes:
# - Port 5432 already in use
# - Insufficient disk space
# - Docker daemon not running

# Solutions:
# 1. Change port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 on host

# 2. Check disk space
df -h

# 3. Restart Docker
sudo systemctl restart docker
```

### Issue: Database Already Exists

```bash
# Error: database "tartware" already exists

# Solution 1: Enable drop
TARTWARE_DROP_EXISTING=true docker-compose restart postgres

# Solution 2: Manual drop
docker exec -it tartware-postgres psql -U postgres -c "DROP DATABASE tartware;"
docker-compose restart postgres

# Solution 3: Fresh start
docker-compose down -v
docker-compose up -d
```

### Issue: Initialization Failed

```bash
# Check detailed logs
docker exec -it tartware-postgres cat /tmp/tartware-init-main.log
docker exec -it tartware-postgres cat /tmp/tartware-init.log

# Common issues:
# - Missing SQL files
# - Syntax errors in SQL
# - Insufficient permissions

# View specific errors
docker exec -it tartware-postgres cat /tmp/tartware-init.log | grep -i "error"
```

### Issue: Sample Data Loader Fails

```bash
# Error: connection refused

# Check PostgreSQL is running
docker-compose ps

# Wait for PostgreSQL to be ready
docker exec -it tartware-postgres pg_isready

# Test connection
docker exec -it tartware-postgres psql -U postgres -d tartware -c "SELECT 1;"

# Verify database exists
docker exec -it tartware-postgres psql -U postgres -l | grep tartware
```

### Issue: Verification Warnings

```bash
# View verification details
docker exec -it tartware-postgres psql -U postgres -d tartware -f /docker-entrypoint-initdb.d/scripts/verify-all.sql | tee verification_report.txt

# Common warnings:
# - Table count mismatch (check if all tables created)
# - Index count low (check indexes/00-create-all-indexes.sql)
# - Constraint issues (check constraints/00-create-all-constraints.sql)
```

---

## 🏭 Production Deployment

### Security Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: tartware-postgres-prod
    restart: always
    environment:
      # Strong credentials
      POSTGRES_USER: tartware_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}  # From secrets
      POSTGRES_DB: postgres

      # Production settings
      TARTWARE_DROP_EXISTING: false         # ⚠️ NEVER drop in production
      TARTWARE_RUN_VERIFICATION: true
      TARTWARE_BACKUP_BEFORE_DROP: true     # Always backup if needed

    ports:
      - "127.0.0.1:5432:5432"  # Bind to localhost only

    volumes:
      - tartware_postgres_data_prod:/var/lib/postgresql/data
      - ./backups:/backups  # Backup directory
      - ./scripts:/docker-entrypoint-initdb.d/scripts:ro  # Read-only

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tartware_admin"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G

    networks:
      - tartware_network_prod

volumes:
  tartware_postgres_data_prod:
    name: tartware_postgres_data_prod
    driver: local

networks:
  tartware_network_prod:
    name: tartware_network_prod
    driver: bridge
```

### Production Checklist

- [ ] Use strong passwords (store in secrets/vault)
- [ ] Bind to localhost only or use firewall rules
- [ ] Disable `TARTWARE_DROP_EXISTING` (set to false)
- [ ] Enable automated backups
- [ ] Set resource limits (CPU, memory)
- [ ] Use read-only mounts for scripts
- [ ] Enable SSL/TLS for connections
- [ ] Configure connection pooling (PgBouncer)
- [ ] Set up monitoring (Prometheus, Grafana)
- [ ] Configure log rotation
- [ ] Test disaster recovery procedures

### Backup Strategy

```bash
# Automated daily backups
0 2 * * * docker exec tartware-postgres-prod pg_dump -U tartware_admin tartware | gzip > /backups/tartware_$(date +\%Y\%m\%d).sql.gz

# Retention: 30 days
find /backups -name "tartware_*.sql.gz" -mtime +30 -delete

# Test restore quarterly
gunzip < /backups/tartware_20251021.sql.gz | docker exec -i tartware-postgres-prod psql -U tartware_admin tartware_test
```

### Monitoring

```bash
# Connection count
docker exec -it tartware-postgres-prod psql -U tartware_admin -d tartware -c "SELECT count(*) FROM pg_stat_activity;"

# Database size
docker exec -it tartware-postgres-prod psql -U tartware_admin -d tartware -c "SELECT pg_size_pretty(pg_database_size('tartware'));"

# Cache hit ratio (should be >90%)
docker exec -it tartware-postgres-prod psql -U tartware_admin -d tartware -c "SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio FROM pg_statio_user_tables;"
```

---

## 📚 Additional Resources

### Documentation

- [Database Architecture](./database-architecture.md)
- [Multi-Tenancy Guide](./multi-tenancy.md)
- [Soft Delete Policy](./soft-delete-policy.md)
- [Industry Standards](./industry-standards.md)
- [Performance Monitoring](./performance-monitoring.md)

### Scripts Reference

- **Database Setup**: `/scripts/01-database-setup.sql`
- **ENUM Types**: `/scripts/02-enum-types.sql`
- **Master Tables**: `/scripts/tables/00-create-all-tables.sql`
- **Master Indexes**: `/scripts/indexes/00-create-all-indexes.sql`
- **Master Constraints**: `/scripts/constraints/00-create-all-constraints.sql`
- **Verification**: `/scripts/verify-all.sql`
- **Sample Data**: `/scripts/load_sample_data_direct.py`

### Docker Scripts

- **Main Init**: `/scripts/docker/00-tartware-init.sh`
- **Run All**: `/scripts/docker/run-all-scripts.sh`
- **Drop & Recreate**: `/scripts/docker/drop-and-recreate.sql`
- **Custom Entrypoint**: `/scripts/docker/docker-entrypoint-custom.sh`
- **Docker README**: `/scripts/docker/README.md`

---

## 🎯 Quick Commands Reference

```bash
# === Container Management ===
docker-compose up -d                    # Start containers
docker-compose down                     # Stop containers
docker-compose down -v                  # Stop and remove volumes
docker-compose restart postgres         # Restart PostgreSQL
docker-compose logs -f postgres         # View logs

# === Database Access ===
docker exec -it tartware-postgres psql -U postgres -d tartware
docker exec -it tartware-postgres bash

# === Verification ===
docker exec -it tartware-postgres psql -U postgres -d tartware -f /docker-entrypoint-initdb.d/scripts/verify-all.sql

# === Backup & Restore ===
docker exec -it tartware-postgres pg_dump -U postgres tartware > backup.sql
docker exec -i tartware-postgres psql -U postgres tartware < backup.sql

# === Sample Data ===
python3 scripts/load_sample_data_direct.py

# === Monitoring ===
docker stats tartware-postgres
docker exec -it tartware-postgres pg_isready
```

---

**Need Help?**

- 📖 Check the [Docker README](../scripts/docker/README.md) for detailed information
- 🐛 Report issues on [GitHub](https://github.com/red2n/tartware/issues)
- 📧 Contact: tartware-support@example.com

**Last Updated:** October 21, 2025
**Version:** 2.0 (132 Tables - Full Feature Set)
