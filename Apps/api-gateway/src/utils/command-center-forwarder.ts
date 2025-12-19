import { randomUUID } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { gatewayLogger } from "../logger.js";

type ForwardCommandOptions = {
	request: FastifyRequest;
	reply: FastifyReply;
	commandName: string;
	tenantId: string;
	payload: unknown;
};

const logger = gatewayLogger.child({ module: "command-center-proxy" });

export const forwardCommandToCommandCenter = async ({
	request,
	reply,
	commandName,
	tenantId,
	payload,
}: ForwardCommandOptions): Promise<void> => {
	const endpoint = new URL(
		`/v1/commands/${encodeURIComponent(commandName)}/execute`,
		serviceTargets.commandCenterServiceUrl,
	).toString();

	const correlationId =
		(request.headers["x-correlation-id"] as string | undefined) ?? undefined;

	const initiatedByUserId = request.headers["x-user-id"];
	const initiatedByRole =
		(request.headers["x-user-role"] as string | undefined) ?? undefined;

	const commandBody: Record<string, unknown> = {
		tenant_id: tenantId,
		payload,
	};

	if (correlationId) {
		commandBody.correlation_id = correlationId;
	}

	if (initiatedByUserId && typeof initiatedByUserId === "string") {
		commandBody.metadata = {
			initiated_by: {
				user_id: initiatedByUserId,
				role: initiatedByRole ?? "UNKNOWN",
			},
		};
	}

	const headers = new Headers();
	const authHeader = request.headers.authorization;
	if (typeof authHeader === "string") {
		headers.set("authorization", authHeader);
	}

	const requestId =
		(request.headers["x-request-id"] as string | undefined) ?? randomUUID();
	headers.set("x-request-id", requestId);
	headers.set("content-type", "application/json");

	let response: Response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(commandBody),
		});
	} catch (error) {
		logger.error(
			{ err: error, endpoint, commandName, tenantId },
			"failed to reach command center",
		);
		reply.status(502).send({
			error: "COMMAND_CENTER_UNAVAILABLE",
			message: "Unable to submit command to the Command Center.",
		});
		return;
	}

	const responseText = await response.text();
	const contentType =
		response.headers.get("content-type") ?? "application/json";

	reply.header("content-type", contentType);
	reply.status(response.status);

	try {
		const json = JSON.parse(responseText);
		reply.send(json);
	} catch {
		reply.send(responseText);
	}
};
