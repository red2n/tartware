# Soft Delete Policy & Implementation Guide

**Date:** October 15, 2025
**Project:** Tartware PMS
**Version:** 1.0

---

## 🎯 Overview

Tartware PMS implements **soft delete** (logical deletion) instead of hard delete (physical removal) for data protection, audit compliance, and referential integrity.

---

## ✅ Soft Delete Implementation Status

### Tables WITH Soft Delete (18/22)

| # | Table | Soft Delete | Reason |
|---|-------|-------------|---------|
| 1 | tenants | ✅ YES | Master data - critical, never hard delete |
| 2 | users | ✅ YES | User accounts - audit trail required |
| 3 | user_tenant_associations | ✅ YES | Access control - track removals |
| 4 | properties | ✅ YES | Master data - preserve history |
| 5 | guests | ✅ YES | Customer data - GDPR compliance |
| 6 | room_types | ✅ YES | Master data - preserve bookings |
| 7 | rooms | ✅ YES | Inventory - track lifecycle |
| 8 | rates | ✅ YES | Pricing history - audit trail |
| 9 | reservations | ✅ YES | Bookings - financial records |
| 10 | payments | ✅ YES | Financial - legal requirement |
| 11 | invoices | ✅ YES | Financial - legal requirement |
| 12 | invoice_items | ✅ YES | Financial - legal requirement |
| 13 | services | ✅ YES | Master data - preserve history |
| 14 | reservation_services | ✅ YES | Transaction data - audit trail |
| 15 | housekeeping_tasks | ✅ YES | Operational data - track history |
| 16 | channel_mappings | ✅ YES | Integration config - preserve |
| 17 | analytics_reports | ✅ YES | User content - preserve |
| 18 | availability.room_availability | ❌ NO | High-volume, time-series data |

### Tables WITHOUT Soft Delete (4/22)

| # | Table | Soft Delete | Reason |
|---|-------|-------------|---------|
| 1 | reservation_status_history | ❌ NO | **Audit trail** - append-only, never delete |
| 2 | analytics_metrics | ❌ NO | **Time-series data** - historical facts |
| 3 | analytics_metric_dimensions | ❌ NO | **Dimensional data** - tied to metrics |
| 4 | report_property_ids | ❌ NO | **Association table** - managed by parent |

---

## 🔒 Soft Delete vs Hard Delete

### Soft Delete (Default)
```sql
-- Mark as deleted (soft delete)
UPDATE guests
SET deleted_at = CURRENT_TIMESTAMP,
    deleted_by = 'admin@example.com'
WHERE id = 'guest-uuid-here';

-- Query only active records
SELECT * FROM guests WHERE deleted_at IS NULL;
```

**Benefits:**
- ✅ Data recovery possible
- ✅ Audit trail preserved
- ✅ Foreign keys remain valid
- ✅ Compliance with regulations
- ✅ Historical reports intact

### Hard Delete (Restricted - Requires Special Permission)
```sql
-- Physical removal (PERMANENT!)
DELETE FROM guests WHERE id = 'guest-uuid-here';
```

**When Allowed:**
- ⚠️ Only with `HARD_DELETE` permission
- ⚠️ After soft delete + review period (e.g., 90 days)
- ⚠️ GDPR "Right to be Forgotten" requests
- ⚠️ Data purging policies
- ⚠️ Audit log preserved separately

---

## 👥 Permission Model

### Standard User Permissions
```
READ     - View active records
CREATE   - Insert new records
UPDATE   - Modify active records
DELETE   - Soft delete only (sets deleted_at)
```

### Administrator Permissions
```
All standard permissions +
RESTORE  - Restore soft-deleted records (set deleted_at = NULL)
VIEW_DELETED - View soft-deleted records
```

### Super Administrator Permissions
```
All administrator permissions +
HARD_DELETE - Permanently remove records (DANGEROUS!)
PURGE       - Bulk permanent deletion
```

---

## 🔍 Query Patterns

### Application Queries (Always Filter Soft Deleted)

#### SELECT Queries
```sql
-- ✅ CORRECT: Filter out deleted records
SELECT * FROM guests
WHERE tenant_id = 'xxx'
  AND deleted_at IS NULL;

-- ❌ WRONG: Will include deleted records
SELECT * FROM guests
WHERE tenant_id = 'xxx';
```

#### JOIN Queries
```sql
-- ✅ CORRECT: Filter in both tables
SELECT r.*, g.first_name, g.last_name
FROM reservations r
JOIN guests g ON r.guest_id = g.id AND g.deleted_at IS NULL
WHERE r.deleted_at IS NULL;
```

#### COUNT Queries
```sql
-- ✅ CORRECT: Count only active
SELECT COUNT(*)
FROM guests
WHERE tenant_id = 'xxx' AND deleted_at IS NULL;
```

### Admin Queries (View Deleted Records)

```sql
-- View soft-deleted records
SELECT * FROM guests
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- View deleted in last 30 days
SELECT * FROM guests
WHERE deleted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY deleted_at DESC;
```

---

## 🛡️ Implementation in Application Code

### Backend Service Layer

```typescript
// TypeScript/Node.js Example

class GuestService {
  // Soft delete (default)
  async delete(guestId: string, userId: string): Promise<void> {
    await db.query(`
      UPDATE guests
      SET deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $2
      WHERE id = $1 AND deleted_at IS NULL
    `, [guestId, userId]);
  }

  // Restore soft-deleted record
  async restore(guestId: string, userId: string): Promise<void> {
    // Requires RESTORE permission
    if (!hasPermission(userId, 'RESTORE')) {
      throw new Error('Insufficient permissions');
    }

    await db.query(`
      UPDATE guests
      SET deleted_at = NULL,
          deleted_by = NULL,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $2
      WHERE id = $1
    `, [guestId, userId]);
  }

  // Hard delete (restricted)
  async hardDelete(guestId: string, userId: string): Promise<void> {
    // Requires HARD_DELETE permission
    if (!hasPermission(userId, 'HARD_DELETE')) {
      throw new Error('Insufficient permissions');
    }

    // Log before deletion
    await auditLog.log({
      action: 'HARD_DELETE',
      table: 'guests',
      recordId: guestId,
      userId: userId,
      timestamp: new Date()
    });

    // Permanent deletion
    await db.query(`DELETE FROM guests WHERE id = $1`, [guestId]);
  }

  // List all (active only by default)
  async findAll(tenantId: string, includeDeleted = false): Promise<Guest[]> {
    const deletedFilter = includeDeleted ? '' : 'AND deleted_at IS NULL';

    return await db.query(`
      SELECT * FROM guests
      WHERE tenant_id = $1 ${deletedFilter}
      ORDER BY created_at DESC
    `, [tenantId]);
  }
}
```

### Database View for Active Records

```sql
-- Create view that automatically filters deleted records
CREATE VIEW guests_active AS
SELECT * FROM guests WHERE deleted_at IS NULL;

-- Application can query view instead
SELECT * FROM guests_active WHERE tenant_id = 'xxx';
```

---

## 📋 Soft Delete Best Practices

### ✅ DO:

1. **Always filter deleted_at** in application queries
2. **Use database views** for active records
3. **Add indexes** with `WHERE deleted_at IS NULL`
4. **Log hard deletes** before execution
5. **Implement restore functionality** for administrators
6. **Set retention policy** (e.g., purge after 1 year)
7. **Include deleted_by** to track who deleted
8. **Test soft delete** in all CRUD operations

### ❌ DON'T:

1. **Don't use hard DELETE** in application code
2. **Don't forget deleted_at filter** in queries
3. **Don't allow users** to hard delete
4. **Don't soft delete audit tables** (append-only)
5. **Don't soft delete time-series data** (wasteful)
6. **Don't skip permission checks** for hard delete
7. **Don't forget to update FKs** when restoring
8. **Don't lose audit trail** when hard deleting

---

## 🔄 Cascade Behavior

### Soft Delete Cascade

When soft deleting a parent record, consider cascading to children:

```sql
-- Example: Soft delete property and all its rooms
BEGIN;

-- Soft delete property
UPDATE properties
SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 'admin@example.com'
WHERE id = 'property-uuid';

-- Cascade to rooms
UPDATE rooms
SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 'admin@example.com'
WHERE property_id = 'property-uuid' AND deleted_at IS NULL;

-- Cascade to room_types
UPDATE room_types
SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 'admin@example.com'
WHERE property_id = 'property-uuid' AND deleted_at IS NULL;

COMMIT;
```

### Restore Cascade

When restoring, restore children too:

```sql
-- Example: Restore property and its rooms
BEGIN;

-- Restore property
UPDATE properties
SET deleted_at = NULL, deleted_by = NULL
WHERE id = 'property-uuid';

-- Restore rooms
UPDATE rooms
SET deleted_at = NULL, deleted_by = NULL
WHERE property_id = 'property-uuid' AND deleted_at IS NOT NULL;

COMMIT;
```

---

## 📊 Monitoring & Maintenance

### Find Old Soft-Deleted Records

```sql
-- Records deleted more than 1 year ago (candidates for purging)
SELECT
    schemaname,
    tablename,
    COUNT(*) as deleted_count,
    MIN(deleted_at) as oldest_deletion,
    MAX(deleted_at) as newest_deletion
FROM (
    SELECT 'public' as schemaname, 'guests' as tablename, deleted_at FROM guests WHERE deleted_at < CURRENT_TIMESTAMP - INTERVAL '1 year'
    UNION ALL
    SELECT 'public', 'reservations', deleted_at FROM reservations WHERE deleted_at < CURRENT_TIMESTAMP - INTERVAL '1 year'
    UNION ALL
    SELECT 'public', 'properties', deleted_at FROM properties WHERE deleted_at < CURRENT_TIMESTAMP - INTERVAL '1 year'
    -- Add more tables as needed
) deleted_records
GROUP BY schemaname, tablename
ORDER BY deleted_count DESC;
```

### Soft Delete Statistics

```sql
-- Count active vs deleted records per table
SELECT
    'guests' as table_name,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_count,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_count,
    COUNT(*) as total_count
FROM guests
UNION ALL
SELECT 'reservations',
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL),
    COUNT(*)
FROM reservations
-- Add more tables
ORDER BY table_name;
```

---

## 🧹 Data Purging Policy

### Recommended Retention Periods

| Record Type | Retention | Reason |
|-------------|-----------|---------|
| Financial (payments, invoices) | 7 years | Legal requirement |
| Guest data | 2 years | GDPR compliance |
| Reservations | 5 years | Business analytics |
| Operational data | 1 year | Space optimization |
| Master data | Indefinite | Reference integrity |

### Purge Procedure

```sql
-- Create purge function (execute monthly)
CREATE OR REPLACE FUNCTION purge_old_deleted_records()
RETURNS TABLE(table_name TEXT, purged_count BIGINT) AS $$
BEGIN
    -- Purge guests deleted > 2 years ago
    DELETE FROM guests
    WHERE deleted_at < CURRENT_TIMESTAMP - INTERVAL '2 years';
    table_name := 'guests';
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    RETURN NEXT;

    -- Purge housekeeping tasks deleted > 1 year ago
    DELETE FROM housekeeping_tasks
    WHERE deleted_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
    table_name := 'housekeeping_tasks';
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    RETURN NEXT;

    -- Add more tables with appropriate retention periods

    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Execute purge (requires HARD_DELETE permission)
SELECT * FROM purge_old_deleted_records();
```

---

## 🔐 Security Checklist

- [ ] Application enforces soft delete by default
- [ ] Hard delete requires `HARD_DELETE` permission
- [ ] All queries filter `deleted_at IS NULL`
- [ ] Indexes include `WHERE deleted_at IS NULL`
- [ ] Restore functionality available for admins
- [ ] Audit log captures all hard deletes
- [ ] Purge policy documented and automated
- [ ] GDPR compliance verified
- [ ] Foreign key constraints respect soft delete
- [ ] Tests cover soft delete scenarios

---

## 📝 Summary

| Aspect | Implementation |
|--------|----------------|
| **Tables with soft delete** | 18/22 (82%) |
| **Default delete behavior** | Soft delete (sets deleted_at) |
| **Hard delete permission** | HARD_DELETE (super admin only) |
| **Query filtering** | Always include `WHERE deleted_at IS NULL` |
| **Index strategy** | Partial indexes with `WHERE deleted_at IS NULL` |
| **Restore capability** | Yes (admin permission) |
| **Audit trail** | Complete (deleted_by, deleted_at) |
| **Compliance** | GDPR ready |

---

**Status:** ✅ Implemented
**Last Review:** 2025-10-15
**Next Review:** 2026-01-15
