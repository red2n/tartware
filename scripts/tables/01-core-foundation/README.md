# Category 1: Core Foundation Tables

**Purpose**: Multi-tenancy, user management, properties, and guest profiles

## Tables in this Category (5 tables)

### 01_tenants.sql
- **Table**: `tenants`
- **Purpose**: Root-level multi-tenancy support
- **Key Features**:
  - Organization/company management
  - Subscription tier tracking
  - Timezone and locale settings
  - Soft delete support

### 02_users.sql
- **Table**: `users`
- **Purpose**: System user authentication and profiles
- **Key Features**:
  - Email/password authentication
  - Role-based access control (RBAC)
  - Multi-tenancy via associations
  - Profile metadata (JSONB)

### 03_user_tenant_associations.sql
- **Table**: `user_tenant_associations`
- **Purpose**: Many-to-many relationship between users and tenants
- **Key Features**:
  - Role assignment per tenant
  - Multi-tenant user support
  - Active status tracking

### 04_properties.sql
- **Table**: `properties`
- **Purpose**: Hotel/property management
- **Key Features**:
  - Property details (name, address, contact)
  - Brand and chain information
  - Timezone and settings
  - Tax and currency configuration

### 05_guests.sql
- **Table**: `guests`
- **Purpose**: Guest profile and contact information
- **Key Features**:
  - Personal information (name, contact, DOB)
  - Document tracking (passport, ID)
  - Preference management (JSONB)
  - Marketing consent tracking
  - VIP status

## Dependencies

- **No external dependencies** - These are root tables
- `tenants` and `users` are the foundation for multi-tenancy

## Relationship Overview

```
tenants (1) ←→ (M) user_tenant_associations ←→ (M) users
   ↓
properties (M)
   ↓
guests (M)
```

## Usage Order

1. Create `tenants` first
2. Create `users` second
3. Create `user_tenant_associations` to link users to tenants
4. Create `properties` under tenants
5. Create `guests` under tenants

## Notes

- All tables except `tenants` and `users` have `tenant_id` for multi-tenancy
- Soft delete implemented on all tables
- UUID primary keys throughout
- Comprehensive audit trail (created_at, updated_at, created_by, updated_by)
