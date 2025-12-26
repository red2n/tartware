import { randomUUID } from "node:crypto";

import {
	BillingPaymentCaptureCommandSchema,
	BillingPaymentRefundCommandSchema,
} from "@tartware/schemas/events/commands/billing";
import {
	GuestMergeCommandSchema,
	GuestRegisterCommandSchema,
} from "@tartware/schemas/events/commands/guests";
import {
	HousekeepingAssignCommandSchema,
	HousekeepingCompleteCommandSchema,
} from "@tartware/schemas/events/commands/housekeeping";
import {
	InventoryBulkReleaseCommandSchema,
	InventoryLockRoomCommandSchema,
	InventoryReleaseRoomCommandSchema,
} from "@tartware/schemas/events/commands/inventory";
import {
	ReservationCancelCommandSchema,
	ReservationCreateCommandSchema,
	ReservationModifyCommandSchema,
} from "@tartware/schemas/events/commands/reservations";
import { RoomInventoryBlockCommandSchema } from "@tartware/schemas/events/commands/rooms";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import {
	type AcceptedCommand,
	acceptCommand,
	CommandDispatchError,
	markCommandDelivered,
	markCommandFailed,
} from "../command-center/index.js";
import { kafkaConfig } from "../config.js";
import { publishRecord } from "../kafka/producer.js";
import { gatewayLogger } from "../logger.js";
import type { TenantMembership } from "../services/membership-service.js";

const logger = gatewayLogger.child({ module: "command-publisher" });

type SubmitCommandOptions = {
	request: FastifyRequest;
	reply: FastifyReply;
	commandName: string;
	tenantId: string;
	payload: Record<string, unknown>;
	requiredRole?: TenantMembership["role"];
	requiredModules?: string | string[];
};

const ensureTenantAccess = (
	request: FastifyRequest,
	reply: FastifyReply,
	tenantId: string,
	options: {
		minRole?: TenantMembership["role"];
		requiredModules?: string | string[];
	} = {},
): TenantMembership | null => {
	if (!request.auth.isAuthenticated) {
		reply.unauthorized("AUTHENTICATION_REQUIRED");
		return null;
	}

	const membership = request.auth.getMembership(tenantId);
	if (!membership) {
		reply.forbidden("TENANT_ACCESS_DENIED");
		return null;
	}

	if (options.minRole && !request.auth.hasRole(tenantId, options.minRole)) {
		reply.forbidden("TENANT_ROLE_INSUFFICIENT");
		return null;
	}

	const modules = Array.isArray(options.requiredModules)
		? options.requiredModules
		: options.requiredModules
			? [options.requiredModules]
			: [];
	if (modules.length > 0) {
		const enabled = new Set(membership.modules);
		const missing = modules.filter((moduleId) => !enabled.has(moduleId));
		if (missing.length > 0) {
			reply.forbidden("TENANT_MODULE_NOT_ENABLED");
			return null;
		}
	}

	return membership;
};

type CommandPayloadValidator = (
	payload: Record<string, unknown>,
) => Record<string, unknown>;

const commandPayloadValidators = new Map<string, CommandPayloadValidator>([
	[
		"billing.payment.capture",
		(payload) => BillingPaymentCaptureCommandSchema.parse(payload),
	],
	[
		"billing.payment.refund",
		(payload) => BillingPaymentRefundCommandSchema.parse(payload),
	],
	["guest.register", (payload) => GuestRegisterCommandSchema.parse(payload)],
	["guest.merge", (payload) => GuestMergeCommandSchema.parse(payload)],
	[
		"housekeeping.task.assign",
		(payload) => HousekeepingAssignCommandSchema.parse(payload),
	],
	[
		"housekeeping.task.complete",
		(payload) => HousekeepingCompleteCommandSchema.parse(payload),
	],
	[
		"inventory.lock.room",
		(payload) => InventoryLockRoomCommandSchema.parse(payload),
	],
	[
		"inventory.release.room",
		(payload) => InventoryReleaseRoomCommandSchema.parse(payload),
	],
	[
		"inventory.release.bulk",
		(payload) => InventoryBulkReleaseCommandSchema.parse(payload),
	],
	[
		"reservation.create",
		(payload) => ReservationCreateCommandSchema.parse(payload),
	],
	[
		"reservation.modify",
		(payload) => ReservationModifyCommandSchema.parse(payload),
	],
	[
		"reservation.cancel",
		(payload) => ReservationCancelCommandSchema.parse(payload),
	],
	[
		"rooms.inventory.block",
		(payload) => RoomInventoryBlockCommandSchema.parse(payload),
	],
]);

const validateCommandPayload = (
	commandName: string,
	payload: Record<string, unknown>,
): Record<string, unknown> => {
	const validator = commandPayloadValidators.get(commandName);
	return validator ? validator(payload) : payload;
};

export const submitCommand = async ({
	request,
	reply,
	commandName,
	tenantId,
	payload,
	requiredRole = "MANAGER",
	requiredModules,
}: SubmitCommandOptions): Promise<void> => {
	const membership = ensureTenantAccess(request, reply, tenantId, {
		minRole: requiredRole,
		requiredModules,
	});

	if (!membership) {
		return;
	}

	let validatedPayload: Record<string, unknown>;
	try {
		validatedPayload = validateCommandPayload(commandName, payload);
	} catch (error) {
		if (error instanceof ZodError) {
			reply.status(400).send({
				error: "COMMAND_PAYLOAD_INVALID",
				message: `${commandName} payload failed validation`,
				issues: error.issues,
			});
			return;
		}
		throw error;
	}

	const correlationId =
		(request.headers["x-correlation-id"] as string | undefined) ?? undefined;
	const requestId =
		(request.headers["x-request-id"] as string | undefined) ?? randomUUID();
	const initiatedBy =
		request.auth.userId && membership
			? { userId: request.auth.userId, role: membership.role }
			: null;

	let acceptance: AcceptedCommand;
	try {
		acceptance = await acceptCommand({
			commandName,
			tenantId,
			payload: validatedPayload,
			correlationId,
			requestId,
			initiatedBy,
			membership,
		});
	} catch (error) {
		if (error instanceof CommandDispatchError) {
			reply.status(error.statusCode).send({
				error: error.code,
				message: error.message,
			});
			return;
		}
		throw error;
	}

	try {
		await publishRecord({
			topic: acceptance.envelope.targetTopic ?? kafkaConfig.commandTopic,
			messages: [
				{
					key: acceptance.commandId,
					value: JSON.stringify({
						metadata: acceptance.envelope.metadata,
						payload: acceptance.envelope.payload,
					}),
					headers: acceptance.envelope.headers,
				},
			],
		});
		await markCommandDelivered(acceptance.outboxEventId);
	} catch (error) {
		await markCommandFailed(acceptance.outboxEventId, error).catch(
			(failureError) => {
				logger.error(
					{
						err: failureError,
						commandId: acceptance.commandId,
					},
					"failed to mark command failure",
				);
			},
		);
		logger.error(
			{
				err: error,
				commandId: acceptance.commandId,
				commandName: acceptance.commandName,
			},
			"failed to publish command",
		);
		reply.status(502).send({
			error: "COMMAND_DISPATCH_FAILED",
			message: "Unable to publish command to Kafka.",
		});
		return;
	}

	reply.status(202).send({
		status: acceptance.status,
		commandId: acceptance.commandId,
		commandName: acceptance.commandName,
		tenantId: acceptance.tenantId,
		correlationId: acceptance.correlationId,
		targetService: acceptance.targetService,
		requestedAt: acceptance.requestedAt,
	});
};
