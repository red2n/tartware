# Sample Data Insertion Guide for TARTWARE

## Quick Start Commands

### Connect to Database
```bash
docker exec -it tartware-postgres psql -U postgres -d tartware
```

---

## Data Insertion Order (Must Follow for Foreign Key Constraints)

### Level 1: Foundation Tables (No Dependencies)
```sql
-- 1. Create tenants first (root of multi-tenant architecture)
INSERT INTO tenants (id, tenant_name, tenant_type, tenant_status, ...) VALUES ...;

-- 2. Create users
INSERT INTO users (id, email, first_name, last_name, ...) VALUES ...;

-- 3. Create alert rules
INSERT INTO alert_rules (rule_id, rule_name, ...) VALUES ...;
```

### Level 2: Tenant-Owned Tables
```sql
-- 4. Create properties (requires tenant_id)
INSERT INTO properties (id, tenant_id, property_name, ...) VALUES ...;

-- 5. Create guests (requires tenant_id)
INSERT INTO guests (id, tenant_id, first_name, last_name, email, ...) VALUES ...;

-- 6. Create booking sources (requires tenant_id, property_id)
INSERT INTO booking_sources (source_id, tenant_id, property_id, ...) VALUES ...;

-- 7. Create market segments (requires tenant_id, property_id)
INSERT INTO market_segments (segment_id, tenant_id, property_id, ...) VALUES ...;

-- 8. Link users to tenants
INSERT INTO user_tenant_associations (id, user_id, tenant_id, role, ...) VALUES ...;
```

### Level 3: Property Configuration
```sql
-- 9. Create room types (requires tenant_id, property_id)
INSERT INTO room_types (id, tenant_id, property_id, type_name, base_occupancy, ...) VALUES ...;

-- 10. Create services (requires tenant_id, property_id)
INSERT INTO services (id, tenant_id, property_id, service_name, ...) VALUES ...;

-- 11. Create business dates (requires tenant_id, property_id)
INSERT INTO business_dates (business_date_id, tenant_id, property_id, business_date, ...) VALUES ...;
```

### Level 4: Inventory & Pricing
```sql
-- 12. Create rooms (requires tenant_id, property_id, room_type_id)
INSERT INTO rooms (id, tenant_id, property_id, room_type_id, room_number, ...) VALUES ...;

-- 13. Create rate plans (requires tenant_id, property_id, room_type_id)
INSERT INTO rates (id, tenant_id, property_id, room_type_id, rate_name, rate_amount, ...) VALUES ...;

-- 14. Create room availability (requires tenant_id, property_id, room_type_id)
INSERT INTO availability.room_availability (id, tenant_id, property_id, room_type_id, date, ...) VALUES ...;

-- 15. Create channel mappings (requires tenant_id, property_id)
INSERT INTO channel_mappings (id, tenant_id, property_id, channel_name, ...) VALUES ...;
```

### Level 5: Reservations & Folios
```sql
-- 16. Create reservations (requires tenant_id, property_id, guest_id, room_type_id, rate_id)
INSERT INTO reservations (id, tenant_id, property_id, guest_id, room_type_id, rate_id, ...) VALUES ...;

-- 17. Create folios (requires tenant_id, property_id, reservation_id, guest_id)
INSERT INTO folios (folio_id, tenant_id, property_id, reservation_id, guest_id, ...) VALUES ...;

-- 18. Create housekeeping tasks (requires tenant_id, property_id)
INSERT INTO housekeeping_tasks (id, tenant_id, property_id, room_number, ...) VALUES ...;

-- 19. Create allotments (requires tenant_id, property_id, room_type_id)
INSERT INTO allotments (allotment_id, tenant_id, property_id, room_type_id, ...) VALUES ...;
```

### Level 6: Financial Transactions
```sql
-- 20. Create payments (requires tenant_id, property_id, reservation_id, guest_id)
INSERT INTO payments (id, tenant_id, property_id, reservation_id, guest_id, amount, ...) VALUES ...;

-- 21. Create invoices (requires tenant_id, property_id, reservation_id, guest_id)
INSERT INTO invoices (id, tenant_id, property_id, reservation_id, guest_id, ...) VALUES ...;

-- 22. Create reservation services (requires tenant_id, reservation_id, service_id)
INSERT INTO reservation_services (id, tenant_id, reservation_id, service_id, ...) VALUES ...;

-- 23. Create maintenance requests (requires tenant_id, property_id)
INSERT INTO maintenance_requests (request_id, tenant_id, property_id, ...) VALUES ...;

-- 24. Create deposit schedules (requires tenant_id, property_id, reservation_id, guest_id)
INSERT INTO deposit_schedules (schedule_id, tenant_id, property_id, reservation_id, guest_id, ...) VALUES ...;

-- 25. Create guest preferences (requires tenant_id, property_id, guest_id)
INSERT INTO guest_preferences (preference_id, tenant_id, property_id, guest_id, ...) VALUES ...;
```

### Level 7: Detailed Financial Records
```sql
-- 26. Create invoice items (requires tenant_id, invoice_id)
INSERT INTO invoice_items (id, tenant_id, invoice_id, description, amount, ...) VALUES ...;

-- 27. Create charge postings (requires tenant_id, property_id, folio_id)
INSERT INTO charge_postings (posting_id, tenant_id, property_id, folio_id, ...) VALUES ...;

-- 28. Create refunds (requires tenant_id, property_id, reservation_id, guest_id)
INSERT INTO refunds (refund_id, tenant_id, property_id, reservation_id, guest_id, ...) VALUES ...;

-- 29. Create rate overrides (requires tenant_id, property_id, reservation_id, room_type_id, rate_id)
INSERT INTO rate_overrides (override_id, tenant_id, property_id, reservation_id, room_type_id, rate_id, ...) VALUES ...;
```

### Level 8: Analytics & Audit
```sql
-- 30. Create analytics metrics (requires tenant_id, property_id)
INSERT INTO analytics_metrics (id, tenant_id, property_id, metric_type, metric_value, ...) VALUES ...;

-- 31. Create analytics reports (requires tenant_id, created_by_user_id)
INSERT INTO analytics_reports (id, tenant_id, created_by_user_id, report_name, ...) VALUES ...;

-- 32. Create audit logs (requires tenant_id, property_id, user_id)
INSERT INTO audit_logs (audit_id, tenant_id, property_id, user_id, event_type, ...) VALUES ...;

-- 33. Create night audit log (requires tenant_id, property_id)
INSERT INTO night_audit_log (audit_log_id, tenant_id, property_id, ...) VALUES ...;

-- 34. Create reservation status history (requires tenant_id, reservation_id)
INSERT INTO reservation_status_history (id, tenant_id, reservation_id, old_status, new_status, ...) VALUES ...;
```

---

## Sample Data Script Template

```sql
-- ============================================
-- TARTWARE Sample Data Insertion
-- ============================================

BEGIN;

-- 1. Create Master Tenant
INSERT INTO tenants (id, tenant_name, tenant_type, tenant_status, contact_email, timezone)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Demo Hotel Group', 'PROPERTY_MANAGEMENT', 'ACTIVE', 'admin@demohotel.com', 'America/New_York');

-- 2. Create Users
INSERT INTO users (id, email, first_name, last_name, is_active)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'admin@demohotel.com', 'John', 'Admin', true),
  ('22222222-2222-2222-2222-222222222223', 'manager@demohotel.com', 'Jane', 'Manager', true);

-- 3. Create Property
INSERT INTO properties (id, tenant_id, property_name, property_code, address, city, state, country, phone, email)
VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Grand Plaza Hotel', 'GPH001',
   '123 Main Street', 'New York', 'NY', 'USA', '+1-555-0100', 'info@grandplaza.com');

-- 4. Create Room Types
INSERT INTO room_types (id, tenant_id, property_id, type_name, type_code, category, base_occupancy, max_occupancy, base_rate)
VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Standard King', 'STD-K', 'STANDARD', 2, 2, 150.00),
  ('44444444-4444-4444-4444-444444444445', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Deluxe Queen', 'DLX-Q', 'DELUXE', 2, 3, 200.00);

-- 5. Create Rooms
INSERT INTO rooms (id, tenant_id, property_id, room_type_id, room_number, floor, status)
VALUES
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444', '101', 1, 'CLEAN'),
  ('55555555-5555-5555-5555-555555555556', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444445', '201', 2, 'CLEAN');

-- 6. Create Rate Plans
INSERT INTO rates (id, tenant_id, property_id, room_type_id, rate_name, rate_code, rate_amount, status)
VALUES
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444', 'Standard Rate', 'STD', 150.00, 'ACTIVE');

-- 7. Create Guests
INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone)
VALUES
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111',
   'Alice', 'Johnson', 'alice.johnson@email.com', '+1-555-0200'),
  ('77777777-7777-7777-7777-777777777778', '11111111-1111-1111-1111-111111111111',
   'Bob', 'Smith', 'bob.smith@email.com', '+1-555-0201');

-- 8. Create Reservations
INSERT INTO reservations (id, tenant_id, property_id, guest_id, room_type_id, rate_id,
                         confirmation_number, check_in_date, check_out_date, adults, status, total_amount)
VALUES
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777',
   '44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666',
   'RES-2025-001', '2025-10-20', '2025-10-22', 2, 'CONFIRMED', 300.00);

-- 9. Create Payments
INSERT INTO payments (id, tenant_id, property_id, reservation_id, guest_id,
                     payment_method, amount, status)
VALUES
  ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888',
   '77777777-7777-7777-7777-777777777777', 'CREDIT_CARD', 300.00, 'COMPLETED');

COMMIT;

\echo '✅ Sample data inserted successfully!'
```

---

## Verification Queries

```sql
-- Check tenant and properties
SELECT t.tenant_name, COUNT(p.id) as property_count
FROM tenants t
LEFT JOIN properties p ON p.tenant_id = t.id
GROUP BY t.id, t.tenant_name;

-- Check rooms by property
SELECT p.property_name, rt.type_name, COUNT(r.id) as room_count
FROM properties p
JOIN room_types rt ON rt.property_id = p.id
JOIN rooms r ON r.room_type_id = rt.id
GROUP BY p.id, p.property_name, rt.id, rt.type_name;

-- Check reservations
SELECT r.confirmation_number, g.first_name, g.last_name,
       r.check_in_date, r.check_out_date, r.status, r.total_amount
FROM reservations r
JOIN guests g ON g.id = r.guest_id
ORDER BY r.check_in_date DESC;

-- Check payments
SELECT p.payment_date, g.first_name, g.last_name,
       p.amount, p.payment_method, p.status
FROM payments p
JOIN guests g ON g.id = p.guest_id
ORDER BY p.payment_date DESC;
```

---

## Tips for Sample Data

1. **Use Sequential UUIDs** for easy reference (like in the template)
2. **Start with one tenant** and build out completely
3. **Create realistic dates** (past, current, future reservations)
4. **Include various statuses** (confirmed, checked-in, checked-out, cancelled)
5. **Test edge cases** (overlapping reservations, refunds, maintenance)
6. **Add JSONB metadata** for flexibility
7. **Use meaningful names** for easy identification
8. **Keep data consistent** within a tenant/property

---

## Common ENUM Values to Use

```sql
-- tenant_status
'ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL', 'PENDING'

-- reservation_status
'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'

-- room_status
'CLEAN', 'DIRTY', 'INSPECTED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE', 'PICKUP', 'DO_NOT_DISTURB'

-- payment_status
'PENDING', 'AUTHORIZED', 'CAPTURED', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'

-- payment_method
'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'CHECK', 'BANK_TRANSFER', 'DIGITAL_WALLET', 'OTHER'

-- rate_status
'ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED'

-- room_category
'STANDARD', 'DELUXE', 'SUITE', 'EXECUTIVE', 'PRESIDENTIAL'
```

---

## Ready for Tomorrow! 🚀

Database is fully initialized with all constraints and indexes. You can start inserting sample data following the order above!
