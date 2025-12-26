import {
	CommandDispatchError,
	createCommandDispatchService,
	type AcceptCommandInput as SharedAcceptCommandInput,
} from "@tartware/command-center-shared";

import { gatewayLogger } from "../logger.js";
import type { TenantMembership } from "../services/membership-service.js";

import { resolveCommandForTenant } from "./command-registry.js";
import {
	enqueueOutboxRecord,
	markOutboxDelivered,
	markOutboxFailed,
} from "./outbox.js";
import {
	insertCommandDispatch,
	updateCommandDispatchStatus,
} from "./sql/command-dispatches.js";

type CommandEnvelope = {
	metadata: Record<string, unknown>;
	payload: Record<string, unknown>;
	headers: Record<string, string>;
	targetTopic: string;
};

type AcceptCommandInput = SharedAcceptCommandInput<TenantMembership>;

export type AcceptedCommand = {
	status: "accepted";
	commandId: string;
	commandName: string;
	tenantId: string;
	correlationId?: string;
	targetService: string;
	requestedAt: string;
	outboxEventId: string;
	envelope: CommandEnvelope;
};

const logger = gatewayLogger.child({ module: "command-dispatch" });
const COMMAND_OUTBOX_RETRY_BACKOFF_MS = Number(
	process.env.COMMAND_OUTBOX_RETRY_BACKOFF_MS ?? 1000,
);
const COMMAND_OUTBOX_MAX_RETRIES = Number(
	process.env.COMMAND_OUTBOX_MAX_RETRIES ?? 5,
);

const { acceptCommand: acceptCommandInternal } =
	createCommandDispatchService<TenantMembership>({
		resolveCommandForTenant,
		enqueueOutboxRecord,
		insertCommandDispatch,
	});

export const acceptCommand = async (
	input: AcceptCommandInput,
): Promise<AcceptedCommand> => {
	const result = await acceptCommandInternal(input);

	return {
		status: "accepted",
		commandId: result.commandId,
		commandName: result.commandName,
		tenantId: result.tenantId,
		correlationId: result.correlationId,
		targetService: result.targetService,
		requestedAt: result.issuedAt,
		outboxEventId: result.commandId,
		envelope: {
			metadata: result.eventPayload.metadata,
			payload: result.eventPayload.payload,
			headers: result.headers,
			targetTopic: result.targetTopic,
		},
	};
};

export { CommandDispatchError };

export const markCommandDelivered = async (
	outboxEventId: string,
): Promise<void> => {
	await Promise.all([
		markOutboxDelivered(outboxEventId).catch((error) => {
			logger.error(
				{ outboxEventId, err: error },
				"failed to mark outbox delivered",
			);
			throw error;
		}),
		updateCommandDispatchStatus(outboxEventId, "PUBLISHED"),
	]);
};

export const markCommandFailed = async (
	outboxEventId: string,
	error: unknown,
): Promise<void> => {
	await Promise.all([
		markOutboxFailed(
			outboxEventId,
			error ?? new Error("command publish failed"),
			COMMAND_OUTBOX_RETRY_BACKOFF_MS,
			COMMAND_OUTBOX_MAX_RETRIES,
		).catch((failureError) => {
			logger.error(
				{ outboxEventId, err: failureError },
				"failed to mark outbox failed",
			);
			throw error;
		}),
		updateCommandDispatchStatus(outboxEventId, "FAILED"),
	]);
};
