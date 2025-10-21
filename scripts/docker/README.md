# Docker Database Initialization Scripts

This directory contains automated scripts for initializing the Tartware PMS database in Docker.

## 📁 Files

### `init-database.sh` (Main Orchestrator)
Entry point for database initialization. Handles:
- Database existence checking
- Optional database drop/recreate
- Optional backup before drop
- Calls run-all-scripts.sh

### `drop-and-recreate.sql`
Safely drops and recreates the tartware database:
- Terminates all active connections
- Drops existing database
- Creates fresh database with proper encoding

### `run-all-scripts.sh`
Executes all SQL scripts in correct order:
1. Database setup (extensions, schemas)
2. ENUM types
3. All 132 tables (89 core + 43 advanced)
4. All 800+ indexes
5. All 500+ foreign key constraints
6. Verification (optional)

## 🚀 Usage

### Automatic (via Docker Compose)
Scripts run automatically when container starts:
```bash
docker-compose up -d
```

### Manual Execution
```bash
# From host
docker exec -it tartware-postgres /docker-entrypoint-initdb.d/scripts/docker/init-database.sh

# From inside container
docker exec -it tartware-postgres bash
/docker-entrypoint-initdb.d/scripts/docker/init-database.sh
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TARTWARE_DROP_EXISTING` | `true` | Drop database if exists (⚠️ deletes all data) |
| `TARTWARE_RUN_VERIFICATION` | `true` | Run verify-all.sql after setup |
| `TARTWARE_BACKUP_BEFORE_DROP` | `false` | Create backup before dropping |

### Setting Variables

**In docker-compose.yml:**
```yaml
services:
  postgres:
    environment:
      - TARTWARE_DROP_EXISTING=true
      - TARTWARE_RUN_VERIFICATION=true
      - TARTWARE_BACKUP_BEFORE_DROP=false
```

**Via .env file:**
```bash
TARTWARE_DROP_EXISTING=true
TARTWARE_RUN_VERIFICATION=true
TARTWARE_BACKUP_BEFORE_DROP=false
```

**Command line:**
```bash
TARTWARE_DROP_EXISTING=true docker-compose up -d
```

## 📊 Execution Flow

```
init-database.sh (Main)
    ↓
Check if database exists
    ↓
    ├─→ [Not Exists] → Create database
    │                       ↓
    └─→ [Exists] → Check DROP_EXISTING
                       ↓
                   ├─→ [true] → Backup (optional)
                   │               ↓
                   │           drop-and-recreate.sql
                   │               ↓
                   └─→ [false] → Exit (database ready)
                       ↓
run-all-scripts.sh
    ↓
    ├─→ 01-database-setup.sql (extensions, schemas)
    ├─→ 02-enum-types.sql (30+ ENUM types)
    ├─→ tables/00-create-all-tables.sql (132 tables: 89 core + 43 advanced)
    ├─→ indexes/00-create-all-indexes.sql (800+ indexes)
    ├─→ constraints/00-create-all-constraints.sql (500+ FKs)
    └─→ verify-all.sql (optional)
        ↓
    ✓ Complete
```

## 📝 Logs

Logs are written to:
- `/tmp/tartware-init-main.log` - Main orchestrator log
- `/tmp/tartware-init.log` - Script execution log

View logs:
```bash
# From host
docker exec -it tartware-postgres cat /tmp/tartware-init-main.log

# From inside container
cat /tmp/tartware-init-main.log
```

## 🛡️ Safety Features

### Development Mode (Current)
- `DROP_EXISTING=true` - Database will be recreated on each restart
- Safe for development and testing
- Quick iteration on schema changes

### Production Mode (Recommended)
```yaml
TARTWARE_DROP_EXISTING=false      # Never drop in production
TARTWARE_BACKUP_BEFORE_DROP=true  # Always backup if needed
```

### Data Loss Prevention
- Explicit opt-in required for drop
- Backup option available
- Connection termination before drop
- Logs all operations

## 🔍 Verification

After initialization, verify the setup:

```bash
# Check tables count
docker exec -it tartware-postgres psql -U postgres -d tartware -c "\dt"

# Run verification
docker exec -it tartware-postgres psql -U postgres -d tartware -f /docker-entrypoint-initdb.d/scripts/verify-all.sql

# Expected results:
# - Tables: 132/132 (89 core + 43 advanced)
# - Indexes: 800+
# - Foreign Keys: 500+
# - Quality Score: A+ (100/100)
```

## 🐛 Troubleshooting

### Database already exists error
```bash
# Solution: Enable drop
TARTWARE_DROP_EXISTING=true docker-compose restart postgres
```

### Scripts not running
```bash
# Check logs
docker logs tartware-postgres

# Verify script permissions
docker exec -it tartware-postgres ls -la /docker-entrypoint-initdb.d/scripts/docker/
```

### Connection refused
```bash
# Wait for PostgreSQL to be ready
docker-compose ps
docker exec -it tartware-postgres pg_isready
```

### Verification failures
```bash
# Check detailed logs
docker exec -it tartware-postgres cat /tmp/tartware-init.log | grep -A 10 "ERROR"
```

## 📖 Examples

### Fresh Installation
```bash
# Start containers
docker-compose up -d

# Logs will show:
# ✓ Database created
# ✓ 132 tables created (89 core + 43 advanced)
# ✓ 800+ indexes created
# ✓ 500+ foreign key constraints created
# ✓ Verification passed (A+)
```

### Re-initialize Database
```bash
# Stop containers
docker-compose down

# Start with drop enabled (default)
docker-compose up -d

# Or explicitly set
TARTWARE_DROP_EXISTING=true docker-compose up -d
```

### Backup Before Re-initialization
```bash
# Enable backup
TARTWARE_BACKUP_BEFORE_DROP=true docker-compose up -d

# Backups stored in /backups volume
docker exec -it tartware-postgres ls -la /backups/
```

### Skip Verification (Faster)
```bash
TARTWARE_RUN_VERIFICATION=false docker-compose up -d
```

## 🔗 Related Documentation

- [Database Architecture](../../docs/database-architecture.md)
- [Phase 1+2 Implementation Summary](../../docs/PHASE1-2_IMPLEMENTATION_SUMMARY.md)
- [Completion Summary](../../COMPLETION_SUMMARY.md)

## 📞 Support

Issues? Check:
1. Docker logs: `docker logs tartware-postgres`
2. Init logs: `/tmp/tartware-init-main.log`
3. SQL logs: `/tmp/tartware-init.log`
4. GitHub Issues: [tartware/issues](https://github.com/red2n/tartware/issues)

---

**Last Updated**: October 15, 2025
