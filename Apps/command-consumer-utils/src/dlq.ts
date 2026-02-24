import type { CommandEnvelope } from "./index.js";

type BuildDlqPayloadInput = {
	envelope?: CommandEnvelope;
	rawValue: string;
	topic: string;
	partition: number;
	offset: string;
	attempts: number;
	failureReason: "PARSING_ERROR" | "HANDLER_FAILURE";
	error: unknown;
};

/**
 * Standard DLQ payload builder used by all command center consumers.
 */
export const buildDlqPayload = (input: BuildDlqPayloadInput) => {
	const error =
		input.error instanceof Error
			? { name: input.error.name, message: input.error.message }
			: { name: "Error", message: String(input.error) };

	return {
		metadata: {
			failureReason: input.failureReason,
			attempts: input.attempts,
			topic: input.topic,
			partition: input.partition,
			offset: input.offset,
			commandId: input.envelope?.metadata?.commandId,
			commandName: input.envelope?.metadata?.commandName,
			tenantId: input.envelope?.metadata?.tenantId,
			requestId: input.envelope?.metadata?.requestId,
			targetService: input.envelope?.metadata?.targetService,
		},
		error,
		payload: input.envelope?.payload ?? null,
		raw: input.rawValue,
		emittedAt: new Date().toISOString(),
	};
};
