/**
 * DEV DOC
 * Module: index.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

/**
 * @tartware/schemas - Main entry point
 * Type-safe Zod schemas for Tartware PMS PostgreSQL database
 *
 * @example
 * ```typescript
 * import { TenantSchema, ReservationSchema } from '@tartware/schemas';
 * import { TenantTypeEnum, ReservationStatusEnum } from '@tartware/schemas/enums';
 * ```
 */

// Re-export all schema categories (will be added as we build them)
export * from "./schemas/01-core/index.js";
export * from "./schemas/02-inventory/index.js";
export * from "./schemas/03-bookings/index.js";
export * from "./schemas/04-financial/index.js";
export * from "./schemas/05-operations/index.js";
export * from "./schemas/06-integrations/index.js";
export * from "./schemas/07-analytics/index.js";
export * from "./schemas/08-settings/index.js";
export * from "./events/availability-guard.js";
export * from "./events/reservations.js";
export * from "./events/commands/index.js";
export * from "./api/index.js";

// Re-export base schemas and validators
export * from "./shared/base-schemas.js";
export * from "./command-validators.js";

// Re-export all ENUMs
export * from "./shared/enums.js";
export * from "./shared/validators.js";

/**
 * Package metadata
 */
export const SCHEMA_VERSION = "0.1.0";
export const SCHEMA_DATE = "2025-12-15";
export const TABLE_COUNT = 160;
