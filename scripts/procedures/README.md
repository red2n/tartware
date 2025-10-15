# Stored Procedures

This directory contains stored procedures and functions for the Tartware PMS database using PostgreSQL's MERGE command (15+) and ON CONFLICT for efficient upsert operations.

## 📁 Contents

### Master Script
- **00-create-all-procedures.sql** - Master execution script for all procedures

### Procedure Files
1. **01_guest_upsert.sql** - Guest management with deduplication
2. **02_channel_sync_merge.sql** - Channel manager synchronization (Booking.com, Expedia)
3. **03_rate_management_merge.sql** - Bulk rate updates and seasonal adjustments
4. **04_analytics_aggregation_merge.sql** - Daily/monthly metric aggregations

## 🎯 Purpose

These procedures provide business logic for common PMS operations:
- ✅ **Prevent duplicate records** (guest profiles, bookings)
- ✅ **Efficient bulk operations** (channel sync, rate updates)
- ✅ **Automated aggregations** (daily/monthly analytics)
- ✅ **Data consistency** (upsert vs insert+update)

## 🚀 Features

### 1. Guest Management (01_guest_upsert.sql)
```sql
-- Upsert guest (prevents duplicates)
SELECT upsert_guest(
    'tenant-id'::UUID,
    'guest@example.com',
    'John',
    'Doe',
    '+1234567890'
);

-- Find and merge duplicate guests
SELECT * FROM merge_duplicate_guests(
    'tenant-id'::UUID,
    TRUE  -- dry_run (preview changes)
);

-- Bulk import guests from JSON
SELECT * FROM bulk_upsert_guests(
    'tenant-id'::UUID,
    '[
        {"email": "guest1@example.com", "first_name": "John", "last_name": "Doe"},
        {"email": "guest2@example.com", "first_name": "Jane", "last_name": "Smith"}
    ]'::JSONB
);
```

### 2. Channel Synchronization (02_channel_sync_merge.sql)
```sql
-- Sync room availability from Booking.com
SELECT * FROM sync_channel_availability(
    'tenant-id'::UUID,
    'property-id'::UUID,
    '[
        {
            "room_type_id": "room-type-id",
            "date": "2025-10-20",
            "available": 10,
            "booked": 5,
            "rate": 150.00,
            "closed": false
        }
    ]'::JSONB
);

-- Import reservations from channel managers
SELECT * FROM sync_channel_reservations(
    'tenant-id'::UUID,
    'property-id'::UUID,
    'BOOKING_COM',
    '[
        {
            "confirmation_number": "BK123456",
            "guest_email": "guest@example.com",
            "guest_first_name": "John",
            "guest_last_name": "Doe",
            "check_in": "2025-10-20",
            "check_out": "2025-10-22",
            "total_amount": 300.00,
            "status": "CONFIRMED"
        }
    ]'::JSONB
);

-- Sync room type mappings
SELECT * FROM sync_channel_mapping(
    'tenant-id'::UUID,
    'property-id'::UUID,
    'BOOKING_COM',
    '[
        {
            "local_room_type_id": "local-id",
            "channel_room_type_id": "12345",
            "channel_room_type_name": "Deluxe King Room"
        }
    ]'::JSONB
);
```

### 3. Rate Management (03_rate_management_merge.sql)
```sql
-- Bulk sync rate plans
SELECT * FROM sync_rate_plans(
    'tenant-id'::UUID,
    'property-id'::UUID,
    '[
        {
            "room_type_id": "room-type-id",
            "rate_code": "BAR",
            "rate_name": "Best Available Rate",
            "base_rate": 150.00,
            "weekend_rate": 180.00,
            "is_active": true
        }
    ]'::JSONB
);

-- Apply seasonal rate adjustments (increase by 20%)
SELECT * FROM apply_seasonal_rate_adjustments(
    'tenant-id'::UUID,
    'property-id'::UUID,
    'Summer 2025',
    '2025-06-01'::DATE,
    '2025-08-31'::DATE,
    'PERCENTAGE',
    20.00  -- 20% increase
);

-- Set daily rate overrides (holidays, events)
SELECT * FROM sync_daily_rate_overrides(
    'tenant-id'::UUID,
    'property-id'::UUID,
    '[
        {
            "room_type_id": "room-type-id",
            "date": "2025-12-25",
            "rate": 350.00,
            "min_stay": 2
        }
    ]'::JSONB
);

-- Copy rate plan with adjustment
SELECT copy_rate_plan(
    'source-rate-id'::UUID,
    'EARLY_BIRD',
    'Early Bird Special',
    'PERCENTAGE',
    -10.00  -- 10% discount
);
```

### 4. Analytics Aggregation (04_analytics_aggregation_merge.sql)
```sql
-- Aggregate daily metrics (run nightly)
SELECT * FROM aggregate_daily_metrics(
    'tenant-id'::UUID,
    'property-id'::UUID,
    CURRENT_DATE - INTERVAL '1 day'
);

-- Aggregate monthly metrics (run at month end)
SELECT * FROM aggregate_monthly_metrics(
    'tenant-id'::UUID,
    'property-id'::UUID,
    2025,  -- year
    10     -- month
);

-- Calculate revenue by booking source
SELECT * FROM calculate_revenue_metrics(
    'tenant-id'::UUID,
    'property-id'::UUID,
    '2025-10-01'::DATE,
    '2025-10-31'::DATE
);

-- Sync dimensional metrics (by room type, rate, etc.)
SELECT * FROM sync_metric_dimensions(
    'tenant-id'::UUID,
    'property-id'::UUID,
    CURRENT_DATE - INTERVAL '1 day'
);
```

## 📋 Execution Order

### Prerequisites
1. ✅ PostgreSQL 15+ (for MERGE command)
2. ✅ All tables created
3. ✅ All indexes created
4. ✅ All foreign key constraints created

### Installation
```bash
cd /home/navin/tartware/scripts/procedures
psql -U postgres -d tartware -f 00-create-all-procedures.sql
```

## 🔍 Available Procedures/Functions

### Guest Management (3 functions)
- `upsert_guest()` - Insert or update guest profile
- `merge_duplicate_guests()` - Find and merge duplicates
- `bulk_upsert_guests()` - Bulk import from JSON

### Channel Synchronization (3 functions)
- `sync_channel_availability()` - Sync room availability using MERGE
- `sync_channel_reservations()` - Import reservations from channels
- `sync_channel_mapping()` - Maintain room type mappings

### Rate Management (4 functions)
- `sync_rate_plans()` - Bulk sync rate plans using MERGE
- `apply_seasonal_rate_adjustments()` - Bulk rate adjustments
- `sync_daily_rate_overrides()` - Date-specific rate overrides
- `copy_rate_plan()` - Clone rate plan with adjustments

### Analytics (4 functions)
- `aggregate_daily_metrics()` - Daily performance metrics using MERGE
- `aggregate_monthly_metrics()` - Monthly rollup using MERGE
- `calculate_revenue_metrics()` - Revenue by source
- `sync_metric_dimensions()` - Dimensional breakdowns using MERGE

**Total: 14 procedures/functions**

## 💡 Key Technologies

### MERGE Command (PostgreSQL 15+)
```sql
MERGE INTO target_table
USING source_data
ON (match_condition)
WHEN MATCHED THEN UPDATE ...
WHEN NOT MATCHED THEN INSERT ...
```

**Benefits:**
- Single atomic operation
- Better performance than INSERT + UPDATE
- Handles complex upsert logic
- SQL standard compliant

### ON CONFLICT (PostgreSQL 9.5+)
```sql
INSERT INTO table (columns)
VALUES (values)
ON CONFLICT (unique_column)
DO UPDATE SET ...
```

**Benefits:**
- Simpler syntax for basic upserts
- Works on older PostgreSQL versions
- Efficient for single-record operations

## 🎯 Use Cases

### 1. Channel Manager Integration
- **Problem**: Avoid duplicate bookings from Booking.com/Expedia
- **Solution**: `sync_channel_reservations()` with MERGE
- **Benefit**: Idempotent sync (can run multiple times safely)

### 2. Guest Profile Management
- **Problem**: Multiple profiles for same guest (same email)
- **Solution**: `upsert_guest()` with ON CONFLICT
- **Benefit**: Single guest profile per email

### 3. Rate Management
- **Problem**: Bulk rate updates for seasons/events
- **Solution**: `sync_rate_plans()` with MERGE
- **Benefit**: Efficient bulk operations, soft delete inactive rates

### 4. Analytics Pipeline
- **Problem**: Daily/monthly metric calculations
- **Solution**: `aggregate_daily_metrics()` with MERGE
- **Benefit**: Idempotent aggregations, recalculate if needed

## ⚠️ Important Notes

### For Developers
1. **MERGE requires PostgreSQL 15+** - Check version before using
2. **Use ON CONFLICT for compatibility** - Works on PostgreSQL 9.5+
3. **JSONB input format** - Follow examples for correct structure
4. **Idempotent operations** - Safe to run multiple times
5. **Tenant isolation** - All functions require tenant_id

### For DBAs
1. **Monitor performance** - MERGE can be slower than simple INSERT
2. **Index requirements** - Ensure unique constraints for ON CONFLICT
3. **Transaction handling** - MERGE is atomic per statement
4. **Error handling** - Functions use plpgsql with error handling

### For Admins
1. **Schedule analytics** - Run daily/monthly aggregations via cron
2. **Channel sync frequency** - Sync every 15-30 minutes
3. **Rate updates** - Batch rate changes during off-peak hours
4. **Guest deduplication** - Run merge_duplicate_guests() periodically

## 📊 Performance Considerations

### MERGE vs INSERT + UPDATE
```
MERGE:
✅ Single round-trip to database
✅ Atomic operation
✅ Better for bulk operations (1000+ rows)
❌ Requires PostgreSQL 15+
❌ Slightly slower for single rows

ON CONFLICT:
✅ Works on PostgreSQL 9.5+
✅ Faster for single rows
✅ Simpler syntax
❌ Limited to INSERT-based upserts
❌ Can't handle complex match conditions
```

### Optimization Tips
1. **Index match columns** - MERGE/ON CONFLICT performance depends on indexes
2. **Batch operations** - Use JSONB arrays for bulk operations
3. **Avoid N+1 queries** - Pass all data in single function call
4. **Use prepared statements** - Cache query plans in application

## 🔄 Cron Job Examples

```bash
# Daily analytics aggregation (run at 1 AM)
0 1 * * * psql -U postgres -d tartware -c "SELECT aggregate_daily_metrics('tenant-id'::UUID, NULL, CURRENT_DATE - 1);"

# Monthly analytics rollup (run on 1st of month at 2 AM)
0 2 1 * * psql -U postgres -d tartware -c "SELECT aggregate_monthly_metrics('tenant-id'::UUID, NULL, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')::INTEGER);"

# Guest deduplication (run weekly on Sunday at 3 AM)
0 3 * * 0 psql -U postgres -d tartware -c "SELECT merge_duplicate_guests('tenant-id'::UUID, FALSE);"

# Channel availability sync (run every 15 minutes)
*/15 * * * * /path/to/channel_sync_script.sh
```

## 📖 Related Documentation

- **[SOFT_DELETE_POLICY.md](../SOFT_DELETE_POLICY.md)** - Soft delete implementation
- **[constraints/README.md](../constraints/README.md)** - Foreign key constraints
- **[indexes/README.md](../indexes/README.md)** - Index definitions

## 🐛 Troubleshooting

### MERGE not available
```
ERROR: syntax error at or near "MERGE"
```
**Solution**: Upgrade to PostgreSQL 15+ or use ON CONFLICT alternative

### ON CONFLICT fails
```
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```
**Solution**: Add unique constraint or index on conflict columns

### Performance issues
**Solution**:
1. Check indexes on match columns
2. Use EXPLAIN ANALYZE to identify bottlenecks
3. Batch operations in smaller chunks

---

**Last Updated**: 2025-10-15
**Phase**: 2C - Stored Procedures
**Status**: ✅ Complete - 14 procedures/functions created
**PostgreSQL Version**: 15+ required for MERGE, 9.5+ for ON CONFLICT
