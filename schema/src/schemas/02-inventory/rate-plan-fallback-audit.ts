/**
 * Rate Plan Fallback Audit Schema
 * @table rate_plan_fallback_audit
 * @category 02-inventory
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";

export const RatePlanFallbackAuditSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	reservation_id: uuid.optional(),
	correlation_id: uuid,
	requested_rate_code: z.string().max(50).optional(),
	applied_rate_code: z.string().max(50),
	fallback_reason: z.string().optional(),
	actor: z.string().max(150),
	metadata: jsonbMetadata,
	created_at: z.date(),
});

export type RatePlanFallbackAudit = z.infer<
	typeof RatePlanFallbackAuditSchema
>;

export const CreateRatePlanFallbackAuditSchema =
	RatePlanFallbackAuditSchema.omit({
		id: true,
		created_at: true,
	});
export type CreateRatePlanFallbackAudit = z.infer<
	typeof CreateRatePlanFallbackAuditSchema
>;

export const UpdateRatePlanFallbackAuditSchema =
	RatePlanFallbackAuditSchema.partial().extend({
		id: uuid,
	});
export type UpdateRatePlanFallbackAudit = z.infer<
	typeof UpdateRatePlanFallbackAuditSchema
>;
