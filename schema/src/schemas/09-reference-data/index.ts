/**
 * DEV DOC
 * Module: schemas/09-reference-data/index.ts
 * Description: Reference Data Schemas (Category 09)
 * Category: 09-reference-data
 * Primary exports: Dynamic enum lookup tables for tenant-configurable reference data
 * @table n/a
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * Reference Data Schemas (Category 09)
 * Dynamic lookup tables replacing hardcoded ENUMs
 * for improved adaptability to changing industry standards.
 *
 * Tables: 6
 * - room_status_codes (11 system defaults)
 * - room_categories (10 system defaults)
 * - rate_types (18 system defaults)
 * - payment_methods (30 system defaults)
 * - group_booking_types (15 system defaults)
 * - company_types (16 system defaults)
 *
 * Features:
 * - Multi-tenant aware (tenant_id, property_id scope)
 * - System defaults with is_system flag
 * - Legacy enum mapping for migration path
 * - Behavioral flags for domain logic
 * - Soft delete support
 */

export * from "./company-types.js";
export * from "./group-booking-types.js";
export * from "./payment-methods.js";
export * from "./pet-registrations.js";
export * from "./pet-types.js";
export * from "./rate-types.js";
export * from "./reason-codes.js";
export * from "./room-categories.js";
export * from "./room-status-codes.js";
