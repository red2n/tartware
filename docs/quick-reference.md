# Industry Standards Quick Reference

**Quick lookup for developers implementing PMS features**

---

## 🏗️ Multi-Tenant Architecture

### Pattern: Shared Database, Row-Level Isolation

```
✅ CORRECT                          ❌ WRONG
────────────────────────────────    ──────────────────────
WHERE tenant_id = :tenant_id        WHERE id = :property_id
  AND property_id = :id             (Missing tenant_id!)
```

### Tenant → Properties → Rooms Hierarchy

```
Marriott International (Tenant)
  └─ Marriott Boston (Property)
      └─ Room 101, 102, ... (Rooms)
```

**Every table must have**: `tenant_id UUID NOT NULL REFERENCES tenants(id)`

---

## 📊 Standard Tables (22 Total)

### Core Multi-Tenancy (3)
- `tenants` - Organizations/chains
- `users` - System users
- `user_tenant_associations` - Many-to-many with roles

### Property Management (6)
- `properties` - Individual hotels
- `room_types` - Categories (Deluxe, Suite)
- `rooms` - Physical inventory
- `rates` - Pricing strategies
- `availability.room_availability` - Real-time inventory
- `channel_mappings` - OTA integrations

### Reservations (3)
- `guests` - Customer profiles
- `reservations` - Bookings
- `reservation_status_history` - Audit trail

### Financial (4)
- `payments` - Transactions
- `invoices` - Billing
- `invoice_items` - Line items
- `services` - Hotel services

### Operations (3)
- `housekeeping_tasks` - Cleaning
- `analytics_metrics` - KPIs
- `analytics_reports` - BI

---

## 🔑 Standard ENUM Types (20)

### Status Types
```sql
tenant_status: TRIAL | ACTIVE | SUSPENDED | INACTIVE | CANCELLED
reservation_status: PENDING | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED | NO_SHOW
payment_status: PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED | REFUNDED
room_status: AVAILABLE | OCCUPIED | DIRTY | CLEAN | INSPECTED | OUT_OF_ORDER
```

### Strategy Types
```sql
rate_strategy: FIXED | DYNAMIC | SEASONAL | WEEKEND | LASTMINUTE | EARLYBIRD
reservation_source: DIRECT | WEBSITE | PHONE | WALKIN | OTA | CORPORATE | GROUP
```

### Classification
```sql
tenant_type: INDEPENDENT | CHAIN | FRANCHISE | MANAGEMENT_COMPANY
tenant_role: OWNER | ADMIN | MANAGER | STAFF | VIEWER
```

---

## 💡 Standard Query Patterns

### Get Properties for Tenant
```sql
SELECT * FROM properties
WHERE tenant_id = :tenant_id
  AND deleted_at IS NULL
ORDER BY name;
```

### Search Available Rooms
```sql
SELECT rt.*, ra.available_rooms
FROM room_types rt
JOIN availability.room_availability ra ON ra.room_type_id = rt.id
WHERE rt.tenant_id = :tenant_id
  AND rt.property_id = :property_id
  AND ra.date BETWEEN :check_in AND :check_out
  AND ra.available_rooms > 0
  AND rt.is_active = true
  AND rt.deleted_at IS NULL;
```

### Get Guest Reservations
```sql
SELECT r.*, p.name as property_name, rt.name as room_type_name
FROM reservations r
JOIN properties p ON r.property_id = p.id
JOIN room_types rt ON r.room_type_id = rt.id
WHERE r.tenant_id = :tenant_id
  AND r.guest_id = :guest_id
  AND r.status IN ('CONFIRMED', 'CHECKED_IN')
ORDER BY r.check_in_date DESC;
```

### Calculate Occupancy Rate
```sql
SELECT
    date,
    (booked_rooms::float / total_rooms::float * 100) as occupancy_rate
FROM availability.room_availability
WHERE tenant_id = :tenant_id
  AND property_id = :property_id
  AND date BETWEEN :start_date AND :end_date
ORDER BY date;
```

---

## 📈 Standard KPIs

### Occupancy Rate
```
Formula: (Rooms Sold / Rooms Available) × 100
Industry Average: 60-70%
```

### ADR (Average Daily Rate)
```
Formula: Total Room Revenue / Rooms Sold
Industry Average: $100-300 (varies by market)
```

### RevPAR (Revenue Per Available Room)
```
Formula: Total Room Revenue / Rooms Available
Alternative: ADR × Occupancy Rate
Industry Average: $60-200
```

### Cancellation Rate
```
Formula: (Cancelled Reservations / Total Reservations) × 100
Industry Average: 10-40%
```

---

## 🔐 Security Checklist

### ✅ Required for Every Query
- [ ] Filter by `tenant_id`
- [ ] Check `deleted_at IS NULL` (soft deletes)
- [ ] Use parameterized queries (prevent SQL injection)
- [ ] Validate user has access to tenant
- [ ] Log audit trail for write operations

### ❌ Never Do This
```sql
-- ❌ Missing tenant_id
SELECT * FROM reservations WHERE id = :id;

-- ❌ String interpolation (SQL injection!)
query = f"SELECT * FROM users WHERE username = '{username}'";

-- ❌ Returning all tenants' data
SELECT * FROM properties WHERE is_active = true;
```

---

## 🌐 Industry Provider Comparison

| Feature | Oracle OPERA | Cloudbeds | Protel | RMS Cloud | Tartware |
|---------|--------------|-----------|--------|-----------|----------|
| Multi-tenant | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-property | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cloud-native | ✅ | ✅ | ✅ | ✅ | ✅ |
| Real-time availability | ✅ | ✅ | ✅ | ✅ | ✅ |
| Channel manager | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dynamic pricing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analytics/KPIs | ✅ | ✅ | ✅ | ✅ | ✅ |
| GDPR compliant | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 📱 API Patterns (RESTful)

### Standard Endpoints
```
# Tenants
GET    /api/v1/tenants/:tenantId

# Properties
GET    /api/v1/tenants/:tenantId/properties
GET    /api/v1/tenants/:tenantId/properties/:propertyId
POST   /api/v1/tenants/:tenantId/properties
PUT    /api/v1/tenants/:tenantId/properties/:propertyId
DELETE /api/v1/tenants/:tenantId/properties/:propertyId

# Reservations
GET    /api/v1/tenants/:tenantId/reservations
POST   /api/v1/tenants/:tenantId/reservations
GET    /api/v1/tenants/:tenantId/reservations/:reservationId
PUT    /api/v1/tenants/:tenantId/reservations/:reservationId
DELETE /api/v1/tenants/:tenantId/reservations/:reservationId

# Availability
GET    /api/v1/tenants/:tenantId/availability?property_id=X&start_date=Y&end_date=Z
POST   /api/v1/tenants/:tenantId/availability/search
```

---

## 🎯 Common Use Cases

### 1. Create New Reservation
```sql
BEGIN;
  -- Insert reservation
  INSERT INTO reservations (
    tenant_id, property_id, guest_id, room_type_id,
    check_in_date, check_out_date, status
  ) VALUES (...) RETURNING id;

  -- Update availability
  UPDATE availability.room_availability
  SET available_rooms = available_rooms - 1,
      booked_rooms = booked_rooms + 1
  WHERE tenant_id = :tenant_id
    AND property_id = :property_id
    AND room_type_id = :room_type_id
    AND date BETWEEN :check_in AND :check_out;
COMMIT;
```

### 2. Check-in Guest
```sql
UPDATE reservations
SET status = 'CHECKED_IN',
    checked_in_at = CURRENT_TIMESTAMP,
    room_id = :assigned_room_id,
    updated_by = :user_id
WHERE id = :reservation_id
  AND tenant_id = :tenant_id
  AND status = 'CONFIRMED';

-- Log status change
INSERT INTO reservation_status_history (
  reservation_id, tenant_id,
  old_status, new_status, changed_by
) VALUES (
  :reservation_id, :tenant_id,
  'CONFIRMED', 'CHECKED_IN', :user_id
);
```

### 3. Process Payment
```sql
INSERT INTO payments (
  tenant_id, reservation_id,
  amount, currency, method, status, transaction_type
) VALUES (
  :tenant_id, :reservation_id,
  :amount, 'USD', 'CREDIT_CARD', 'COMPLETED', 'CHARGE'
);

-- Update reservation paid amount
UPDATE reservations
SET paid_amount = paid_amount + :amount,
    balance_due = total_amount - (paid_amount + :amount)
WHERE id = :reservation_id
  AND tenant_id = :tenant_id;
```

---

## 📊 JSONB Usage Patterns

### Property Metadata
```sql
-- Store flexible configuration
UPDATE properties
SET metadata = '{
  "brand": "Marriott Hotels",
  "amenities": ["WiFi", "Pool", "Gym"],
  "checkInTime": "15:00",
  "checkOutTime": "11:00",
  "policies": {
    "cancellation": "24h",
    "pets": "allowed"
  }
}'::jsonb
WHERE id = :property_id;

-- Query JSONB
SELECT * FROM properties
WHERE metadata->>'brand' = 'Marriott Hotels'
  AND metadata->'amenities' ? 'Pool';
```

---

## 🔧 Performance Optimization

### Critical Indexes
```sql
-- Tenant isolation (ALL tables)
CREATE INDEX idx_table_tenant ON table_name(tenant_id);

-- Lookup indexes
CREATE INDEX idx_reservations_confirmation ON reservations(confirmation_number);
CREATE INDEX idx_reservations_dates ON reservations(check_in_date, check_out_date);

-- Composite indexes
CREATE INDEX idx_availability_lookup
ON availability.room_availability(tenant_id, property_id, date);
```

### Query Optimization
```sql
-- ✅ Good: Uses index
EXPLAIN ANALYZE
SELECT * FROM reservations
WHERE tenant_id = :tenant_id
  AND status = 'CONFIRMED';

-- Check for: Index Scan (good) vs Seq Scan (bad)
```

---

## 📚 Related Documentation

- [Industry Standards (Full)](industry-standards.md)
- [Database Architecture](database-architecture.md)
- [Multi-Tenancy Guide](multi-tenancy.md)

---

**Quick Reference Version**: 1.0.0
**Print/PDF**: Optimized for quick lookup
**Last Updated**: October 15, 2025
