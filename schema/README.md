# @tartware/schemas

> Type-safe Zod schemas for Tartware PMS PostgreSQL database with runtime validation

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-3.23-purple)](https://zod.dev/)
[![Node](https://img.shields.io/badge/Node-20+-green)](https://nodejs.org/)

## Overview

This package provides comprehensive Zod schemas that mirror the Tartware PMS PostgreSQL database structure, enabling:

- ✅ **Runtime type validation** for API requests/responses
- ✅ **TypeScript type inference** without manual type definitions
- ✅ **147 table schemas** across 7 business domains
- ✅ **61 ENUM types** with full type safety
- ✅ **Multi-tenant aware** validation patterns
- ✅ **JSONB schema validation** for complex nested structures
- ✅ **Business rule validation** with custom refinements

## Installation

```bash
npm install @tartware/schemas zod
```

## Quick Start

```typescript
import { TenantSchema, CreateTenantSchema } from '@tartware/schemas/core/tenants';
import { ReservationSchema } from '@tartware/schemas/bookings/reservations';
import { TenantTypeEnum, ReservationStatusEnum } from '@tartware/schemas/enums';

// Validate API request
const validatedTenant = CreateTenantSchema.parse(req.body);

// Type inference
type Tenant = typeof TenantSchema._output;

// ENUM usage
const status: typeof ReservationStatusEnum = 'CONFIRMED';
```

## Architecture

### Schema Organization (7 Categories)

```
src/
├── shared/
│   ├── enums.ts              # 61 ENUM types
│   ├── base-schemas.ts       # Common patterns (UUID, timestamps, etc.)
│   └── validators.ts         # Custom validation functions
├── schemas/
│   ├── 01-core/             # 5 tables: tenants, users, properties, guests
│   ├── 02-inventory/        # 17 tables: rooms, rates, packages, events
│   ├── 03-bookings/         # 16 tables: reservations, allotments, feedback
│   ├── 04-financial/        # 15 tables: payments, invoices, AR, GL
│   ├── 05-operations/       # 28 tables: housekeeping, maintenance, staff
│   ├── 06-integrations/     # 23 tables: OTA, GDS, webhooks, AI/ML
│   └── 07-analytics/        # 19 tables: metrics, reports, audit logs
└── types/
    └── index.ts             # Generated TypeScript types
```

## Usage Examples

### 1. API Request Validation

```typescript
import { CreateReservationSchema } from '@tartware/schemas/bookings/reservations';
import { Request, Response } from 'express';
import { fromZodError } from 'zod-validation-error';

app.post('/api/reservations', async (req: Request, res: Response) => {
  try {
    // Parse and validate request body
    const validatedData = CreateReservationSchema.parse(req.body);

    // validatedData is fully typed and validated
    const reservation = await db.reservations.create(validatedData);

    res.json(reservation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({
        error: 'Validation failed',
        details: validationError.details
      });
    }
  }
});
```

### 2. Database Query Validation

```typescript
import { GuestSchema } from '@tartware/schemas/core/guests';

const rawGuest = await db.query(
  'SELECT * FROM guests WHERE guest_id = $1',
  [guestId]
);

// Validate database response at runtime
const guest = GuestSchema.parse(rawGuest.rows[0]);

// guest is fully typed: Guest
console.log(guest.email, guest.first_name);
```

### 3. Form Validation (React + React Hook Form)

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateGuestSchema } from '@tartware/schemas/core/guests';

function GuestForm() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(CreateGuestSchema)
  });

  const onSubmit = (data) => {
    // data is fully typed and validated
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      {/* More fields */}
    </form>
  );
}
```

### 4. ENUM Usage

```typescript
import {
  ReservationStatusEnum,
  PaymentMethodEnum,
  RoomStatusEnum
} from '@tartware/schemas/enums';

// Type-safe enum values
type ReservationStatus = z.infer<typeof ReservationStatusEnum>;

// Use in code
const status: ReservationStatus = 'CONFIRMED'; // ✓ Valid
const invalid: ReservationStatus = 'INVALID'; // ✗ TypeScript error

// Runtime validation
ReservationStatusEnum.parse('CONFIRMED'); // ✓ Pass
ReservationStatusEnum.parse('INVALID');   // ✗ Throws ZodError
```

### 5. Partial Updates

```typescript
import { UpdateTenantSchema } from '@tartware/schemas/core/tenants';

// Only validate fields that are present
const updates = UpdateTenantSchema.parse({
  name: 'New Hotel Name',
  status: 'ACTIVE'
  // Other fields are optional
});

await db.tenants.update(tenantId, updates);
```

### 6. Custom Validation with Refinements

```typescript
import { z } from 'zod';
import { uuid } from '@tartware/schemas/base';

const ReservationSchema = z.object({
  reservation_id: uuid,
  check_in_date: z.date(),
  check_out_date: z.date(),
  // ... other fields
}).refine(
  (data) => data.check_out_date > data.check_in_date,
  {
    message: 'Check-out date must be after check-in date',
    path: ['check_out_date']
  }
);
```

## Schema Patterns

### UUID Pattern

```typescript
import { uuid, tenantId } from '@tartware/schemas/base';

// Standard UUID
const userId = uuid.parse('123e4567-e89b-12d3-a456-426614174000');

// Tenant isolation key
const tenant = tenantId.parse('tenant-uuid-here');
```

### Audit Timestamps

```typescript
import { auditTimestamps } from '@tartware/schemas/base';

const MySchema = z.object({
  id: uuid,
  name: z.string(),
  ...auditTimestamps, // created_at, updated_at, created_by, updated_by
});
```

### Soft Delete

```typescript
import { softDelete } from '@tartware/schemas/base';

const MySchema = z.object({
  id: uuid,
  name: z.string(),
  ...softDelete, // deleted_at
});
```

### Money/Currency

```typescript
import { money, percentage } from '@tartware/schemas/base';

const PriceSchema = z.object({
  amount: money,           // Validates 2 decimal places
  discount: percentage,    // Validates 0-100
});
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Build schemas (includes Knip check)
npm run build

# Check for unused files/dependencies
npm run knip

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Type checking
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
```

### Generate Schemas from Database

```bash
# Auto-generate Zod schemas from PostgreSQL
npm run generate

# Check schema synchronization with database
npm run sync-check

# Validate schemas against live database
npm run validate-db
```

## Schema Synchronization

**⚠️ CRITICAL**: Any change to `scripts/` folder MUST be reflected in Zod schemas.

See [Schema Synchronization Protocol](../docs/ZOD_SCHEMA_IMPLEMENTATION_PLAN.md#d-schema-synchronization-protocol) for complete guidelines.

### Quick Checklist

When modifying database:

- [ ] Update SQL script in `scripts/`
- [ ] Update corresponding Zod schema
- [ ] Update ENUMs in `src/shared/enums.ts` if applicable
- [ ] Run tests: `npm test`
- [ ] Build: `npm run build`

## API Reference

See [API Documentation](./docs/API.md) for complete schema reference.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

MIT © Tartware Team

## Links

- [Zod Documentation](https://zod.dev/)
- [Tartware Database Architecture](../docs/database-architecture.md)
- [Implementation Plan](../docs/ZOD_SCHEMA_IMPLEMENTATION_PLAN.md)
