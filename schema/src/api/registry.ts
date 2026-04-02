/**
 * DEV DOC
 * Module: api/registry.ts
 * Purpose: Service registry API schemas and service metadata catalog
 * Ownership: Schema package
 */

import { z } from "zod";

export const ServiceRegistryTagEnum = z.enum([
  "api-gateway",
  "availability-guard-service",
  "billing-service",
  "command-center-service",
  "core-service",
  "finance-admin-service",
  "guests-service",
  "housekeeping-service",
  "reservations-command-service",
  "rooms-service",
]);
export type ServiceRegistryTag = z.infer<typeof ServiceRegistryTagEnum>;

export const ServiceRegistryMetadataSchema = z.object({
  serviceName: z.string().min(1),
  description: z.string().min(1),
  tag: ServiceRegistryTagEnum,
});
export type ServiceRegistryMetadata = z.infer<typeof ServiceRegistryMetadataSchema>;

export const SERVICE_REGISTRY_CATALOG = {
  "api-gateway": {
    serviceName: "Gateway API",
    description:
      "Unified Tartware ingress API for authentication, rate limiting, routing, and cross-service composition.",
    tag: "api-gateway",
  },
  "availability-guard-service": {
    serviceName: "Availability Guard API",
    description:
      "Inventory protection service that manages reservation locks and guards against oversell scenarios.",
    tag: "availability-guard-service",
  },
  "billing-service": {
    serviceName: "Billing API",
    description:
      "Financial operations API for folios, payments, invoices, adjustments, and hosted cashier workflows.",
    tag: "billing-service",
  },
  "command-center-service": {
    serviceName: "Command Center API",
    description:
      "Command orchestration API for dispatch, service discovery, and operational roll coordination.",
    tag: "command-center-service",
  },
  "core-service": {
    serviceName: "Core Operations API",
    description:
      "Primary Tartware API for tenant administration, authentication, dashboards, reports, and hosted settings.",
    tag: "core-service",
  },
  "finance-admin-service": {
    serviceName: "Finance Admin API",
    description:
      "Back-office finance API for accounts, revenue management, pricing, and financial reporting.",
    tag: "finance-admin-service",
  },
  "guests-service": {
    serviceName: "Guest Services API",
    description:
      "Guest-facing and staff-facing API for profiles, loyalty, self-service journeys, and notifications.",
    tag: "guests-service",
  },
  "housekeeping-service": {
    serviceName: "Housekeeping API",
    description:
      "Operations API for housekeeping, maintenance, inspections, incidents, and lost-and-found workflows.",
    tag: "housekeeping-service",
  },
  "reservations-command-service": {
    serviceName: "Reservation Commands API",
    description:
      "Asynchronous write API that processes reservation commands, lifecycle tracking, and outbox publishing.",
    tag: "reservations-command-service",
  },
  "rooms-service": {
    serviceName: "Rooms & Rates API",
    description:
      "Inventory API for rooms, room types, rates, rate calendars, and hosted recommendation/calculation modules.",
    tag: "rooms-service",
  },
} as const satisfies Record<ServiceRegistryTag, ServiceRegistryMetadata>;

export const ServiceRegistryRegisterRequestSchema = z.object({
  name: ServiceRegistryTagEnum,
  display_name: z.string().min(1),
  description: z.string().min(1),
  tag: ServiceRegistryTagEnum,
  version: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});
export type ServiceRegistryRegisterRequest = z.infer<
  typeof ServiceRegistryRegisterRequestSchema
>;

export const ServiceRegistryHeartbeatRequestSchema = z.object({
  name: ServiceRegistryTagEnum,
  port: z.number().int().positive(),
});
export type ServiceRegistryHeartbeatRequest = z.infer<
  typeof ServiceRegistryHeartbeatRequestSchema
>;

export const ServiceRegistryDeregisterRequestSchema =
  ServiceRegistryHeartbeatRequestSchema;
export type ServiceRegistryDeregisterRequest = z.infer<
  typeof ServiceRegistryDeregisterRequestSchema
>;

export const ServiceRegistryInstanceSchema = z.object({
  instanceId: z.string(),
  name: ServiceRegistryTagEnum,
  display_name: z.string().min(1),
  description: z.string().min(1),
  tag: ServiceRegistryTagEnum,
  version: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
  status: z.enum(["UP", "DOWN"]),
  registeredAt: z.string(),
  lastHeartbeat: z.string(),
  metadata: z.record(z.unknown()).optional(),
});
export type ServiceRegistryInstance = z.infer<typeof ServiceRegistryInstanceSchema>;

export const ServiceRegistrySummarySchema = z.object({
  total: z.number().int().nonnegative(),
  up: z.number().int().nonnegative(),
  down: z.number().int().nonnegative(),
});
export type ServiceRegistrySummary = z.infer<typeof ServiceRegistrySummarySchema>;

export const ServiceRegistryServicesResponseSchema = z.object({
  services: z.array(ServiceRegistryInstanceSchema),
  summary: ServiceRegistrySummarySchema,
});
export type ServiceRegistryServicesResponse = z.infer<
  typeof ServiceRegistryServicesResponseSchema
>;

export const ServiceRegistryServiceInstancesResponseSchema = z.object({
  name: ServiceRegistryTagEnum,
  instances: z.array(ServiceRegistryInstanceSchema),
});
export type ServiceRegistryServiceInstancesResponse = z.infer<
  typeof ServiceRegistryServiceInstancesResponseSchema
>;
