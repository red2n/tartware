# Foreign Key Constraints

This directory contains all foreign key constraint definitions for the Tartware PMS database.

## 📁 Contents

### Master Script
- **00-create-all-constraints.sql** - Master execution script for all constraints

### Verification Script
- **verify-constraints.sql** - Comprehensive validation of all constraints

### Individual Constraint Files (Ordered by Dependencies)
1. **01_user_tenant_associations_fk.sql** - User-tenant associations
2. **02_properties_fk.sql** - Properties
3. **03_guests_fk.sql** - Guests
4. **04_room_types_fk.sql** - Room types
5. **05_rooms_fk.sql** - Rooms
6. **06_rates_fk.sql** - Rate plans
7. **07_availability_room_availability_fk.sql** - Room availability
8. **08_reservations_fk.sql** - Reservations
9. **09_reservation_status_history_fk.sql** - Reservation status history
10. **10_payments_fk.sql** - Payments
11. **11_invoices_fk.sql** - Invoices
12. **12_invoice_items_fk.sql** - Invoice line items
13. **13_services_fk.sql** - Services
14. **14_reservation_services_fk.sql** - Reservation-service associations
15. **15_housekeeping_tasks_fk.sql** - Housekeeping tasks
16. **16_channel_mappings_fk.sql** - Channel mappings
17. **17_analytics_metrics_fk.sql** - Analytics metrics
18. **18_analytics_metric_dimensions_fk.sql** - Metric dimensions
19. **19_analytics_reports_fk.sql** - Analytics reports
20. **20_report_property_ids_fk.sql** - Report-property associations

## 🎯 Purpose

Foreign key constraints ensure **referential integrity** across the database:
- ✅ Prevent orphaned records
- ✅ Enforce valid relationships between tables
- ✅ Support soft delete pattern with RESTRICT policy
- ✅ Maintain data consistency

## 🛡️ Constraint Policy

### ON DELETE RESTRICT
All foreign keys use `ON DELETE RESTRICT` to:
- **Prevent accidental hard deletes** of parent records
- **Enforce soft delete pattern** at application layer
- **Protect financial and audit data** from cascading deletes
- **Require explicit permission** (HARD_DELETE) for physical deletion

### ON UPDATE CASCADE
All foreign keys use `ON UPDATE CASCADE` to:
- Automatically update foreign keys when primary keys change
- Maintain referential integrity during ID updates

## 📋 Execution Order

**IMPORTANT**: Run constraints AFTER tables and indexes are created.

### Option 1: Master Script (Recommended)
```bash
cd /home/navin/tartware/scripts/constraints
psql -U postgres -d tartware -f 00-create-all-constraints.sql
```

### Option 2: Individual Files
```bash
cd /home/navin/tartware/scripts/constraints
psql -U postgres -d tartware -f 01_user_tenant_associations_fk.sql
psql -U postgres -d tartware -f 02_properties_fk.sql
# ... continue in order
```

## 🔍 Verification

### Check All Constraints
```sql
SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema IN ('public', 'availability')
ORDER BY tc.table_name, tc.constraint_name;
```

### Count Constraints by Table
```sql
SELECT
    tc.table_name,
    COUNT(*) as foreign_key_count
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema IN ('public', 'availability')
GROUP BY tc.table_name
ORDER BY tc.table_name;
```

### Total Constraint Count
```sql
SELECT COUNT(*) as total_foreign_keys
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema IN ('public', 'availability');
```

## 🚨 Soft Delete Integration

### Key Principle
**Foreign keys RESTRICT hard deletes** - forcing soft delete pattern:

```sql
-- ❌ This will FAIL if child records exist:
DELETE FROM properties WHERE id = '123';

-- ✅ This is the correct approach:
UPDATE properties
SET deleted_at = CURRENT_TIMESTAMP,
    deleted_by = 'user@example.com'
WHERE id = '123';
```

### Permission Model
- **Standard Users**: Can only soft delete (UPDATE deleted_at)
- **Admins**: Can restore soft-deleted records
- **Super Admins**: Can hard delete (DELETE) with HARD_DELETE permission

### Application Queries
Always filter out deleted records:
```sql
SELECT * FROM properties
WHERE tenant_id = '...'
  AND deleted_at IS NULL;  -- Critical filter
```

## 📊 Constraint Statistics

Expected totals after creation:
- **20 constraint files**
- **~60+ foreign key constraints** across all tables
- **0 CASCADE delete policies** (all RESTRICT)
- **100% UPDATE CASCADE** for ID changes

## 🔗 Dependencies

### Prerequisites
1. ✅ All tables created (`scripts/tables/*.sql`)
2. ✅ All indexes created (`scripts/indexes/*.sql`)
3. ✅ Soft delete fields added to 18/22 tables
4. ✅ Database running (PostgreSQL 16)

### Execution Flow
```
Phase 1: Tables & Enums
    ↓
Phase 2A: Indexes
    ↓
Phase 2B: Constraints ← YOU ARE HERE
    ↓
Phase 2C: Stored Procedures (optional)
    ↓
Phase 3: Sample Data
```

## 📖 Related Documentation

- [Soft Delete Policy](../SOFT_DELETE_POLICY.md) - Comprehensive soft delete implementation guide
- [Database Architecture](../../docs/database-architecture.md) - Full schema documentation
- [Table Definitions](../tables/README.md) - Individual table schemas
- [Index Definitions](../indexes/README.md) - Performance optimization indexes

## ⚠️ Important Notes

1. **RESTRICT Policy**: All foreign keys prevent hard deletes of parent records
2. **Soft Delete First**: Always soft delete before attempting hard delete
3. **Permission Required**: HARD_DELETE permission needed for physical deletion
4. **Audit Trail**: Soft deletes preserve audit history and financial records
5. **Cascade Updates**: Primary key updates cascade automatically
6. **Multi-tenancy**: All constraints respect tenant isolation

## 🐛 Troubleshooting

### Constraint Creation Fails
```sql
-- Check for existing data violating constraints
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'your_table';

-- Check for orphaned records
SELECT * FROM child_table
WHERE parent_id NOT IN (SELECT id FROM parent_table);
```

### Can't Delete Record
```
ERROR: update or delete on table "parent_table" violates foreign key constraint
```
**Solution**: This is intentional! Use soft delete instead:
```sql
UPDATE parent_table
SET deleted_at = NOW(), deleted_by = 'user@example.com'
WHERE id = '...';
```

## 📝 Naming Convention

All constraints follow this pattern:
```
fk_{child_table}_{column_name}
```

Examples:
- `fk_properties_tenant_id`
- `fk_reservations_guest_id`
- `fk_invoice_items_invoice_id`

## 🔄 Rollback

To remove all constraints:
```sql
-- Generate DROP statements for all foreign keys
SELECT 'ALTER TABLE ' || table_schema || '.' || table_name ||
       ' DROP CONSTRAINT ' || constraint_name || ';'
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema IN ('public', 'availability');
```

---

**Last Updated**: 2025-10-15
**Phase**: 2B - Foreign Key Constraints
**Status**: ✅ Complete - Ready for execution
