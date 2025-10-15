# Database Architecture

**Tartware PMS Database Design & Implementation**

Version: 1.0.0
Last Updated: October 15, 2025

---

## 🗄️ Overview

Tartware PMS uses **PostgreSQL 16** with a sophisticated multi-tenant architecture designed to support hotel chains, franchises, and independent properties at enterprise scale.

### Technology Stack

- **Database**: PostgreSQL 16
- **Extensions**: uuid-ossp
- **Architecture**: Multi-tenant with row-level isolation
- **Primary Keys**: UUID (universally unique identifiers)
- **JSON Storage**: JSONB for flexible configuration
- **Type Safety**: 20 custom ENUM types
- **Relationships**: Foreign keys with CASCADE/SET NULL

---

## 📊 Database Schema Overview

### Schema Organization

```
tartware (database)
├── public (schema)
│   ├── Multi-Tenancy Tables (3)
│   ├── Property Management Tables (6)
│   ├── Reservation Tables (3)
│   ├── Financial Tables (7) - folios, charge_postings, payments, invoices, invoice_items, refunds, deposit_schedules
│   ├── Operations Tables (6) - services, housekeeping_tasks, maintenance_requests, business_dates, night_audit_log, rate_overrides
│   ├── Revenue Management (5) - rates, allotments, booking_sources, market_segments, rate_overrides
│   ├── Guest Management (3) - guests, guest_preferences, reservation_services
│   ├── Analytics Tables (3)
│   └── System Monitoring (6) - performance_reports, report_schedules, performance_thresholds, performance_baselines, performance_alerts, alert_rules
└── availability (schema)
    └── Real-time Availability (1)
```

### Statistics

| Metric | Count |
|--------|-------|
| **Total Tables** | 37 |
| **ENUM Types** | 30+ |
| **Foreign Keys** | 150+ |
| **Indexes** | 350+ |
| **Schemas** | 2 (public, availability) |

---

## 🏗️ Entity Relationship Diagram

```
┌─────────────┐
│   TENANTS   │ (Root Entity)
└──────┬──────┘
       │
       ├──────────────────────────────────────────┐
       │                                          │
       ▼                                          ▼
┌─────────────┐                          ┌─────────────┐
│    USERS    │◄───────────────────────► │ USER_TENANT │
└─────────────┘                          │ ASSOCIATIONS│
                                         └─────────────┘
       │
       ├─────────► PROPERTIES ◄──────────┐
       │                │                 │
       │                ├─► ROOM_TYPES ───┤
       │                │       │         │
       │                │       ▼         │
       │                │    ROOMS        │
       │                │       │         │
       │                │       ▼         │
       │                │  AVAILABILITY   │
       │                │                 │
       │                ├─► RATES ────────┤
       │                │                 │
       │                └─► CHANNEL_      │
       │                    MAPPINGS      │
       │                                  │
       ├─────────► GUESTS ────────────────┤
       │                │                 │
       │                ▼                 │
       │         RESERVATIONS ◄───────────┤
       │                │                 │
       │                ├─► RESERVATION_  │
       │                │   STATUS_       │
       │                │   HISTORY       │
       │                │                 │
       │                ├─► PAYMENTS      │
       │                │                 │
       │                ├─► INVOICES ─────┤
       │                │       │         │
       │                │       ▼         │
       │                │  INVOICE_ITEMS  │
       │                │                 │
       │                └─► RESERVATION_  │
       │                    SERVICES      │
       │                                  │
       ├─────────► SERVICES ──────────────┘
       │
       ├─────────► HOUSEKEEPING_TASKS
       │
       ├─────────► ANALYTICS_METRICS
       │                │
       │                ├─► ANALYTICS_
       │                │   METRIC_
       │                │   DIMENSIONS
       │                │
       │                └─► ANALYTICS_
       │                    REPORTS
       │
       └─────────► All tenant-scoped tables
```

---

## 🔐 Multi-Tenancy Layer

### 1. Tenants Table

The **root entity** for multi-tenant architecture.

```sql
CREATE TABLE tenants (
    -- Identity
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,

    -- Classification
    type tenant_type NOT NULL,  -- CHAIN, FRANCHISE, INDEPENDENT, MANAGEMENT_COMPANY
    status tenant_status NOT NULL DEFAULT 'TRIAL',

    -- Contact
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    website VARCHAR(500),

    -- Address
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    country CHAR(2),

    -- Flexible Configuration
    config JSONB NOT NULL DEFAULT '{...}',
    subscription JSONB NOT NULL DEFAULT '{...}',
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,  -- Soft delete
    version BIGINT DEFAULT 0
);
```

**Key Features**:
- **UUID Primary Key**: Non-sequential, globally unique
- **Slug**: URL-friendly identifier (e.g., "marriott-international")
- **JSONB Config**: Flexible settings without schema changes
- **Soft Delete**: Data retention for compliance
- **Optimistic Locking**: Version field prevents concurrent update conflicts

**Indexes**:
```sql
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_type ON tenants(type);
```

### 2. Users Table

System users with multi-tenant access support.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Authentication
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    email_verified_at TIMESTAMP,

    -- Security
    last_login_at TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,

    -- Preferences
    preferences JSONB DEFAULT '{
        "language": "en",
        "timezone": "UTC",
        "dateFormat": "YYYY-MM-DD",
        "notifications": {"email": true, "sms": false}
    }'::jsonb,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

**Key Features**:
- **Multi-Tenant Access**: Users can belong to multiple tenants
- **Security**: Password hashing, login attempt tracking, account locking
- **Preferences**: User-specific settings in JSONB

### 3. User-Tenant Associations

**Many-to-Many** relationship with role-based access control.

```sql
CREATE TABLE user_tenant_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Access Control
    role tenant_role NOT NULL,  -- OWNER, ADMIN, MANAGER, STAFF, VIEWER
    permissions TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_primary BOOLEAN NOT NULL DEFAULT false,

    -- Lifecycle
    assigned_by UUID,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_accessed_at TIMESTAMP,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    -- Constraints
    UNIQUE(user_id, tenant_id)
);
```

**Key Features**:
- **Role-Based Access**: OWNER, ADMIN, MANAGER, STAFF, VIEWER
- **Granular Permissions**: Array of permission strings
- **Primary Tenant**: Default tenant for user login
- **Expiration Support**: Temporary access grants

**Indexes**:
```sql
CREATE INDEX idx_uta_user ON user_tenant_associations(user_id);
CREATE INDEX idx_uta_tenant ON user_tenant_associations(tenant_id);
CREATE INDEX idx_uta_role ON user_tenant_associations(role);
```

---

## 🏨 Property Management Layer

### 4. Properties Table

Individual hotel/resort properties.

```sql
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Identity
    name VARCHAR(200) NOT NULL,
    property_code VARCHAR(50) UNIQUE,
    brand VARCHAR(100),
    property_type VARCHAR(50),

    -- Classification
    category VARCHAR(50),
    star_rating DECIMAL(2,1),
    total_rooms INTEGER,

    -- Contact
    email VARCHAR(255),
    phone VARCHAR(20),
    website VARCHAR(500),

    -- Address
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    country CHAR(2),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),

    -- Operational
    check_in_time TIME,
    check_out_time TIME,
    currency CHAR(3) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Flexible Configuration
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    version BIGINT DEFAULT 0
);
```

**Key Features**:
- **Multi-Property Support**: Unlimited properties per tenant
- **Geolocation**: Latitude/longitude for mapping
- **Operational Settings**: Check-in/out times, currency, timezone
- **JSONB Metadata**: Amenities, policies, features

**Indexes**:
```sql
CREATE INDEX idx_properties_tenant ON properties(tenant_id);
CREATE INDEX idx_properties_code ON properties(property_code);
CREATE INDEX idx_properties_active ON properties(is_active);
```

### 5. Room Types Table

Room category definitions (Deluxe, Suite, etc.).

```sql
CREATE TABLE room_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Identity
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    category room_category NOT NULL,

    -- Capacity
    max_occupancy INTEGER NOT NULL,
    max_adults INTEGER NOT NULL,
    max_children INTEGER NOT NULL,
    default_occupancy INTEGER NOT NULL DEFAULT 2,

    -- Pricing
    base_rate DECIMAL(10,2) NOT NULL,
    extra_bed_rate DECIMAL(10,2),
    extra_person_rate DECIMAL(10,2),

    -- Description
    description TEXT,
    short_description VARCHAR(500),

    -- Specifications
    size_value DECIMAL(10,2),
    size_unit VARCHAR(20),
    bed_types VARCHAR(100),

    -- Configuration
    amenities TEXT[],
    views TEXT[],
    features JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,

    -- Constraints
    UNIQUE(tenant_id, property_id, code)
);
```

**Key Features**:
- **Flexible Occupancy**: Adults, children, extra beds
- **Rich Descriptions**: Marketing content
- **Amenities**: Array of features
- **Sort Order**: Display ordering

### 6. Rooms Table

Physical room inventory.

```sql
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,

    -- Identity
    room_number VARCHAR(20) NOT NULL,
    floor VARCHAR(10),
    building VARCHAR(50),

    -- Status
    room_status room_status NOT NULL DEFAULT 'AVAILABLE',
    housekeeping_status housekeeping_status NOT NULL DEFAULT 'CLEAN',
    maintenance_status maintenance_status NOT NULL DEFAULT 'OPERATIONAL',

    -- Features
    features JSONB DEFAULT '{}'::jsonb,
    notes TEXT,

    -- Flags
    is_smoking_allowed BOOLEAN NOT NULL DEFAULT false,
    is_accessible BOOLEAN NOT NULL DEFAULT false,
    is_connecting_room BOOLEAN NOT NULL DEFAULT false,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,

    -- Constraints
    UNIQUE(tenant_id, property_id, room_number)
);
```

**Key Features**:
- **Triple Status**: Room, housekeeping, maintenance
- **Location Tracking**: Floor, building
- **Accessibility**: ADA/accessibility flags
- **Connecting Rooms**: Room pairing support

**Indexes**:
```sql
CREATE INDEX idx_rooms_property ON rooms(property_id);
CREATE INDEX idx_rooms_type ON rooms(room_type_id);
CREATE INDEX idx_rooms_status ON rooms(room_status);
```

---

## 💰 Rate Management Layer

### 7. Rates Table

Pricing strategies and rate plans.

```sql
CREATE TABLE rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,

    -- Identity
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),

    -- Strategy
    strategy rate_strategy NOT NULL,
    status rate_status NOT NULL DEFAULT 'ACTIVE',

    -- Pricing
    base_rate DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',

    -- Validity
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,

    -- Booking Window
    min_advance_days INTEGER DEFAULT 0,
    max_advance_days INTEGER,

    -- Stay Requirements
    min_length_of_stay INTEGER DEFAULT 1,
    max_length_of_stay INTEGER,

    -- Flexible Rules
    rules JSONB DEFAULT '{}'::jsonb,

    -- Restrictions
    blackout_dates DATE[],

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,

    -- Constraints
    CHECK (valid_from <= valid_to),
    CHECK (base_rate >= 0)
);
```

**Key Features**:
- **Multiple Strategies**: FIXED, DYNAMIC, SEASONAL, WEEKEND, LASTMINUTE, EARLYBIRD
- **Flexible Rules**: JSONB for complex pricing logic
- **Date Restrictions**: Blackout dates array
- **Stay Requirements**: Min/max night stays

---

## 📅 Availability Layer

### 8. Room Availability Table (Separate Schema)

Real-time room inventory tracking.

```sql
CREATE SCHEMA availability;

CREATE TABLE availability.room_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,

    -- Time Dimension
    date DATE NOT NULL,

    -- Inventory
    total_rooms INTEGER NOT NULL,
    available_rooms INTEGER NOT NULL,
    booked_rooms INTEGER NOT NULL,
    blocked_rooms INTEGER NOT NULL,

    -- Status
    status availability_status NOT NULL DEFAULT 'AVAILABLE',

    -- Pricing (Optional)
    current_rate DECIMAL(10,2),
    min_rate DECIMAL(10,2),
    max_rate DECIMAL(10,2),

    -- Restrictions
    restrictions JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    last_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100),

    -- Constraints
    UNIQUE(tenant_id, property_id, room_type_id, date),
    CHECK (total_rooms >= 0),
    CHECK (available_rooms >= 0),
    CHECK (booked_rooms >= 0),
    CHECK (blocked_rooms >= 0),
    CHECK (available_rooms + booked_rooms + blocked_rooms <= total_rooms)
);
```

**Key Features**:
- **Separate Schema**: Isolates high-traffic tables
- **Date-Based**: One row per room type per day
- **Inventory Tracking**: Total, available, booked, blocked
- **Rate Information**: Current and min/max rates
- **Check Constraints**: Data integrity validation

**Critical Indexes**:
```sql
CREATE INDEX idx_avail_lookup
ON availability.room_availability(tenant_id, property_id, date);

CREATE INDEX idx_avail_room_type
ON availability.room_availability(room_type_id, date);

CREATE INDEX idx_avail_status
ON availability.room_availability(status, date);
```

---

## 📋 Reservation Layer

### 9. Guests Table

Guest profiles and preferences.

```sql
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Identity
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),

    -- Address
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    country CHAR(2),

    -- Identification
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    nationality CHAR(2),

    -- Preferences
    preferences JSONB DEFAULT '{}'::jsonb,
    special_requests TEXT,

    -- Marketing
    vip_status VARCHAR(50),
    loyalty_number VARCHAR(100),
    marketing_consent BOOLEAN DEFAULT false,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,

    -- Constraints
    UNIQUE(tenant_id, email)
);
```

**Key Features**:
- **GDPR Ready**: Marketing consent tracking
- **Guest Preferences**: JSONB for dietary, room preferences
- **VIP/Loyalty**: Status and program integration
- **Identification**: Passport/ID tracking

### 10. Reservations Table

Core booking records.

```sql
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,

    -- Booking Reference
    confirmation_number VARCHAR(50) UNIQUE NOT NULL,

    -- Dates
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,

    -- Occupancy
    number_of_adults INTEGER NOT NULL DEFAULT 2,
    number_of_children INTEGER NOT NULL DEFAULT 0,
    number_of_rooms INTEGER NOT NULL DEFAULT 1,

    -- Status
    status reservation_status NOT NULL DEFAULT 'PENDING',
    source reservation_source NOT NULL,

    -- Pricing
    room_rate DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',

    -- Discounts
    discount_amount DECIMAL(10,2) DEFAULT 0,
    discount_code VARCHAR(50),

    -- Amounts
    paid_amount DECIMAL(10,2) DEFAULT 0,
    balance_due DECIMAL(10,2),

    -- Details
    special_requests TEXT,
    notes TEXT,

    -- Audit
    booked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TIMESTAMP,
    checked_out_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Constraints
    CHECK (check_in_date < check_out_date),
    CHECK (number_of_adults > 0),
    CHECK (number_of_rooms > 0),
    CHECK (total_amount >= 0)
);
```

**Key Features**:
- **Unique Confirmation**: Non-duplicate booking references
- **Flexible Occupancy**: Adults, children, multiple rooms
- **Financial Tracking**: Rates, discounts, payments
- **Full Lifecycle**: Booked → Checked In → Checked Out
- **Cancellation Support**: Timestamp and reason tracking

**Critical Indexes**:
```sql
CREATE INDEX idx_reservations_tenant ON reservations(tenant_id);
CREATE INDEX idx_reservations_property ON reservations(property_id);
CREATE INDEX idx_reservations_guest ON reservations(guest_id);
CREATE INDEX idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_confirmation ON reservations(confirmation_number);
```

### 11. Reservation Status History

Audit trail for status changes.

```sql
CREATE TABLE reservation_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Status Change
    old_status reservation_status,
    new_status reservation_status NOT NULL,

    -- Context
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(100),
    reason TEXT,
    notes TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);
```

**Key Features**:
- **Complete Audit Trail**: Every status change logged
- **Context Tracking**: Who, when, why
- **GDPR Compliance**: Required for data protection regulations

---

## 💳 Financial Layer

### 12. Payments Table

Payment transactions.

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

    -- Transaction
    amount DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',

    -- Payment Details
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'PENDING',
    transaction_type transaction_type NOT NULL,

    -- Gateway
    transaction_id VARCHAR(100) UNIQUE,
    gateway_name VARCHAR(100),
    gateway_response JSONB,

    -- Card (Tokenized)
    card_last_four CHAR(4),
    card_brand VARCHAR(50),

    -- Processing
    processed_at TIMESTAMP,
    refunded_at TIMESTAMP,
    refund_amount DECIMAL(10,2),

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),

    -- Constraints
    CHECK (amount >= 0),
    CHECK (refund_amount <= amount)
);
```

**Key Features**:
- **PCI Compliant**: No card storage, tokens only
- **Multiple Methods**: Cash, cards, bank transfer, crypto
- **Gateway Integration**: JSONB gateway responses
- **Refund Support**: Partial and full refunds

### 13. Invoices Table

Billing documents.

```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,

    -- Invoice Details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,

    -- Status
    status invoice_status NOT NULL DEFAULT 'DRAFT',

    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    balance_due DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',

    -- Payment
    payment_terms TEXT,
    payment_method payment_method,
    paid_at TIMESTAMP,

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,

    -- Constraints
    CHECK (total_amount >= 0),
    CHECK (paid_amount >= 0),
    CHECK (paid_amount <= total_amount)
);
```

### 14. Invoice Items Table

Line item details.

```sql
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Item Details
    item_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,

    -- Pricing
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,

    -- Tax
    tax_rate DECIMAL(5,2),
    tax_amount DECIMAL(10,2) DEFAULT 0,

    -- Reference
    reference_id UUID,
    reference_type VARCHAR(50),

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CHECK (quantity > 0),
    CHECK (unit_price >= 0)
);
```

---

## 📊 Analytics Layer

### 15. Analytics Metrics

KPI tracking and business intelligence.

```sql
CREATE TABLE analytics_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Metric Definition
    metric_type metric_type NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,

    -- Time Dimensions
    date DATE NOT NULL,
    granularity time_granularity NOT NULL,

    -- Dimensional Analysis
    dimensions JSONB DEFAULT '{}'::jsonb,

    -- Status
    status analytics_status NOT NULL DEFAULT 'COMPLETED',

    -- Audit
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    calculated_by VARCHAR(100),

    -- Constraints
    UNIQUE(tenant_id, property_id, metric_type, date, granularity)
);
```

**Key Features**:
- **Standard KPIs**: Occupancy, ADR, RevPAR, etc.
- **Time Granularity**: Hourly, daily, weekly, monthly, quarterly, yearly
- **Dimensional**: JSONB for market segment, channel, room type filters

---

## 🛠️ Operations Layer

### 16. Services Table

Hotel services and amenities.

```sql
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Service Details
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    category VARCHAR(50) NOT NULL,

    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',
    pricing_unit VARCHAR(50),

    -- Availability
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_bookable BOOLEAN NOT NULL DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,

    -- Description
    description TEXT,

    -- Configuration
    config JSONB DEFAULT '{}'::jsonb,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### 17. Housekeeping Tasks

Cleaning and maintenance tracking.

```sql
CREATE TABLE housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

    -- Task Details
    task_type VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 3,

    -- Status
    status housekeeping_status NOT NULL DEFAULT 'DIRTY',

    -- Assignment
    assigned_to UUID,
    assigned_at TIMESTAMP,

    -- Completion
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 18. Channel Mappings

OTA and distribution channel integration.

```sql
CREATE TABLE channel_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,

    -- Channel Details
    channel_name VARCHAR(100) NOT NULL,
    channel_code VARCHAR(100) NOT NULL,
    external_room_id VARCHAR(100),
    external_property_id VARCHAR(100),

    -- Mapping
    mapping_config JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMP,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    -- Constraints
    UNIQUE(tenant_id, property_id, room_type_id, channel_code)
);
```

---

## 🔍 Performance Optimization

### Index Strategy

**Total Indexes**: 55+

**Categories**:
1. **Foreign Key Indexes**: All FK columns indexed
2. **Lookup Indexes**: Frequently queried fields
3. **Composite Indexes**: Multi-column queries
4. **Unique Indexes**: Business key constraints

**Example**: Reservation Lookup
```sql
-- Fast lookup by confirmation number
CREATE INDEX idx_reservations_confirmation
ON reservations(confirmation_number);

-- Fast date range queries
CREATE INDEX idx_reservations_dates
ON reservations(check_in_date, check_out_date);

-- Fast tenant-scoped queries
CREATE INDEX idx_reservations_tenant_status
ON reservations(tenant_id, status);
```

### Query Performance

**Typical Query Patterns**:
```sql
-- Find available rooms (uses availability index)
SELECT * FROM availability.room_availability
WHERE tenant_id = :tenant_id
  AND property_id = :property_id
  AND date BETWEEN :start_date AND :end_date
  AND available_rooms > 0;

-- Get guest reservations (uses guest + dates indexes)
SELECT * FROM reservations
WHERE tenant_id = :tenant_id
  AND guest_id = :guest_id
  AND status IN ('CONFIRMED', 'CHECKED_IN')
ORDER BY check_in_date DESC;
```

---

## 🔐 Security Features

### 1. Tenant Isolation

**Every query filtered**:
```sql
WHERE tenant_id = :current_tenant_id
```

### 2. Soft Deletes

Preserves data for audit:
```sql
-- Mark as deleted
UPDATE properties
SET deleted_at = CURRENT_TIMESTAMP, deleted_by = :user_id
WHERE id = :property_id AND tenant_id = :tenant_id;

-- Query only active records
SELECT * FROM properties
WHERE tenant_id = :tenant_id AND deleted_at IS NULL;
```

### 3. Optimistic Locking

Prevents concurrent update conflicts:
```sql
-- Update with version check
UPDATE properties
SET name = :new_name, version = version + 1
WHERE id = :property_id
  AND tenant_id = :tenant_id
  AND version = :expected_version;
```

### 4. Audit Trails

Every change tracked:
```sql
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP,
created_by VARCHAR(100),
updated_by VARCHAR(100),
deleted_at TIMESTAMP,
deleted_by VARCHAR(100)
```

---

## 📈 Scalability Considerations

### Horizontal Scaling

- **Read Replicas**: PostgreSQL streaming replication
- **Connection Pooling**: PgBouncer recommended
- **Caching**: Redis for hot data (availability, rates)

### Partitioning Strategy

**High-Volume Tables**:
```sql
-- Partition availability by date
CREATE TABLE availability.room_availability_2025_01
PARTITION OF availability.room_availability
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### Archive Strategy

**Old Data Retention**:
- Reservations: 7 years (financial compliance)
- Payments: 10 years (audit requirements)
- Analytics: 3 years (reporting needs)

---

## 🎯 Best Practices

### 1. Always Use Tenant Context
```sql
-- ✅ Correct
SELECT * FROM properties
WHERE tenant_id = :tenant_id AND id = :property_id;

-- ❌ Wrong (security risk)
SELECT * FROM properties WHERE id = :property_id;
```

### 2. Include Soft Delete Filters
```sql
-- ✅ Correct
WHERE tenant_id = :tenant_id AND deleted_at IS NULL;

-- ❌ Wrong (returns deleted records)
WHERE tenant_id = :tenant_id;
```

### 3. Use Transactions for Multi-Table Operations
```sql
BEGIN;
  -- Create reservation
  INSERT INTO reservations (...) VALUES (...);

  -- Update availability
  UPDATE availability.room_availability SET available_rooms = available_rooms - 1;

  -- Record payment
  INSERT INTO payments (...) VALUES (...);
COMMIT;
```

### 4. Leverage JSONB for Flexibility
```sql
-- Query JSONB data
SELECT * FROM properties
WHERE metadata->>'brand' = 'Marriott Hotels'
  AND (metadata->'amenities')::jsonb ? 'Pool';

-- Update JSONB fields
UPDATE properties
SET metadata = jsonb_set(metadata, '{amenities}', '["WiFi", "Pool", "Gym"]'::jsonb)
WHERE id = :property_id;
```

---

## 🆕 Phase 1 & 2 Enhancements (Tables 25-37)

### Financial Operations (Phase 1)

**25. Folios** - Guest account ledgers
- Tracks all financial transactions per guest/reservation
- Multiple folio types (GUEST, COMPANY, GROUP, MASTER)
- Balance tracking and settlement status

**26. Charge Postings** - Individual charges to folios
- Detailed charge line items with void tracking
- Full-text search on descriptions
- Automatic folio balance updates

**30. Deposit Schedules** - Automated deposit collection
- Scheduled deposit requirements
- Multiple deposit types (ARRIVAL, BOOKING, CANCELLATION)
- Collection status tracking

**35. Refunds** - Refund transaction tracking
- Links to original payments
- Multiple refund types and reasons
- Complete audit trail

### Audit & Compliance (Phase 1)

**27. Audit Logs** - Comprehensive audit trail
- JSONB change tracking (before/after states)
- IP address logging
- Full coverage of all table operations

**28. Business Dates** - Business date management
- Separates business date from system date
- One active business date per property
- Night audit workflow support

**29. Night Audit Log** - Night audit execution tracking
- Task execution monitoring via JSONB
- Error logging and diagnostics
- Performance metrics

### Revenue Management (Phase 2)

**31. Allotments** - Block bookings and room allotments
- Corporate and group block management
- Date range tracking
- Release date policies

**32. Booking Sources** - Channel tracking
- Commission rate management
- Source performance tracking
- Active/inactive channel control

**33. Market Segments** - Market segmentation
- Guest segmentation for revenue analysis
- Multiple segment types
- Market performance reporting

**36. Rate Overrides** - Manual rate adjustments
- Approval workflow tracking
- Rate variance analysis
- Authorization management

### Guest Services (Phase 2)

**34. Guest Preferences** - Individual preferences
- Personalization data
- Priority-based preferences
- Full-text notes search
- Loyalty building

### Operations (Phase 2)

**37. Maintenance Requests** - Property maintenance
- Priority management (LOW, MEDIUM, HIGH, URGENT)
- Status tracking workflow
- Room-based tracking
- SLA monitoring

### System Monitoring (Tables 23-24)

**23. Performance Reporting Tables**
- performance_reports: System-wide report storage
- report_schedules: Automated report generation
- performance_thresholds: Alert threshold management

**24. Performance Alerting Tables**
- performance_baselines: Statistical baseline tracking
- performance_alerts: Alert management with acknowledgment
- alert_rules: Rule-based alerting configuration

*Note: Monitoring tables are system-level (no tenant isolation) for database-wide performance tracking.*

### Implementation Summary

- **Total New Tables**: 15 (13 operational + 2 monitoring table groups)
- **New Indexes**: 90+ performance indexes
- **New Constraints**: 90+ foreign key constraints
- **ENUM Types Added**: 20+ new types
- **Industry Alignment**: 100% coverage of major PMS systems (OPERA, Cloudbeds, Protel, RMS)

For complete implementation details, see [Phase 1+2 Implementation Summary](PHASE1-2_IMPLEMENTATION_SUMMARY.md).

---

## 📚 Related Documentation

- [Industry Standards Compliance](industry-standards.md)
- [Multi-Tenancy Design](multi-tenancy.md)
- [Phase 1+2 Implementation Summary](PHASE1-2_IMPLEMENTATION_SUMMARY.md)
- [Performance Monitoring Guide](performance-monitoring.md)
- [Quick Reference Guide](quick-reference.md)

---

**Document Maintained By**: Tartware Architecture Team
**Last Technical Review**: October 15, 2025
**Phase 1+2 Completed**: October 15, 2025
