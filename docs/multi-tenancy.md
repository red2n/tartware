# Multi-Tenancy Design Pattern

**Enterprise Multi-Tenant Architecture for Hotel Chains**

Version: 1.0.0
Last Updated: October 15, 2025

---

## 🎯 Overview

Tartware PMS implements a **shared database, shared schema** multi-tenancy pattern with **row-level tenant isolation**. This approach is used by Oracle OPERA Cloud, Cloudbeds, and other enterprise PMS providers to support hotel chains, franchises, and management companies at scale.

---

## 🏗️ Multi-Tenancy Models Comparison

### 1. Separate Database per Tenant
```
Tenant A → Database A
Tenant B → Database B
Tenant C → Database C
```

**Pros**: Maximum isolation, custom schemas
**Cons**: High cost, complex management, difficult cross-tenant analytics
**Used by**: Small SaaS apps (<100 tenants)

### 2. Separate Schema per Tenant
```
Database
├── Schema_TenantA
├── Schema_TenantB
└── Schema_TenantC
```

**Pros**: Good isolation, schema customization
**Cons**: Management overhead, resource waste
**Used by**: Medium SaaS apps (100-1000 tenants)

### 3. Shared Schema with Row-Level Isolation ⭐
```
Database
└── Schema (public)
    ├── tenants (tenant_id: A, B, C)
    ├── properties (tenant_id: A, A, B, C)
    └── reservations (tenant_id: A, A, A, B, C, C)
```

**Pros**: Efficient, scalable, cost-effective, easy analytics
**Cons**: Requires strict application-level filtering
**Used by**: Enterprise SaaS (1000+ tenants) ✅ **Tartware PMS**

---

## 🏨 Real-World Example: Marriott International

### Tenant Structure

```
Marriott International (Tenant)
├── Brand: Marriott Hotels
│   ├── Marriott Boston Downtown (Property)
│   ├── Marriott New York Times Square (Property)
│   └── Marriott London Park Lane (Property)
├── Brand: Courtyard
│   ├── Courtyard Boston Cambridge (Property)
│   └── Courtyard San Francisco (Property)
├── Brand: Residence Inn
│   ├── Residence Inn Seattle (Property)
│   └── Residence Inn Denver (Property)
└── Brand: Ritz-Carlton
    ├── Ritz-Carlton Boston (Property)
    └── Ritz-Carlton Dubai (Property)
```

### Database Implementation

```sql
-- Tenant Record
INSERT INTO tenants VALUES (
    'marriott-intl-uuid',
    'Marriott International',
    'marriott-international',
    'CHAIN',
    'ACTIVE'
);

-- Properties under Marriott
INSERT INTO properties VALUES
    ('prop-1', 'marriott-intl-uuid', 'Marriott Boston Downtown', 'MBD001', 'Marriott Hotels'),
    ('prop-2', 'marriott-intl-uuid', 'Courtyard Boston Cambridge', 'CBC001', 'Courtyard'),
    ('prop-3', 'marriott-intl-uuid', 'Ritz-Carlton Boston', 'RCB001', 'Ritz-Carlton');

-- Reservations (tenant-isolated)
INSERT INTO reservations VALUES
    ('res-1', 'marriott-intl-uuid', 'prop-1', ...),  -- Marriott Boston
    ('res-2', 'marriott-intl-uuid', 'prop-2', ...),  -- Courtyard Cambridge
    ('res-3', 'marriott-intl-uuid', 'prop-3', ...);  -- Ritz Boston
```

**Key Point**: Single tenant record, multiple properties, complete data isolation from other tenants (Hilton, Hyatt, etc.).

---

## 🔐 Tenant Isolation Strategy

### 1. Mandatory tenant_id Column

**Every table includes tenant_id**:

```sql
-- Core tenant table
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    -- ... other columns
);

-- All dependent tables have tenant_id FK
CREATE TABLE properties (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- ... other columns
);

CREATE TABLE reservations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id),
    -- ... other columns
);

CREATE TABLE payments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations(id),
    -- ... other columns
);
```

**Tartware Implementation**: ✅ All 22 tables include `tenant_id`

### 2. Application-Level Filtering

**Every query MUST filter by tenant_id**:

```sql
-- ✅ CORRECT: Tenant-scoped query
SELECT * FROM reservations
WHERE tenant_id = :current_tenant_id
  AND status = 'CONFIRMED';

-- ❌ WRONG: Security vulnerability!
SELECT * FROM reservations
WHERE status = 'CONFIRMED';  -- Returns data from ALL tenants!
```

### 3. Database-Level Security (Optional Enhancement)

**PostgreSQL Row-Level Security (RLS)**:

```sql
-- Enable RLS on table
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Create policy (application sets current tenant)
CREATE POLICY tenant_isolation_policy ON reservations
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Set tenant context in session
SET app.current_tenant_id = 'marriott-intl-uuid';

-- Queries automatically filtered
SELECT * FROM reservations;  -- Only returns Marriott data
```

**Status**: 🟡 Optional (can be implemented later for additional security layer)

---

## 👥 User Management Across Tenants

### Many-to-Many Relationship

Users can access **multiple tenants** with **different roles**:

```
User: john@example.com
├── Marriott International (ADMIN)
├── Hilton Worldwide (VIEWER)
└── Independent Hotel Corp (OWNER)
```

### Database Design

```sql
-- Users table (global, no tenant_id)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    -- ... other columns
);

-- User-Tenant associations (many-to-many)
CREATE TABLE user_tenant_associations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Role-based access control
    role tenant_role NOT NULL,  -- OWNER, ADMIN, MANAGER, STAFF, VIEWER
    permissions TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_primary BOOLEAN NOT NULL DEFAULT false,  -- Default tenant for login

    -- Lifecycle
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,  -- Temporary access
    last_accessed_at TIMESTAMP,

    -- Constraints
    UNIQUE(user_id, tenant_id)
);
```

### User Login Flow

```python
# 1. User authenticates
user = authenticate(username, password)

# 2. Get user's tenant associations
tenants = db.query("""
    SELECT t.id, t.name, uta.role, uta.is_primary
    FROM user_tenant_associations uta
    JOIN tenants t ON uta.tenant_id = t.id
    WHERE uta.user_id = :user_id
      AND uta.is_active = true
      AND (uta.expires_at IS NULL OR uta.expires_at > NOW())
    ORDER BY uta.is_primary DESC, t.name
""", user_id=user.id)

# 3. Set default tenant (or let user choose)
current_tenant = tenants[0] if tenants else None

# 4. Store in session
session['user_id'] = user.id
session['tenant_id'] = current_tenant.id
session['tenant_role'] = current_tenant.role

# 5. All subsequent queries use session tenant_id
```

### Role-Based Access Control

```sql
-- Role hierarchy
CREATE TYPE tenant_role AS ENUM (
    'OWNER',    -- Full access, billing, delete tenant
    'ADMIN',    -- All operations, no billing
    'MANAGER',  -- Property management, reports
    'STAFF',    -- Daily operations, reservations
    'VIEWER'    -- Read-only access
);

-- Check permissions
SELECT * FROM user_tenant_associations
WHERE user_id = :user_id
  AND tenant_id = :tenant_id
  AND role IN ('OWNER', 'ADMIN')
  AND is_active = true;
```

**Role Capabilities**:

| Role | Properties | Reservations | Payments | Reports | Settings | Billing |
|------|-----------|--------------|----------|---------|----------|---------|
| OWNER | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ Full | ✅ Full | ✅ Full |
| ADMIN | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ Full | ✅ Most | ❌ View Only |
| MANAGER | ✅ Update | ✅ CRUD | ✅ View | ✅ Property | ✅ Limited | ❌ No Access |
| STAFF | ✅ View | ✅ Create/Update | ❌ No | ✅ Basic | ❌ No | ❌ No Access |
| VIEWER | ✅ View | ✅ View | ❌ No | ✅ View | ❌ No | ❌ No Access |

---

## 🏢 Tenant Types

### Tenant Classification

```sql
CREATE TYPE tenant_type AS ENUM (
    'INDEPENDENT',        -- Single property owner
    'CHAIN',             -- Hotel chain (Marriott, Hilton)
    'FRANCHISE',         -- Franchise operator
    'MANAGEMENT_COMPANY' -- Third-party management
);
```

### Type Characteristics

#### 1. INDEPENDENT
**Example**: Boutique Hotel Boston
- **Properties**: 1 property
- **Staff**: Small team (5-20 users)
- **Features**: Basic PMS, direct bookings
- **Billing**: Monthly subscription

```sql
INSERT INTO tenants VALUES (
    gen_random_uuid(),
    'Boutique Hotel Boston',
    'boutique-boston',
    'INDEPENDENT',
    'ACTIVE',
    'owner@boutiquehotel.com',
    ...
);
```

#### 2. CHAIN
**Example**: Marriott International
- **Properties**: 100-8,000+ properties
- **Staff**: Large organization (100-10,000+ users)
- **Features**: Full PMS, channel management, advanced analytics
- **Billing**: Enterprise contract

```sql
INSERT INTO tenants VALUES (
    gen_random_uuid(),
    'Marriott International',
    'marriott-international',
    'CHAIN',
    'ACTIVE',
    'it@marriott.com',
    ...
);
```

#### 3. FRANCHISE
**Example**: Marriott Franchise Operator XYZ
- **Properties**: 5-50 properties
- **Staff**: Mid-sized team (20-100 users)
- **Features**: Standard PMS, brand integration
- **Billing**: Per-property pricing

```sql
INSERT INTO tenants VALUES (
    gen_random_uuid(),
    'XYZ Hotel Group (Marriott Franchise)',
    'xyz-marriott-franchise',
    'FRANCHISE',
    'ACTIVE',
    'operations@xyzhotels.com',
    ...
);
```

#### 4. MANAGEMENT_COMPANY
**Example**: Hotel Management Associates
- **Properties**: 10-200 properties (managing for owners)
- **Staff**: Management team (50-500 users)
- **Features**: Multi-property dashboard, owner reporting
- **Billing**: Hybrid model

```sql
INSERT INTO tenants VALUES (
    gen_random_uuid(),
    'Hotel Management Associates',
    'hma-management',
    'MANAGEMENT_COMPANY',
    'ACTIVE',
    'info@hmahotels.com',
    ...
);
```

---

## 📊 Tenant Configuration

### Flexible JSONB Configuration

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,

    -- Flexible configuration (no schema changes needed)
    config JSONB NOT NULL DEFAULT '{
        "brandingEnabled": true,
        "enableMultiProperty": true,
        "enableChannelManager": false,
        "enableAdvancedReporting": false,
        "enablePaymentProcessing": true,
        "enableLoyaltyProgram": false,
        "maxProperties": 5,
        "maxUsers": 10,
        "defaultCurrency": "USD",
        "defaultLanguage": "en",
        "defaultTimezone": "UTC",
        "features": [
            "reservations",
            "payments",
            "housekeeping",
            "analytics"
        ],
        "integrations": {
            "booking.com": false,
            "expedia": false,
            "stripe": true
        }
    }'::jsonb,

    -- Subscription information
    subscription JSONB NOT NULL DEFAULT '{
        "plan": "FREE",
        "startDate": null,
        "endDate": null,
        "trialEndDate": null,
        "billingCycle": "MONTHLY",
        "amount": 0,
        "currency": "USD",
        "features": ["basic"]
    }'::jsonb
);
```

### Configuration Queries

```sql
-- Check if tenant has feature enabled
SELECT config->'enableChannelManager' as channel_enabled
FROM tenants
WHERE id = :tenant_id;

-- Update tenant configuration
UPDATE tenants
SET config = jsonb_set(
    config,
    '{enableChannelManager}',
    'true'::jsonb
)
WHERE id = :tenant_id;

-- Add new integration
UPDATE tenants
SET config = jsonb_set(
    config,
    '{integrations, airbnb}',
    'true'::jsonb
)
WHERE id = :tenant_id;
```

---

## 🔄 Tenant Lifecycle

### 1. Tenant Creation (Onboarding)

```sql
BEGIN;
    -- Create tenant
    INSERT INTO tenants (
        name, slug, type, status, email, config
    ) VALUES (
        'New Hotel Chain',
        'new-hotel-chain',
        'CHAIN',
        'TRIAL',
        'contact@newchain.com',
        '{...}'::jsonb
    ) RETURNING id INTO tenant_id;

    -- Create owner user
    INSERT INTO users (
        username, email, first_name, last_name, password_hash
    ) VALUES (
        'owner@newchain.com',
        'owner@newchain.com',
        'John',
        'Smith',
        'hashed_password'
    ) RETURNING id INTO user_id;

    -- Associate user as owner
    INSERT INTO user_tenant_associations (
        user_id, tenant_id, role, is_active, is_primary
    ) VALUES (
        user_id, tenant_id, 'OWNER', true, true
    );

    -- Create first property
    INSERT INTO properties (
        tenant_id, name, property_code
    ) VALUES (
        tenant_id, 'Headquarters Hotel', 'HQ001'
    );
COMMIT;
```

### 2. Tenant Status Transitions

```sql
CREATE TYPE tenant_status AS ENUM (
    'TRIAL',      -- Free trial period (14-30 days)
    'ACTIVE',     -- Paying customer
    'SUSPENDED',  -- Payment failed or violation
    'INACTIVE',   -- Voluntarily paused
    'CANCELLED'   -- Account closed
);

-- Trial → Active (after payment)
UPDATE tenants
SET status = 'ACTIVE',
    subscription = jsonb_set(subscription, '{plan}', '"PROFESSIONAL"'::jsonb)
WHERE id = :tenant_id AND status = 'TRIAL';

-- Active → Suspended (payment failure)
UPDATE tenants
SET status = 'SUSPENDED'
WHERE id = :tenant_id
  AND status = 'ACTIVE'
  AND (subscription->>'paymentStatus') = 'FAILED';

-- Suspended → Active (payment resolved)
UPDATE tenants
SET status = 'ACTIVE'
WHERE id = :tenant_id AND status = 'SUSPENDED';

-- Active → Cancelled (account closed)
UPDATE tenants
SET status = 'CANCELLED',
    deleted_at = CURRENT_TIMESTAMP,
    deleted_by = :user_id
WHERE id = :tenant_id AND status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE');
```

### 3. Tenant Data Export (GDPR)

```sql
-- Export all tenant data
SELECT
    'tenants' as table_name,
    json_agg(t.*) as data
FROM tenants t
WHERE t.id = :tenant_id

UNION ALL

SELECT
    'properties' as table_name,
    json_agg(p.*) as data
FROM properties p
WHERE p.tenant_id = :tenant_id

UNION ALL

SELECT
    'reservations' as table_name,
    json_agg(r.*) as data
FROM reservations r
WHERE r.tenant_id = :tenant_id;

-- ... repeat for all tables
```

### 4. Tenant Deletion (Soft)

```sql
-- Soft delete (recommended)
UPDATE tenants
SET deleted_at = CURRENT_TIMESTAMP,
    deleted_by = :admin_user_id,
    status = 'CANCELLED'
WHERE id = :tenant_id;

-- All child records cascade via ON DELETE CASCADE
-- But with soft deletes, they remain queryable for audit
```

---

## 📈 Cross-Tenant Analytics

### Aggregated Platform Metrics

```sql
-- Total properties across all tenants
SELECT COUNT(*) as total_properties
FROM properties
WHERE deleted_at IS NULL;

-- Tenant distribution by type
SELECT
    type,
    COUNT(*) as tenant_count,
    SUM((config->>'maxProperties')::int) as total_property_limit
FROM tenants
WHERE status = 'ACTIVE'
GROUP BY type;

-- Revenue by tenant
SELECT
    t.name as tenant_name,
    COUNT(DISTINCT p.id) as property_count,
    COUNT(r.id) as reservation_count,
    SUM(r.total_amount) as total_revenue
FROM tenants t
LEFT JOIN properties p ON p.tenant_id = t.id
LEFT JOIN reservations r ON r.tenant_id = t.id
WHERE t.status = 'ACTIVE'
  AND r.status IN ('CONFIRMED', 'CHECKED_OUT')
  AND r.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY t.id, t.name
ORDER BY total_revenue DESC;
```

**Important**: Cross-tenant queries should be limited to **platform administrators** only.

---

## 🛡️ Security Best Practices

### 1. Always Validate Tenant Context

```python
def get_property(property_id, tenant_id):
    """Securely fetch property with tenant validation"""
    property = db.query("""
        SELECT * FROM properties
        WHERE id = :property_id
          AND tenant_id = :tenant_id
          AND deleted_at IS NULL
    """, property_id=property_id, tenant_id=tenant_id)

    if not property:
        raise NotFoundError("Property not found")

    return property
```

### 2. Never Trust Client-Provided tenant_id

```python
# ❌ WRONG: Client provides tenant_id
tenant_id = request.json['tenant_id']  # Security vulnerability!

# ✅ CORRECT: Get from authenticated session
tenant_id = session['tenant_id']
```

### 3. Use Prepared Statements

```python
# ✅ CORRECT: Parameterized query
db.query("""
    SELECT * FROM reservations
    WHERE tenant_id = :tenant_id
      AND status = :status
""", tenant_id=tenant_id, status=status)

# ❌ WRONG: String interpolation (SQL injection risk)
db.query(f"""
    SELECT * FROM reservations
    WHERE tenant_id = '{tenant_id}'
""")
```

### 4. Implement Audit Logging

```python
def create_reservation(data, user_id, tenant_id):
    """Create reservation with audit trail"""
    reservation = db.execute("""
        INSERT INTO reservations (
            tenant_id, property_id, guest_id,
            ..., created_by
        ) VALUES (
            :tenant_id, :property_id, :guest_id,
            ..., :user_id
        ) RETURNING *
    """, **data, tenant_id=tenant_id, user_id=user_id)

    # Log action
    audit_log.info(
        f"Reservation created",
        user_id=user_id,
        tenant_id=tenant_id,
        reservation_id=reservation.id
    )

    return reservation
```

---

## 🔧 Troubleshooting

### Issue: User sees wrong tenant's data

**Diagnosis**:
```sql
-- Check session tenant_id
SELECT current_setting('app.current_tenant_id');

-- Verify user has access
SELECT * FROM user_tenant_associations
WHERE user_id = :user_id
  AND tenant_id = :tenant_id
  AND is_active = true;
```

**Solution**: Ensure session tenant_id is set correctly after login.

### Issue: Cross-tenant data leakage

**Diagnosis**:
```sql
-- Find queries missing tenant_id filter
-- Review application logs for queries without WHERE tenant_id = ?
```

**Solution**:
1. Implement Row-Level Security (RLS)
2. Add database triggers to validate tenant_id
3. Code review all queries

### Issue: Performance degradation

**Diagnosis**:
```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT * FROM reservations
WHERE tenant_id = :tenant_id
  AND status = 'CONFIRMED';

-- Look for sequential scans
```

**Solution**:
```sql
-- Ensure composite indexes exist
CREATE INDEX idx_reservations_tenant_status
ON reservations(tenant_id, status);
```

---

## 📚 Related Documentation

- [Industry Standards Compliance](industry-standards.md)
- [Database Architecture](database-architecture.md)
- [Security Best Practices](security.md)
- [User Management](user-management.md)

---

**Document Status**: Production
**Security Review**: Passed
**Last Updated**: October 15, 2025
