# Zod Schema Implementation Plan for Tartware PMS

**Project Goal**: Create a comprehensive, type-safe Zod schema repository that mirrors the Tartware PostgreSQL database schema, enabling runtime validation and TypeScript type inference for API development.

**Date**: November 3, 2025
**Database Version**: PostgreSQL 16
**Total Tables**: 147 (146 public + 1 availability)
**Total ENUMs**: 61 defined types

---

## Executive Summary

### Current State Analysis

**Database Coverage:**
- ✅ **147 tables** across 7 business domains
- ✅ **61 ENUM types** defined in `02-enum-types.sql`
- ⚠️ **481 VARCHAR columns** that could be ENUMs (currently using string types)
- ✅ **UUID primary keys** throughout (multi-tenant architecture)
- ✅ **JSONB fields** for flexible metadata storage
- ✅ **Soft-delete pattern** with `deleted_at` timestamps

**ENUM Coverage Gap:**
- Currently: 61 ENUMs defined
- Potential: 481 columns that match ENUM naming patterns (`*_status`, `*_type`, `*_method`, etc.)
- **Gap**: Many tables use VARCHAR for enumerable values instead of database ENUMs
- **Impact**: Less type safety at database level, more validation needed in application layer

### Top Tables Requiring ENUM Enhancement

| Table Name | VARCHAR ENUM Candidates | Critical Columns |
|-----------|-------------------------|------------------|
| `mobile_check_ins` | 10 | access_method, checkin_status, device_type, digital_key_type, id_document_type |
| `minibar_consumption` | 9 | adjustment_type, detection_method, item_category, payment_method, posting_status |
| `guest_documents` | 9 | document_type, document_category, verification_status, access_level, mime_type |
| `event_bookings` | 9 | booking_status, event_type, catering_service_type, payment_method, setup_type |
| `transportation_requests` | 9 | request_status, request_type, vehicle_type, flight_status, service_type |
| `asset_inventory` | 9 | asset_type, asset_category, asset_status, criticality_level, operational_status |
| `audit_logs` | 8 | action, entity_type, event_type, severity, status, user_role |
| `refunds` | 8 | refund_status, refund_type, refund_method, reason_category, notification_method |
| `staff_schedules` | 8 | schedule_status, shift_type, role, leave_type, availability_status |
| `guest_notes` | 8 | note_type, note_category, priority, severity, alert_level |

---

## Phase 1: Foundation Setup (Week 1)

### 1.1 Project Structure

```
tartware-zod/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                    # Main export barrel
│   ├── shared/                     # Shared utilities
│   │   ├── enums.ts                # All ENUM definitions
│   │   ├── base-schemas.ts         # Common field patterns
│   │   └── validators.ts           # Custom validation functions
│   ├── schemas/                    # Table schemas by domain
│   │   ├── 01-core/               # 5 core tables
│   │   ├── 02-inventory/          # 17 inventory tables
│   │   ├── 03-bookings/           # 16 booking tables
│   │   ├── 04-financial/          # 15 financial tables
│   │   ├── 05-operations/         # 28 operations tables
│   │   ├── 06-integrations/       # 23 integration tables
│   │   └── 07-analytics/          # 19 analytics tables
│   ├── types/                      # Generated TypeScript types
│   │   └── index.ts
│   └── utilities/                  # Helper functions
│       ├── schema-generator.ts     # Auto-generate from SQL
│       └── db-introspection.ts     # Read from PostgreSQL
└── tests/
    ├── enums.test.ts
    ├── schemas/                    # Schema validation tests
    └── integration/                # End-to-end tests
```

### 1.2 Technology Stack

```json
{
  "dependencies": {
    "zod": "^3.23.8",
    "zod-to-json-schema": "^3.22.5",
    "zod-validation-error": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/pg": "^8.10.9",
    "pg": "^8.11.3",
    "typescript": "^5.3.3",
    "vitest": "^1.0.4",
    "tsx": "^4.7.0"
  }
}
```

### 1.3 Base Schema Patterns

```typescript
// src/shared/base-schemas.ts
import { z } from 'zod';

// UUID pattern (PostgreSQL uuid)
export const uuid = z.string().uuid();

// Multi-tenant pattern
export const tenantId = uuid.describe('Tenant isolation key');

// Audit timestamps
export const auditTimestamps = {
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
};

// Soft delete pattern
export const softDelete = {
  deleted_at: z.date().optional().nullable(),
};

// JSONB metadata pattern
export const jsonbMetadata = z.record(z.unknown()).optional();

// Money/Currency pattern
export const money = z.number().multipleOf(0.01).nonnegative();

// Percentage pattern
export const percentage = z.number().min(0).max(100);
```

---

## Phase 2: ENUM Schema Definition (Week 2)

### 2.1 Database ENUM Extraction

**Action Items:**
1. ✅ Extract all 61 ENUMs from database
2. ⚠️ Identify 481 VARCHAR columns that should be ENUMs
3. 📝 Document decision: Keep as VARCHAR or add database ENUMs?
4. Create Zod enums for all enumerable values

### 2.2 ENUM Strategy

**Option A: Mirror Database ENUMs Only (Conservative)**
- Convert 61 database ENUMs to Zod enums
- Keep VARCHAR columns as `z.string()` with `.min()` / `.max()`
- Pros: 100% aligned with database, no schema changes needed
- Cons: Less type safety, runtime errors possible

**Option B: Add Application-Level ENUMs (Recommended)**
- Convert 61 database ENUMs to Zod enums
- Define Zod enums for common VARCHAR patterns
- Use `.refine()` for additional validation
- Pros: Strong type safety, better DX, catches errors earlier
- Cons: Diverges from DB schema, needs documentation

**Recommendation**: **Option B** - Add application-level ENUMs for common patterns while keeping database flexible.

### 2.3 ENUM Template

```typescript
// src/shared/enums.ts

// Database ENUM (from 02-enum-types.sql)
export const ReservationStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
]);

// Application ENUM (for VARCHAR columns)
export const CheckinStatusEnum = z.enum([
  'INITIATED',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'ROOM_ASSIGNED',
  'KEY_ISSUED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

// Export types
export type ReservationStatus = z.infer<typeof ReservationStatusEnum>;
export type CheckinStatus = z.infer<typeof CheckinStatusEnum>;
```

### 2.4 Priority ENUMs to Define (Top 50)

**Critical Business ENUMs (from VARCHAR columns):**

1. **Mobile & Digital** (10 ENUMs):
   - `checkin_status`, `access_method`, `device_type`, `digital_key_type`, `id_document_type`
   - `identity_verification_method`, `key_delivery_method`, `room_assignment_method`

2. **Financial & Payments** (12 ENUMs):
   - `refund_status`, `refund_type`, `refund_method`, `posting_status`
   - `calculation_method`, `tax_category`, `tax_type`, `jurisdiction_level`
   - `folio_status`, `folio_type`, `settlement_method`

3. **Operations** (15 ENUMs):
   - `request_status`, `request_type`, `service_type`, `detection_method`
   - `schedule_status`, `shift_type`, `leave_type`, `availability_status`
   - `note_category`, `note_type`, `alert_level`, `compensation_type`

4. **Inventory & Events** (8 ENUMs):
   - `booking_status`, `event_type`, `setup_type`, `catering_service_type`
   - `confirmation_status`, `lead_source`

5. **Analytics & Reporting** (5 ENUMs):
   - `report_type`, `visualization_type`, `test_category`, `test_status`

---

## Phase 3: Core Domain Schemas (Week 3-4)

### 3.1 Category 01: Core Foundation (5 tables)

**Tables**: `tenants`, `users`, `user_tenant_associations`, `properties`, `guests`

**Priority**: **CRITICAL** - Foundation for all other schemas

```typescript
// src/schemas/01-core/tenants.ts
import { z } from 'zod';
import { uuid, tenantId, auditTimestamps, softDelete } from '../../shared/base-schemas';
import { TenantTypeEnum, TenantStatusEnum } from '../../shared/enums';

export const TenantSchema = z.object({
  tenant_id: uuid,
  name: z.string().min(1).max(255),
  type: TenantTypeEnum,
  status: TenantStatusEnum,
  subscription_tier: z.enum(['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE']),
  max_properties: z.number().int().positive(),
  max_users: z.number().int().positive(),
  settings: z.record(z.unknown()).optional(),
  ...auditTimestamps,
  ...softDelete,
});

export type Tenant = z.infer<typeof TenantSchema>;

// Create DTO (without auto-generated fields)
export const CreateTenantSchema = TenantSchema.omit({
  tenant_id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
});

// Update DTO (partial, without immutable fields)
export const UpdateTenantSchema = TenantSchema.omit({
  tenant_id: true,
  created_at: true,
  created_by: true,
}).partial();
```

**Deliverables:**
- [ ] `tenants.ts` - Multi-tenant root schema
- [ ] `users.ts` - User authentication & profile
- [ ] `user-tenant-associations.ts` - RBAC relationship
- [ ] `properties.ts` - Hotel/property master data
- [ ] `guests.ts` - Guest profile & contact info

### 3.2 Category 02: Inventory (17 tables)

**Tables**: Room types, rooms, rates, availability, packages, companies, events, etc.

**Complexity**: Medium-High (revenue management, B2B relationships)

### 3.3 Category 03: Bookings (16 tables)

**Tables**: Reservations, status history, allotments, preferences, communications, feedback

**Complexity**: High (complex state machine, guest lifecycle)

### 3.4 Category 04: Financial (15 tables)

**Tables**: Payments, invoices, folios, charges, refunds, AR, GL, tax config

**Complexity**: High (accounting rules, compliance, multi-currency)

### 3.5 Category 05: Operations (28 tables)

**Tables**: Services, housekeeping, maintenance, staff, incidents, mobile, smart devices

**Complexity**: Medium (operational workflows, IoT integration)

### 3.6 Category 06: Integrations (23 tables)

**Tables**: Channel mappings, OTA configs, GDS, API logs, webhooks, marketing, AI/ML

**Complexity**: High (external system contracts, rate parity, AI models)

### 3.7 Category 07: Analytics (19 tables)

**Tables**: Metrics, reports, audit logs, compliance, journey tracking, forecasting

**Complexity**: Medium (reporting, compliance, data aggregation)

---

## Phase 4: Advanced Features (Week 5-6)

### 4.1 Relationship Validation

```typescript
// Example: Validate reservation references valid room
export const ReservationSchema = z.object({
  reservation_id: uuid,
  tenant_id: tenantId,
  property_id: uuid,
  room_id: uuid,
  guest_id: uuid,
  // ... other fields
}).refine(
  async (data) => {
    // Check room belongs to property
    return await validateRoomBelongsToProperty(data.room_id, data.property_id);
  },
  { message: 'Room does not belong to specified property' }
);
```

### 4.2 Business Rule Validation

```typescript
// Example: Validate rate override dates
export const RateOverrideSchema = z.object({
  // ... fields
  start_date: z.date(),
  end_date: z.date(),
}).refine(
  (data) => data.end_date > data.start_date,
  { message: 'End date must be after start date' }
).refine(
  (data) => {
    const daysDiff = (data.end_date.getTime() - data.start_date.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 365; // Max 1 year override
  },
  { message: 'Rate override cannot exceed 365 days' }
);
```

### 4.3 JSONB Schema Validation

```typescript
// Example: Validate guest preferences JSONB structure
export const GuestPreferencesJsonbSchema = z.object({
  room: z.object({
    floor: z.enum(['LOW', 'MID', 'HIGH']).optional(),
    view: z.enum(['OCEAN', 'CITY', 'GARDEN', 'MOUNTAIN']).optional(),
    bed_type: z.enum(['KING', 'QUEEN', 'TWIN', 'DOUBLE']).optional(),
    smoking: z.boolean().optional(),
  }).optional(),
  amenities: z.object({
    pillow_type: z.enum(['SOFT', 'MEDIUM', 'FIRM', 'MEMORY_FOAM']).optional(),
    extra_pillows: z.number().int().min(0).max(5).optional(),
    extra_towels: z.boolean().optional(),
    hypoallergenic: z.boolean().optional(),
  }).optional(),
  dietary: z.object({
    restrictions: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
    preferences: z.array(z.string()).optional(),
  }).optional(),
});
```

### 4.4 Discriminated Unions

```typescript
// Example: Different validation based on payment method
export const PaymentSchema = z.discriminatedUnion('payment_method', [
  z.object({
    payment_method: z.literal('CREDIT_CARD'),
    card_last_four: z.string().length(4),
    card_brand: z.enum(['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER']),
    expiry_date: z.string().regex(/^\d{2}\/\d{2}$/),
  }),
  z.object({
    payment_method: z.literal('BANK_TRANSFER'),
    bank_name: z.string(),
    account_last_four: z.string().length(4),
    routing_number: z.string().optional(),
  }),
  z.object({
    payment_method: z.literal('CASH'),
    currency: z.string().length(3),
    denomination_breakdown: z.record(z.number()).optional(),
  }),
]);
```

---

## Phase 5: Code Generation & Automation (Week 7)

### 5.1 SQL-to-Zod Generator

**Goal**: Automatically generate Zod schemas from PostgreSQL schema

**Approach:**
1. Connect to database via `pg` driver
2. Query `information_schema.tables` and `information_schema.columns`
3. Map PostgreSQL types to Zod types
4. Generate TypeScript files with proper imports

```typescript
// src/utilities/schema-generator.ts
import { Client } from 'pg';
import fs from 'fs/promises';

const PG_TO_ZOD_MAP = {
  'uuid': 'z.string().uuid()',
  'character varying': 'z.string()',
  'text': 'z.string()',
  'integer': 'z.number().int()',
  'bigint': 'z.bigint()',
  'numeric': 'z.number()',
  'boolean': 'z.boolean()',
  'timestamp with time zone': 'z.date()',
  'date': 'z.date()',
  'jsonb': 'z.record(z.unknown())',
  'USER-DEFINED': 'z.enum([])', // Handle ENUMs separately
};

async function generateSchemaFromTable(tableName: string) {
  const client = new Client({ /* config */ });
  await client.connect();

  // Get columns
  const result = await client.query(`
    SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  // Generate Zod schema code
  let schemaCode = `export const ${pascalCase(tableName)}Schema = z.object({\n`;

  for (const col of result.rows) {
    const zodType = PG_TO_ZOD_MAP[col.data_type] || 'z.unknown()';
    schemaCode += `  ${col.column_name}: ${zodType}`;

    if (col.is_nullable === 'YES') {
      schemaCode += '.optional()';
    }

    schemaCode += ',\n';
  }

  schemaCode += '});\n';

  await client.end();
  return schemaCode;
}
```

### 5.2 OpenAPI Schema Generation

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

// Convert Zod schemas to OpenAPI/JSON Schema
const jsonSchema = zodToJsonSchema(TenantSchema, 'Tenant');

// Export to openapi.json for Swagger/API documentation
```

### 5.3 Database Seeding with Zod Validation

```typescript
import { faker } from '@faker-js/faker';

export function generateMockTenant(): z.infer<typeof CreateTenantSchema> {
  return CreateTenantSchema.parse({
    name: faker.company.name(),
    type: faker.helpers.arrayElement(['INDEPENDENT', 'CHAIN', 'FRANCHISE']),
    status: 'TRIAL',
    subscription_tier: 'BASIC',
    max_properties: faker.number.int({ min: 1, max: 10 }),
    max_users: faker.number.int({ min: 5, max: 100 }),
  });
}
```

---

## Phase 6: Testing & Documentation (Week 8)

### 6.1 Test Coverage Goals

- **Unit Tests**: 100% coverage for all ENUMs
- **Schema Tests**: Validate all 147 table schemas
- **Integration Tests**: Test relationships and business rules
- **Performance Tests**: Validate 10,000+ records efficiently

```typescript
// tests/schemas/tenants.test.ts
import { describe, it, expect } from 'vitest';
import { TenantSchema } from '../../src/schemas/01-core/tenants';

describe('TenantSchema', () => {
  it('validates a correct tenant object', () => {
    const validTenant = {
      tenant_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Acme Hotels',
      type: 'CHAIN',
      status: 'ACTIVE',
      // ... more fields
    };

    expect(() => TenantSchema.parse(validTenant)).not.toThrow();
  });

  it('rejects invalid UUID', () => {
    const invalidTenant = {
      tenant_id: 'not-a-uuid',
      // ... other fields
    };

    expect(() => TenantSchema.parse(invalidTenant)).toThrow();
  });
});
```

### 6.2 Documentation Deliverables

- [ ] **README.md** - Installation, usage, examples
- [ ] **API.md** - Complete schema API reference
- [ ] **MIGRATION_GUIDE.md** - Upgrading from plain types
- [ ] **CONTRIBUTING.md** - How to add new schemas
- [ ] **CHANGELOG.md** - Version history
- [ ] **JSDoc comments** - Inline documentation for all schemas

---

## Phase 7: Integration & Deployment (Week 9-10)

### 7.1 NPM Package Setup

```json
{
  "name": "@tartware/zod-schemas",
  "version": "1.0.0",
  "description": "Type-safe Zod schemas for Tartware PMS database",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint src/**/*.ts",
    "generate": "tsx src/utilities/schema-generator.ts"
  },
  "keywords": ["zod", "pms", "hotel", "validation", "typescript"],
  "author": "Tartware Team",
  "license": "MIT"
}
```

### 7.2 CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test & Publish

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run build

  publish:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 7.3 Usage Examples

```typescript
// Example 1: API Request Validation
import { CreateReservationSchema } from '@tartware/zod-schemas';
import { Request, Response } from 'express';

app.post('/api/reservations', async (req: Request, res: Response) => {
  try {
    const validatedData = CreateReservationSchema.parse(req.body);
    const reservation = await db.reservations.create(validatedData);
    res.json(reservation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
    }
  }
});

// Example 2: Database Query Result Validation
import { GuestSchema } from '@tartware/zod-schemas';

const rawGuest = await db.query('SELECT * FROM guests WHERE guest_id = $1', [guestId]);
const guest = GuestSchema.parse(rawGuest.rows[0]); // Runtime validation

// Example 3: Form Validation (Frontend)
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateGuestSchema } from '@tartware/zod-schemas';

function GuestForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(CreateGuestSchema)
  });

  const onSubmit = (data) => {
    // data is fully typed and validated
    console.log(data);
  };

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

---

## Critical Decisions Needed

### Decision 1: ENUM Strategy
**Question**: Should we add 481 application-level ENUMs for VARCHAR columns, or keep them as strings?

**Options:**
- **A**: Conservative - Only 61 database ENUMs → Faster, less maintenance
- **B**: Comprehensive - Add 481 app ENUMs → Stronger typing, better DX

**Recommendation**: **Option B** for critical domains (core, bookings, financial), **Option A** for less critical domains (analytics, marketing)

### Decision 2: JSONB Validation Depth
**Question**: How deeply should we validate JSONB fields?

**Options:**
- **A**: Shallow - Use `z.record(z.unknown())` → Fast, flexible
- **B**: Deep - Define schemas for common JSONB structures → Type-safe, slower

**Recommendation**: **Option B** for critical business data (guest preferences, room settings), **Option A** for arbitrary metadata

### Decision 3: Repository Organization
**Question**: Monorepo or separate packages?

**Options:**
- **A**: Single package `@tartware/zod-schemas` → Simple, easy to maintain
- **B**: Split packages `@tartware/schemas-core`, `@tartware/schemas-bookings`, etc. → Tree-shakeable, modular

**Recommendation**: **Option A** initially, migrate to **Option B** when package exceeds 1MB

### Decision 4: Breaking Changes Policy
**Question**: How do we handle schema changes when database evolves?

**Options:**
- **A**: Semantic versioning - Major version for breaking changes
- **B**: Dated versions - `@tartware/schemas@2025-11-03`
- **C**: Dual schemas - Export both `v1` and `v2` schemas

**Recommendation**: **Option A** for public API, **Option C** during migration periods

---

## Success Metrics

### Technical Metrics
- [ ] **100% table coverage** - All 147 tables have Zod schemas
- [ ] **100% ENUM coverage** - All 61 database ENUMs mapped
- [ ] **95% test coverage** - Comprehensive test suite
- [ ] **< 50ms validation time** - For typical reservation object
- [ ] **Zero TypeScript errors** - Full type safety

### Developer Experience Metrics
- [ ] **< 5 minutes** - Time to add schema to new project
- [ ] **< 10 lines** - Typical API endpoint validation code
- [ ] **Auto-complete** - IDE support for all schemas
- [ ] **Generated docs** - API reference from JSDoc
- [ ] **Weekly updates** - Keep schemas in sync with database

### Business Metrics
- [ ] **50% reduction** - in API validation bugs
- [ ] **30% faster** - API development time
- [ ] **Zero production incidents** - from type mismatches
- [ ] **10+ projects** - using Tartware schemas

---

## Timeline Summary

| Phase | Duration | Deliverable | Status |
|-------|----------|-------------|--------|
| **Phase 1**: Foundation | Week 1 | Project setup, base patterns | 🔴 Not Started |
| **Phase 2**: ENUMs | Week 2 | 61 database ENUMs + critical app ENUMs | 🔴 Not Started |
| **Phase 3**: Core Schemas | Week 3-4 | 147 table schemas across 7 domains | 🔴 Not Started |
| **Phase 4**: Advanced Features | Week 5-6 | Relationships, business rules, JSONB | 🔴 Not Started |
| **Phase 5**: Automation | Week 7 | Code generation, OpenAPI export | 🔴 Not Started |
| **Phase 6**: Testing | Week 8 | Test suite, documentation | 🔴 Not Started |
| **Phase 7**: Deployment | Week 9-10 | NPM package, CI/CD, examples | 🔴 Not Started |

**Total Duration**: 10 weeks (2.5 months)
**Target Launch**: January 2026

---

## Next Steps

### Immediate Actions (This Week)

1. **✅ Complete ENUM Analysis** (DONE)
   - Identified 61 database ENUMs
   - Found 481 VARCHAR candidates

2. **📋 Decision Meeting Required**
   - Review ENUM strategy (Decision 1)
   - Approve JSONB validation depth (Decision 2)
   - Select repository structure (Decision 3)

3. **🚀 Phase 1 Kickoff**
   - Initialize `tartware-zod` repository
   - Setup TypeScript + Zod + Vitest
   - Create base schema patterns
   - Extract all 61 ENUMs from database

4. **📝 Create Sample Schema**
   - Implement `tenants.ts` as reference
   - Write comprehensive tests
   - Document patterns for team

### Resources Needed

- **1 Senior TypeScript Developer** (full-time, 10 weeks)
- **1 Database Engineer** (part-time, consultation)
- **Access to PostgreSQL database** (read-only for introspection)
- **CI/CD infrastructure** (GitHub Actions)
- **NPM organization** (@tartware)

### Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database schema changes during development | High | Freeze schema or use versioning |
| Performance issues with 481 ENUMs | Medium | Profile and optimize, use discriminated unions |
| Team adoption resistance | Medium | Comprehensive docs, training sessions |
| Maintenance burden | Low | Automate schema generation from database |

---

## Appendix

### A. Reference Links
- Zod Documentation: https://zod.dev/
- PostgreSQL Type System: https://www.postgresql.org/docs/16/datatype.html
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/intro.html

### B. Database ENUM List (61 types)

<details>
<summary>Click to expand full ENUM list</summary>

1. action_urgency
2. alert_severity
3. alert_status
4. analytics_status
5. asset_category
6. asset_condition
7. asset_status
8. asset_type
9. availability_status
10. carbon_offset_program_type
11. certification_status
12. certification_type
13. company_type
14. credit_status
15. criticality_level
16. depreciation_method
17. device_category
18. device_event_type
19. device_status
20. disposal_method
21. efficiency_rating
22. event_severity
23. event_trigger
24. group_block_status
25. group_booking_type
26. housekeeping_status
27. hvac_mode
28. impact_level
29. initiative_status
30. invoice_status
31. location_type
32. maintenance_schedule
33. maintenance_status
34. maintenance_type
35. measurement_period
36. metric_type
37. ml_model_type
38. network_type
39. operational_status
40. payment_method
41. payment_status
42. prediction_accuracy
43. predictive_alert_type
44. pricing_action
45. rate_status
46. rate_strategy
47. regulatory_compliance_status
48. reservation_source
49. reservation_status
50. room_category
51. room_status
52. scenario_type
53. season_type
54. service_provider_type
55. smart_device_type
56. sustainability_initiative_category
57. tenant_role
58. tenant_status
59. tenant_type
60. time_granularity
61. transaction_type

</details>

### C. Table Organization (7 Categories, 147 Tables)

**01-core**: 5 tables
**02-inventory**: 17 tables
**03-bookings**: 16 tables
**04-financial**: 15 tables
**05-operations**: 28 tables
**06-integrations**: 23 tables
**07-analytics**: 19 tables
**availability schema**: 1 table

---

## D. Schema Synchronization Protocol

### Critical Synchronization Rules

**⚠️ MANDATORY: Every database change requires a Zod schema update.**

This is not optional - schema drift between PostgreSQL and Zod will cause runtime failures in production. All developers and AI agents MUST follow this protocol.

### Change Type Matrix

| Database Change | Required Zod Updates | Example |
|----------------|---------------------|---------|
| **Add ENUM type** | Update `src/shared/enums.ts` | `CREATE TYPE room_view_type` → Add `RoomViewTypeEnum` |
| **Modify ENUM values** | Update enum definition + bump schema version | Add `'OCEAN_VIEW'` to enum → Add to Zod enum array |
| **Add table** | Create new schema file in category folder | `CREATE TABLE vip_services` → Create `src/schemas/05-operations/vip-services.ts` |
| **Drop table** | Mark schema as deprecated, add `.optional()` | Remove table → Add `@deprecated` JSDoc comment |
| **Add column** | Add field to schema object | `ALTER TABLE rooms ADD COLUMN view_type` → Add `view_type: RoomViewTypeEnum.optional()` |
| **Modify column type** | Update field type + add migration notes | Change `VARCHAR` to `TEXT` → Update schema, document in changelog |
| **Add NOT NULL constraint** | Remove `.optional()` from field | `ALTER COLUMN ... SET NOT NULL` → Remove `.optional()` |
| **Drop constraint** | Add `.optional()` to field | `ALTER COLUMN ... DROP NOT NULL` → Add `.optional()` |
| **Add foreign key** | Add `.refine()` validation | `ADD FOREIGN KEY (property_id)` → Add relationship validator |
| **Modify JSONB structure** | Update JSONB schema validator | Change settings structure → Update corresponding Zod object schema |
| **Add index** | No Zod change (performance only) | `CREATE INDEX` → No action required |
| **Add stored procedure** | Add to procedure types if exposed via API | `CREATE FUNCTION` → Add to `src/types/procedures.ts` if public |

### Pre-Commit Checklist (MUST COMPLETE)

Before committing ANY change to `scripts/` folder:

```markdown
- [ ] ✅ SQL script created/modified in `scripts/`
- [ ] ✅ Zod schema updated in corresponding category folder
- [ ] ✅ ENUM added/updated in `src/shared/enums.ts` (if applicable)
- [ ] ✅ Base schema patterns updated (if new pattern introduced)
- [ ] ✅ Type exports added to `src/types/index.ts`
- [ ] ✅ Tests written/updated in `tests/schemas/{category}/`
- [ ] ✅ Schema validation tests pass (`npm test`)
- [ ] ✅ TypeScript compilation succeeds (`npm run build`)
- [ ] ✅ Update CHANGELOG.md with breaking changes
- [ ] ✅ Document migration path if breaking change
- [ ] ✅ Update this plan if structural changes
```

### Validation Workflow

```bash
# 1. Make database change
vim scripts/tables/02-inventory/07_rooms.sql

# 2. Update Zod schema
vim src/schemas/02-inventory/rooms.ts

# 3. Update ENUMs if needed
vim src/shared/enums.ts

# 4. Run validation
npm test -- rooms.test.ts

# 5. Verify TypeScript compilation
npm run build

# 6. Test against database
npm run validate-against-db
```

### Common Anti-Patterns (DO NOT DO THIS)

❌ **Anti-Pattern 1**: Making database changes without updating Zod
```typescript
// Database: ALTER TABLE rooms ADD COLUMN view_type room_view_type;
// Zod: (no changes) ← WRONG! Will cause runtime errors
```

✅ **Correct Pattern**:
```typescript
// Database: ALTER TABLE rooms ADD COLUMN view_type room_view_type;
// Zod: Add to RoomSchema
export const RoomSchema = z.object({
  // ... existing fields
  view_type: RoomViewTypeEnum.optional(), // ✓ ADDED
});
```

❌ **Anti-Pattern 2**: Adding ENUMs only in Zod without database support
```typescript
// Zod: export const FooStatusEnum = z.enum(['A', 'B', 'C']);
// Database: foo_status VARCHAR(50) ← Wrong! No constraint enforcement
```

✅ **Correct Pattern**:
```sql
-- Database: CREATE TYPE foo_status AS ENUM ('A', 'B', 'C');
-- Zod: export const FooStatusEnum = z.enum(['A', 'B', 'C']);
```

❌ **Anti-Pattern 3**: Forgetting to update relationship validators
```typescript
// Database: ALTER TABLE reservations ADD FOREIGN KEY (property_id) REFERENCES properties(property_id);
// Zod: (no .refine() added) ← Wrong! No validation at app layer
```

✅ **Correct Pattern**:
```typescript
export const ReservationSchema = z.object({
  property_id: uuid,
  // ... other fields
}).refine(
  async (data) => await validatePropertyExists(data.property_id),
  { message: 'Invalid property_id reference' }
);
```

### Automated Sync Tools (Phase 5)

Once implemented, these tools will help maintain synchronization:

1. **`npm run sync-check`** - Compare database schema with Zod schemas, report drift
2. **`npm run generate-schema`** - Auto-generate Zod schemas from PostgreSQL
3. **`npm run validate-against-db`** - Validate Zod schemas against live database
4. **Pre-commit hook** - Block commits if schema drift detected

### Emergency Drift Resolution

If schema drift is discovered:

1. **Identify drift**: Run `npm run sync-check`
2. **Assess impact**: Check which schemas are out of sync
3. **Create tracking issue**: Document all drifted schemas
4. **Prioritize by usage**: Fix high-traffic schemas first
5. **Update in batches**: Group related changes
6. **Test thoroughly**: Run full test suite after each batch
7. **Deploy with migration**: Include database migration + schema update

### Responsibility Matrix

| Role | Responsibilities |
|------|-----------------|
| **Database Engineers** | Update `scripts/`, notify of schema changes, provide column metadata |
| **Backend Developers** | Update Zod schemas, write validators, maintain relationship rules |
| **AI Agents (Copilot)** | Follow checklist automatically, flag violations, suggest Zod updates |
| **Code Reviewers** | Verify checklist completion, test schema synchronization |
| **CI/CD Pipeline** | Run `sync-check`, block merges on drift, auto-generate docs |

### Version Compatibility

- **Major version bump**: Breaking changes (remove field, change type, remove ENUM value)
- **Minor version bump**: Additive changes (add optional field, add ENUM value)
- **Patch version bump**: Fixes (typo in JSDoc, test updates, no schema change)

**Example versioning:**
- Add optional column: `1.2.0` → `1.3.0` (minor)
- Remove required column: `1.3.0` → `2.0.0` (major)
- Fix validation message: `2.0.0` → `2.0.1` (patch)

---

**Document Version**: 1.1
**Last Updated**: November 3, 2025
**Next Review**: After Decision Meeting
**Sync Protocol Added**: November 3, 2025
