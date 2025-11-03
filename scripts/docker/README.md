# Docker Database Initialization Scripts

This directory contains the automation that prepares the Tartware PMS schema inside the PostgreSQL Docker container. The scripts are mounted into `/docker-entrypoint-initdb.d/scripts/docker` by `docker-compose.yml` and run during the database bootstrap and future schema refreshes.

## 📁 Key Files

- `docker-entrypoint-custom.sh` – wrapper invoked by Docker, copies our initializer to `/docker-entrypoint-initdb.d/00-tartware-init.sh` and hands control back to the official PostgreSQL entrypoint.
- `00-tartware-init.sh` – runs automatically the first time the container starts with an empty volume; creates the `tartware` database and executes the full install via `run-all-scripts.sh`. Honours `TARTWARE_RUN_VERIFICATION`.
- `run-all-scripts.sh` – executes the SQL phases in order (extensions → enums → tables → indexes → constraints → optional verification) and streams progress to `/tmp/tartware-init.log`.
- `init-database.sh` – richer orchestrator for manual re-runs; checks for an existing database, optionally performs backups, supports controlled drop/recreate, and then reuses `run-all-scripts.sh`.
- `drop-and-recreate.sql` – helper invoked by `init-database.sh` to terminate active connections and rebuild the `tartware` database safely.

## 🔄 Execution Flow

```
docker-entrypoint-custom.sh
        ↓
00-tartware-init.sh  (first boot only)
        ↓
run-all-scripts.sh
        ↓
    Phase 1  01-database-setup.sql         (extensions & schemas)
    Phase 2  02-enum-types.sql             (enum catalogue)
    Phase 3  tables/00-create-all-tables.sql   (119 base tables across 7 domains)
    Phase 4  indexes/00-create-all-indexes.sql (≈1,900 indexes incl. PK/unique)
    Phase 5  constraints/00-create-all-constraints.sql (≈1,050 foreign keys)
    Phase 6  verify-all.sql (optional, toggled by TARTWARE_RUN_VERIFICATION)
```

For subsequent refreshes, run `init-database.sh` inside the container; it wraps the same phases while handling drops, backups, and verification flags.

## 🚀 Usage

### Automatic bootstrap (docker-compose)

```bash
docker-compose up -d
```

On the first start of `tartware-postgres` the scripts above will run automatically. Container logs include the full bootstrap output.

### Manual rebuild (inside the running container)

```bash
docker exec -it tartware-postgres bash
/docker-entrypoint-initdb.d/scripts/docker/init-database.sh
```

You can override behaviour on the fly:

```bash
TARTWARE_DROP_EXISTING=false \
TARTWARE_RUN_VERIFICATION=true \
docker exec -it tartware-postgres \
  /docker-entrypoint-initdb.d/scripts/docker/init-database.sh
```

### One-off rebuild from the host

```bash
TARTWARE_BACKUP_BEFORE_DROP=true \
docker exec tartware-postgres \
  /docker-entrypoint-initdb.d/scripts/docker/init-database.sh
```

## ⚙️ Configuration

| Variable | Default (`init-database.sh`) | Notes |
|----------|-----------------------------|-------|
| `TARTWARE_DROP_EXISTING` | `true` | Drop and recreate the database when it already exists. |
| `TARTWARE_RUN_VERIFICATION` | `true` | Runs `verify-all.sql` after installation. `docker-compose.yml` sets this to `false` to speed first boot. |
| `TARTWARE_BACKUP_BEFORE_DROP` | `false` | Dumps the current database to `/backups` before dropping. |

Set variables in `docker-compose.yml`, an `.env` file, or inline when calling `init-database.sh`.

## 📊 Schema Footprint (current scripts)

- 119 base tables grouped into 7 domains (`core`, `inventory`, `bookings`, `financial`, `operations`, `integrations`, `analytics`).
- 1,897 indexes created by the index pack (includes primary keys and unique constraints).
- 1,046 foreign key constraints managed through the consolidated constraint scripts.
- Soft-delete (`deleted_at`) and multi-tenant (`tenant_id`) columns enforced throughout the schema.
- Comprehensive verification via `verify-all.sql`, which reports counts, quality score, and common health checks.

## 📝 Logs

- `/tmp/tartware-init-main.log` – main orchestration log produced by `init-database.sh`.
- `/tmp/tartware-init.log` – detailed execution log from `run-all-scripts.sh`.
- `docker logs tartware-postgres` – container stdout/stderr (includes `00-tartware-init.sh` output).

```bash
docker exec tartware-postgres tail -f /tmp/tartware-init.log
```

## 🐛 Troubleshooting

- **Database already exists**  
  Enable the drop flag: `TARTWARE_DROP_EXISTING=true docker-compose restart postgres`

- **Scripts did not run**  
  Check permissions and logs inside the container:  
  `docker exec -it tartware-postgres ls -la /docker-entrypoint-initdb.d/scripts/docker/`

- **Connection refused**  
  Wait for PostgreSQL health check to pass:  
  `docker-compose ps` and `docker exec -it tartware-postgres pg_isready`

- **Verification warnings**  
  Inspect `/tmp/tartware-init.log` for error sections or re-run with `TARTWARE_RUN_VERIFICATION=true`.

## 📖 Related Documentation

- [Database Architecture](../../docs/database-architecture.md)
- [Phase 1+2 Implementation Summary](../../docs/PHASE1-2_IMPLEMENTATION_SUMMARY.md)
- [Completion Summary](../../COMPLETION_SUMMARY.md)

## 📞 Support

- Container logs: `docker logs tartware-postgres`
- Main orchestrator log: `/tmp/tartware-init-main.log`
- Schema execution log: `/tmp/tartware-init.log`

---

**Last Updated**: November 3, 2025
