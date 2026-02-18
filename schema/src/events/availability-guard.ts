/**
 * DEV DOC
 * Module: events/availability-guard.ts
 * Purpose: Availability Guard event schemas for Kafka consumers
 * Ownership: Schema package
 */

import { z } from "zod";

// -----------------------------------------------------------------------------
// Manual Release Notification Schemas
// -----------------------------------------------------------------------------

/**
 * Actor information for manual release notifications.
 */
export const ManualReleaseActorSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	email: z.string().email().nullable().optional(),
});

export type ManualReleaseActor = z.infer<typeof ManualReleaseActorSchema>;

/**
 * Manual release notification event schema.
 * Published when a lock is manually released by an operator.
 */
export const ManualReleaseNotificationSchema = z.object({
	type: z.literal("availability_guard.manual_release"),
	sentAt: z.string(),
	lockId: z.string().min(1),
	tenantId: z.string().min(1),
	reservationId: z.string().min(1).nullable().optional(),
	roomTypeId: z.string().min(1),
	roomId: z.string().min(1).nullable().optional(),
	stayStart: z.string(),
	stayEnd: z.string(),
	reason: z.string().min(1),
	actor: ManualReleaseActorSchema,
	recipients: z.array(z.string().min(1)),
});

export type ManualReleaseNotification = z.infer<
	typeof ManualReleaseNotificationSchema
>;
