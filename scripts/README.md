# Tartware PMS - Database Scripts

This folder contains modular database scripts following industry best practices.

## � Quick Start

### 1. Installation
```bash
cd /home/navin/tartware/scripts
./00-master-install.sh
```

### 2. Verification (Recommended!)
```bash
psql -U postgres -d tartware -f verify-all.sql
```

**Expected Result:** Grade A+ (100/100) ✅

📖 **Full Verification Guide:** [VERIFICATION_GUIDE.md](VERIFICATION_GUIDE.md)

---

## �📁 Folder Structure

```
scripts/
├── 00-master-install.sh          # Master execution script (run this)
├── 01-database-setup.sql          # Database, extensions, schemas
├── 02-enum-types.sql              # 20 ENUM types
├── verify-all.sql                 # ✅ MASTER VERIFICATION SCRIPT
├── verify-installation.sql        # Legacy verification script
├── SOFT_DELETE_POLICY.md          # Soft delete documentation
├── tables/                        # Individual table files (22 files)
│   ├── 01_tenants.sql
│   ├── 02_users.sql
│   ├── 03_user_tenant_associations.sql
│   ├── 04_properties.sql
│   ├── 05_guests.sql
│   ├── 06_room_types.sql
│   ├── 07_rooms.sql
│   ├── 08_rates.sql
│   ├── 09_availability_room_availability.sql
│   ├── 10_reservations.sql
│   ├── 11_reservation_status_history.sql
│   ├── 12_payments.sql
│   ├── 13_invoices.sql
│   ├── 14_invoice_items.sql
│   ├── 15_services.sql
│   ├── 16_reservation_services.sql
│   ├── 17_housekeeping_tasks.sql
│   ├── 18_channel_mappings.sql
│   ├── 19_analytics_metrics.sql
│   ├── 20_analytics_metric_dimensions.sql
│   ├── 21_analytics_reports.sql
│   ├── 22_report_property_ids.sql
│   ├── README.md
│   └── verify-tables.sql          # ✅ Tables verification
├── indexes/
│   ├── 00-create-all-indexes.sql         # Master indexes script
│   ├── 01-22_*_indexes.sql               # Individual index files (22)
│   ├── README.md
│   └── verify-indexes.sql                # ✅ Indexes verification
├── constraints/
│   ├── 00-create-all-constraints.sql     # Master constraints script
│   ├── 01-20_*_fk.sql                    # Individual constraint files (20)
│   ├── README.md
│   └── verify-constraints.sql            # ✅ Constraints verification
├── procedures/
│   ├── 00-create-all-procedures.sql      # Master procedures script
│   ├── 01-04_*.sql                       # Individual procedure files (4)
│   ├── README.md
│   └── verify-procedures.sql             # ✅ Procedures verification
└── triggers/
    ├── 00-create-all-efficiency-triggers.sql  # Master efficiency script
    ├── 01_prevent_select_star.sql             # SELECT * prevention
    ├── 02_prevent_full_table_scans.sql        # Full scan detection
    ├── 03_enforce_tenant_isolation.sql        # Multi-tenancy security
    ├── README.md
    └── verify-triggers.sql                    # ✅ Triggers verification
```

## 🚀 Quick Start

### Method 1: Using Master Script (Recommended)

```bash
# Set environment variables (optional)
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=tartware
export DB_USER=postgres

# Run master script
cd /home/navin/tartware/scripts
./00-master-install.sh
```

### Method 2: Manual Execution

```bash
# 1. Database setup
psql -U postgres -d tartware -f 01-database-setup.sql

# 2. ENUM types
psql -U postgres -d tartware -f 02-enum-types.sql

# 3. Tables (in order)
psql -U postgres -d tartware -f tables/01_tenants.sql
psql -U postgres -d tartware -f tables/02_users.sql
# ... continue for all 22 tables
```

### Method 3: Using Docker

```bash
# Copy scripts into container
docker cp scripts/ tartware-postgres:/tmp/

# Execute inside container
docker exec -it tartware-postgres bash
cd /tmp/scripts
./00-master-install.sh
```

## 📋 Execution Order

**CRITICAL:** Scripts must be executed in this order due to dependencies:

1. **01-database-setup.sql** - Extensions and schemas
2. **02-enum-types.sql** - ENUM types
3. **tables/** - All 22 table files (in numbered order)
4. **indexes/00-create-all-indexes.sql** - All indexes ✅
5. **constraints/00-create-all-constraints.sql** - All foreign keys ✅
6. **procedures/00-create-all-procedures.sql** - All stored procedures ✅
7. **triggers/00-create-all-efficiency-triggers.sql** - Query efficiency & security ✅ (Optional but recommended)

## 🏗️ Architecture

### Multi-Tenant Hierarchy

```
Tenant (Organization)
└── Properties (Hotels/Resorts)
    └── Room Types (Categories)
        └── Rooms (Physical inventory)
            └── Reservations (Bookings)
```

### Schema Design

- **public** - Main application tables
- **availability** - High-volume inventory data (partitioned for performance)

### Key Features

- ✅ UUID primary keys
- ✅ Soft delete (deleted_at)
- ✅ Optimistic locking (version)
- ✅ JSONB for flexible config
- ✅ 20 ENUM types for type safety
- ✅ Comprehensive constraints
- ✅ Audit trails (created_at, updated_at, created_by, updated_by)
- ✅ Query efficiency monitoring
- ✅ Tenant isolation enforcement

## 📊 Database Statistics

- **Extensions:** 2 (uuid-ossp, pg_stat_statements)
- **Schemas:** 2 (public, availability)
- **ENUM Types:** 20
- **Tables:** 22 ✅
- **Indexes:** ~250+ ✅
- **Foreign Keys:** ~60+ ✅
- **Procedures/Functions:** 14 ✅
- **Efficiency Functions:** 9 ✅
- **Monitoring Views:** 3 ✅

## 🔐 Security & Efficiency

- ✅ Row-level tenant isolation via `tenant_id`
- ✅ Soft delete instead of hard delete
- ✅ Password hashing (not stored in plain text)
- ✅ JSONB for PII that may need encryption
- ✅ **SELECT * prevention** - Forces explicit column selection
- ✅ **Full table scan detection** - Warns about inefficient queries
- ✅ **Tenant isolation enforcement** - Validates multi-tenant queries
- ✅ **Access auditing** - Logs tenant data access for compliance

## 🧪 Verification & Testing

### Quick Verification (Master Script)

Run comprehensive verification of all components:

```bash
psql -U postgres -d tartware -f verify-all.sql
```

This master script validates:
- ✅ All 22 tables created correctly
- ✅ ~250+ indexes in place
- ✅ ~60+ foreign key constraints
- ✅ 14 stored procedures/functions
- ✅ Soft delete implementation
- ✅ Multi-tenancy setup
- ✅ Quality score (0-100)

**Output:** Comprehensive report with pass/fail status and grade (A+ to F)

### Component-Level Verification

For detailed validation of specific components:

```bash
# Verify tables only
psql -U postgres -d tartware -f tables/verify-tables.sql

# Verify indexes only
psql -U postgres -d tartware -f indexes/verify-indexes.sql

# Verify constraints only
psql -U postgres -d tartware -f constraints/verify-constraints.sql

# Verify procedures only
psql -U postgres -d tartware -f procedures/verify-procedures.sql
```

Each verification script provides:
- Expected vs actual counts
- Detailed component lists
- Missing items (if any)
- Best practice compliance
- Specific recommendations

### Manual Testing Queries

```sql
-- Check tables
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname IN ('public', 'availability')
ORDER BY schemaname, tablename;

-- Check ENUM types
SELECT typname
FROM pg_type
WHERE typtype = 'e'
ORDER BY typname;

-- Count records (should be 0 after fresh install)
SELECT
    schemaname,
    tablename,
    (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
    SELECT
        schemaname,
        tablename,
        query_to_xml(format('SELECT count(*) as cnt FROM %I.%I', schemaname, tablename), false, true, '') as xml_count
    FROM pg_tables
    WHERE schemaname IN ('public', 'availability')
) t
ORDER BY schemaname, tablename;
```

## 📖 Industry Standards Compliance

This schema follows patterns from:

- **Oracle OPERA Cloud PMS** - Property management structure
- **Cloudbeds** - Multi-tenant architecture
- **Protel PMS** - European hospitality standards
- **RMS Cloud** - Rate management and availability

## 🔄 Next Steps

### Phase 1: Indexes (Performance)
Create index files for:
- Foreign keys
- Frequently queried columns
- Composite indexes for complex queries
- Full-text search indexes

### Phase 2: Foreign Key Constraints
Add referential integrity:
- properties.tenant_id → tenants.id
- rooms.room_type_id → room_types.id
- reservations.guest_id → guests.id
- etc.

### Phase 3: Stored Procedures
Implement business logic:
- Calculate occupancy rate
- Update availability after reservation
- Generate invoice from reservation
- Calculate ADR, RevPAR

### Phase 4: Sample Data
Create realistic test data:
- 500 tenants
- 1000 properties
- 2000 guests
- 5000 rooms
- 10000 reservations

## 🐛 Troubleshooting

### Error: "database does not exist"
```bash
createdb -U postgres tartware
```

### Error: "permission denied"
```bash
# Grant permissions
psql -U postgres -c "GRANT ALL ON DATABASE tartware TO postgres;"
```

### Error: "relation already exists"
```bash
# Tables already exist, drop them first (WARNING: deletes all data)
psql -U postgres -d tartware -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -U postgres -d tartware -c "DROP SCHEMA availability CASCADE; CREATE SCHEMA availability;"
```

## 📝 File Naming Convention

- **00-master-install.sh** - Master orchestration script
- **01-database-setup.sql** - Foundation setup
- **02-enum-types.sql** - Type definitions
- **tables/XX_table_name.sql** - Individual tables (XX = execution order)

## 🤝 Contributing

When adding new tables:

1. Create new file: `tables/XX_new_table.sql`
2. Follow existing structure (comments, constraints, audit fields)
3. Update `00-master-install.sh` to include new file
4. Update this README

## 📄 License

Proprietary - Tartware PMS

## 📞 Support

For issues or questions, refer to:
- Main README: `/home/navin/tartware/README.md`
- Documentation: `/home/navin/tartware/docs/`
