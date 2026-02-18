/**
 * DEV DOC
 * Module: schemas/01-core/index.ts
 * Description: Core Foundation Schemas (Category 01)
 * Category: 01-core
 * Primary exports: command-center, guests, properties, property-settings, room-settings, setting-categories, setting-definitions, system-admin-audit-log, system-admin-break-glass-codes, system-administrators, tenant-settings, tenants, transactional-outbox, user-settings, user-tenant-associations, users
 * @table n/a
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * Core Foundation Schemas (Category 01)
 * Multi-tenancy, users, properties, and guests
 *
 * Tables: 12
 * - tenants
 * - users
 * - user_tenant_associations
 * - properties
 * - guests
 * - system_administrators
 * - system_admin_audit_log
 * - transactional_outbox
 * - command_templates
 * - command_routes
 * - command_features
 * - command_dispatches
 */

export * from "./announcements.js";
export * from "./buildings.js";
export * from "./command-center.js";
export * from "./command-idempotency.js";
export * from "./guests.js";
export * from "./meal-periods.js";
export * from "./outlets.js";
export * from "./properties.js";
export * from "./property-events.js";
export * from "./property-feature-flags.js";
export * from "./property-settings.js";
export * from "./room-settings.js";
export * from "./setting-categories.js";
export * from "./setting-definitions.js";
export * from "./system-admin-audit-log.js";
export * from "./system-admin-break-glass-codes.js";
export * from "./system-administrators.js";
export * from "./tenant-settings.js";
export * from "./tenants.js";
export * from "./transactional-outbox.js";
export * from "./user-settings.js";
export * from "./user-tenant-associations.js";
export * from "./users.js";
