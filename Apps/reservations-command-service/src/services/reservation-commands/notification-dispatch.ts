import { randomUUID } from "node:crypto";

import { commandCenterConfig } from "../../config.js";
import { publishEvent } from "../../kafka/producer.js";
import { reservationsLogger } from "../../logger.js";

type WaitlistNotificationInput = {
	tenantId: string;
	guestId: string;
	propertyId: string;
	templateCode: string;
	waitlistId: string;
	roomTypeName?: string;
	arrivalDate?: string;
	departureDate?: string;
	expiresAt?: string;
	correlationId?: string;
};

/**
 * Publish a notification command to the commands.primary Kafka topic.
 * Used by waitlist handlers to notify guests of offer/expiration events.
 */
export const dispatchNotificationCommand = async (
	input: WaitlistNotificationInput,
): Promise<void> => {
	const commandId = randomUUID();
	const issuedAt = new Date().toISOString();

	const envelope = {
		metadata: {
			commandId,
			commandName: "notification.send",
			tenantId: input.tenantId,
			targetService: "notification-service",
			targetTopic: commandCenterConfig.topic,
			issuedAt,
			correlationId: input.correlationId,
			route: { id: "system", source: "internal", tenantId: null },
			initiatedBy: { userId: "00000000-0000-0000-0000-000000000000", role: "SYSTEM" },
			featureStatus: "enabled",
		},
		payload: {
			guest_id: input.guestId,
			property_id: input.propertyId,
			template_code: input.templateCode,
			reservation_id: input.waitlistId,
			idempotency_key: commandId,
			context: {
				waitlist_id: input.waitlistId,
				...(input.roomTypeName ? { room_type: input.roomTypeName } : {}),
				...(input.arrivalDate ? { arrival_date: input.arrivalDate } : {}),
				...(input.departureDate ? { departure_date: input.departureDate } : {}),
				...(input.expiresAt ? { offer_expires_at: input.expiresAt } : {}),
			},
		},
	};

	const headers: Record<string, string> = {
		"x-command-name": "notification.send",
		"x-command-tenant-id": input.tenantId,
		"x-command-request-id": commandId,
		"x-command-target": "notification-service",
	};
	if (input.correlationId) {
		headers["x-correlation-id"] = input.correlationId;
	}

	await publishEvent({
		topic: commandCenterConfig.topic,
		key: commandId,
		value: JSON.stringify(envelope),
		headers,
	});

	reservationsLogger.info(
		{
			commandId,
			templateCode: input.templateCode,
			guestId: input.guestId,
			waitlistId: input.waitlistId,
		},
		"Dispatched waitlist notification command",
	);
};
