/**
 * Per-deployment configuration for the guest portal.
 * In production, these would be injected at build time or loaded from a config endpoint.
 * For local dev, they match the seed data from scripts/tables/.
 */
export const portalConfig = {
	tenantId: "11111111-1111-1111-1111-111111111111",
	propertyId: "22222222-2222-2222-2222-222222222222",
} as const;
