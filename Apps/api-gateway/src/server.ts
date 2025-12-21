import fastifyHelmet from "@fastify/helmet";
import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import rateLimit from "@fastify/rate-limit";
import fastifySensible from "@fastify/sensible";
import {
	buildRouteSchema,
	type JsonSchema,
	jsonObjectSchema,
} from "@tartware/openapi";
import { withRequestLogging } from "@tartware/telemetry";
import fastify, {
	type FastifyBaseLogger,
	type FastifyPluginAsync,
	type FastifyReply,
	type FastifyRequest,
} from "fastify";

import { gatewayConfig, serviceTargets } from "./config.js";
import { gatewayLogger } from "./logger.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { submitCommand } from "./utils/command-publisher.js";
import { proxyRequest } from "./utils/proxy.js";

const HEALTH_TAG = "Gateway Health";
const RESERVATION_PROXY_TAG = "Reservation Proxy";
const CORE_PROXY_TAG = "Core Proxy";
const GUESTS_PROXY_TAG = "Guests Proxy";
const BILLING_PROXY_TAG = "Billing Proxy";
const HOUSEKEEPING_COMMAND_TAG = "Housekeeping Commands";
const ROOM_COMMAND_TAG = "Room Commands";
const BILLING_COMMAND_TAG = "Billing Commands";

const healthResponseSchema = {
	type: "object",
	properties: {
		status: { type: "string" },
		service: { type: "string" },
	},
	required: ["status", "service"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const reservationParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier for the proxied reservation call.",
		},
	},
	required: ["tenantId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantTaskParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		taskId: {
			type: "string",
			format: "uuid",
			description: "Housekeeping task identifier.",
		},
	},
	required: ["tenantId", "taskId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantRoomParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		roomId: {
			type: "string",
			format: "uuid",
			description: "Room identifier.",
		},
	},
	required: ["tenantId", "roomId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

const tenantPaymentParamsSchema = {
	type: "object",
	properties: {
		tenantId: {
			type: "string",
			format: "uuid",
			description: "Tenant identifier.",
		},
		paymentId: {
			type: "string",
			format: "uuid",
			description: "Payment identifier.",
		},
	},
	required: ["tenantId", "paymentId"],
	additionalProperties: false,
} as const satisfies JsonSchema;

export const buildServer = () => {
	const app = fastify({
		logger: false,
		loggerInstance: gatewayLogger as FastifyBaseLogger,
	});

	if (gatewayConfig.logRequests) {
		withRequestLogging(app, {
			includeBody: false,
			includeParams: true,
			includeRequestHeaders: false,
			includeResponseHeaders: false,
		});
	}

	app.register(fastifyHelmet, { global: true });
	app.register(fastifySensible);
	app.register(swaggerPlugin);
	app.register(authContextPlugin);

	app.register(
		rateLimit as unknown as FastifyPluginAsync,
		{
			max: gatewayConfig.rateLimit.max,
			timeWindow: gatewayConfig.rateLimit.timeWindow,
			keyGenerator: (request: FastifyRequest) =>
				(request.headers["x-api-key"] as string | undefined) ??
				request.ip ??
				"anonymous",
			ban: 0,
		} as unknown as RateLimitPluginOptions,
	);

	app.after(() => {
		const allowCorsHeaders = (reply: FastifyReply): FastifyReply =>
			reply
				.header("Access-Control-Allow-Origin", "*")
				.header(
					"Access-Control-Allow-Methods",
					"GET,POST,PUT,PATCH,DELETE,OPTIONS",
				)
				.header(
					"Access-Control-Allow-Headers",
					"Accept, Authorization, Content-Type, X-Requested-With, DNT, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform",
				)
				.header("Access-Control-Max-Age", "600");

		app.addHook("onRequest", async (request, reply) => {
			allowCorsHeaders(reply);
			if (request.method.toUpperCase() === "OPTIONS") {
				return reply.status(204).send();
			}
		});

		app.options(
			"/health",
			{
				schema: {
					tags: [HEALTH_TAG],
					summary: "Pre-flight health request (CORS).",
					hide: true,
					response: {
						204: {
							type: "null",
							description: "CORS pre-flight acknowledgement.",
						},
					},
				},
			},
			async (_request, reply) => {
				allowCorsHeaders(reply);
				return reply.status(204).send();
			},
		);

		app.get(
			"/health",
			{
				schema: buildRouteSchema({
					tag: HEALTH_TAG,
					summary: "API gateway health status.",
					response: {
						200: healthResponseSchema,
					},
				}),
			},
			async (_request, reply) => {
				allowCorsHeaders(reply);
				return reply.send({
					status: "ok",
					service: gatewayConfig.serviceId,
				});
			},
		);

		app.get(
			"/ready",
			{
				schema: buildRouteSchema({
					tag: HEALTH_TAG,
					summary: "API gateway readiness status.",
					response: {
						200: healthResponseSchema,
					},
				}),
			},
			async (_request, reply) => {
				allowCorsHeaders(reply);
				return reply.send({
					status: "ok",
					service: gatewayConfig.serviceId,
				});
			},
		);

		const reservationHandler = async (
			request: FastifyRequest,
			reply: FastifyReply,
		) => {
			if (request.method.toUpperCase() === "GET") {
				return proxyRequest(request, reply, serviceTargets.coreServiceUrl);
			}
			return forwardReservationCommand(request, reply);
		};

		app.all(
			"/v1/tenants/:tenantId/reservations",
			{
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Proxy tenant reservation requests to the backing services.",
					params: reservationParamsSchema,
					response: {
						200: jsonObjectSchema,
						201: jsonObjectSchema,
						202: jsonObjectSchema,
					},
				}),
			},
			reservationHandler,
		);

		app.all(
			"/v1/tenants/:tenantId/reservations/*",
			{
				schema: buildRouteSchema({
					tag: RESERVATION_PROXY_TAG,
					summary: "Proxy nested reservation resource calls.",
					params: reservationParamsSchema,
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			reservationHandler,
		);

		const proxyGuests = async (request: FastifyRequest, reply: FastifyReply) =>
			proxyRequest(request, reply, serviceTargets.guestsServiceUrl);

		const proxyRooms = async (request: FastifyRequest, reply: FastifyReply) =>
			proxyRequest(request, reply, serviceTargets.roomsServiceUrl);

		const proxyHousekeeping = async (
			request: FastifyRequest,
			reply: FastifyReply,
		) => proxyRequest(request, reply, serviceTargets.housekeepingServiceUrl);

		const proxyBilling = async (request: FastifyRequest, reply: FastifyReply) =>
			proxyRequest(request, reply, serviceTargets.billingServiceUrl);

		app.get(
			"/v1/guests",
			{
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Proxy guest queries to the guests service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyGuests,
		);

		app.post(
			"/v1/guests",
			{
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary:
						"Submit guest creation requests via the Command Center command pipeline.",
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardGuestRegisterCommand,
		);

		app.post(
			"/v1/guests/merge",
			{
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Merge duplicate guests via the Command Center pipeline.",
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardGuestMergeCommand,
		);

		app.get(
			"/v1/guests/*",
			{
				schema: buildRouteSchema({
					tag: GUESTS_PROXY_TAG,
					summary: "Proxy nested guest routes to the guests service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyGuests,
		);

		app.get(
			"/v1/rooms",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy room queries to the rooms service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.post(
			"/v1/tenants/:tenantId/rooms/:roomId/block",
			{
				schema: buildRouteSchema({
					tag: ROOM_COMMAND_TAG,
					summary: "Block a room's inventory via the Command Center.",
					params: tenantRoomParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardRoomInventoryCommand({
					request,
					reply,
					action: "block",
				}),
		);

		app.post(
			"/v1/tenants/:tenantId/rooms/:roomId/release",
			{
				schema: buildRouteSchema({
					tag: ROOM_COMMAND_TAG,
					summary: "Release a manual room block via the Command Center.",
					params: tenantRoomParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			(request, reply) =>
				forwardRoomInventoryCommand({
					request,
					reply,
					action: "release",
				}),
		);

		app.get(
			"/v1/rooms/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy nested room routes to the rooms service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyRooms,
		);

		app.get(
			"/v1/housekeeping/tasks",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary:
						"Proxy housekeeping task queries to the housekeeping service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyHousekeeping,
		);

		app.post(
			"/v1/tenants/:tenantId/housekeeping/tasks/:taskId/assign",
			{
				schema: buildRouteSchema({
					tag: HOUSEKEEPING_COMMAND_TAG,
					summary: "Assign a housekeeping task via the Command Center.",
					params: tenantTaskParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardHousekeepingAssignCommand,
		);

		app.post(
			"/v1/tenants/:tenantId/housekeeping/tasks/:taskId/complete",
			{
				schema: buildRouteSchema({
					tag: HOUSEKEEPING_COMMAND_TAG,
					summary: "Complete a housekeeping task via the Command Center.",
					params: tenantTaskParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardHousekeepingCompleteCommand,
		);

		app.get(
			"/v1/billing/payments",
			{
				schema: buildRouteSchema({
					tag: BILLING_PROXY_TAG,
					summary: "Proxy billing payment requests to the billing service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyBilling,
		);

		app.post(
			"/v1/tenants/:tenantId/billing/payments/capture",
			{
				schema: buildRouteSchema({
					tag: BILLING_COMMAND_TAG,
					summary: "Capture a payment via the Command Center.",
					params: reservationParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardBillingCaptureCommand,
		);

		app.post(
			"/v1/tenants/:tenantId/billing/payments/:paymentId/refund",
			{
				schema: buildRouteSchema({
					tag: BILLING_COMMAND_TAG,
					summary: "Refund a payment via the Command Center.",
					params: tenantPaymentParamsSchema,
					body: jsonObjectSchema,
					response: {
						202: jsonObjectSchema,
					},
				}),
			},
			forwardBillingRefundCommand,
		);

		app.get(
			"/v1/billing/*",
			{
				schema: buildRouteSchema({
					tag: BILLING_PROXY_TAG,
					summary: "Proxy nested billing routes to the billing service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyBilling,
		);

		app.get(
			"/v1/housekeeping/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy nested housekeeping routes to the service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			proxyHousekeeping,
		);
	});

	return app;
};
const forwardGuestRegisterCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const body = toPlainObject(request.body);
	if (!body) {
		reply.badRequest("GUEST_PAYLOAD_REQUIRED");
		return;
	}

	const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
	if (!tenantId) {
		reply.badRequest("TENANT_ID_REQUIRED");
		return;
	}

	const payload = { ...body };
	delete payload.tenant_id;

	await submitCommand({
		request,
		reply,
		commandName: "guest.register",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardGuestMergeCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const body = toPlainObject(request.body);
	if (!body) {
		reply.badRequest("GUEST_MERGE_PAYLOAD_REQUIRED");
		return;
	}
	const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
	if (!tenantId) {
		reply.badRequest("TENANT_ID_REQUIRED");
		return;
	}
	if (
		typeof body.primary_guest_id !== "string" ||
		typeof body.duplicate_guest_id !== "string"
	) {
		reply.badRequest("PRIMARY_AND_DUPLICATE_GUEST_IDS_REQUIRED");
		return;
	}
	const payload = { ...body };
	delete payload.tenant_id;

	await submitCommand({
		request,
		reply,
		commandName: "guest.merge",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardReservationCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;

	if (!tenantId) {
		reply.badRequest("TENANT_ID_REQUIRED");
		return;
	}

	const method = request.method.toUpperCase();
	let commandName: string;
	let payload: Record<string, unknown> = normalizePayloadObject(request.body);

	switch (method) {
		case "POST":
			commandName = "reservation.create";
			payload = normalizePayloadObject(request.body);
			break;
		case "PUT":
		case "PATCH":
			commandName = "reservation.modify";
			payload = normalizePayloadObject(request.body);
			break;
		case "DELETE":
			commandName = "reservation.cancel";
			payload = normalizePayloadObject(request.body);
			break;
		default:
			reply.status(405).send({
				error: "METHOD_NOT_ALLOWED",
				message: `Method ${method} is not supported for reservation commands`,
			});
			return;
	}

	if (commandName !== "reservation.create") {
		const reservationId = extractReservationId(params);
		if (!reservationId) {
			reply.badRequest("RESERVATION_ID_REQUIRED");
			return;
		}
		const payloadObject = payload as Record<string, unknown>;
		if (!payloadObject.reservation_id) {
			payloadObject.reservation_id = reservationId;
		}
		payload = payloadObject;
	}

	await submitCommand({
		request,
		reply,
		commandName,
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const normalizePayloadObject = (body: unknown): Record<string, unknown> => {
	if (body && typeof body === "object" && !Array.isArray(body)) {
		return { ...(body as Record<string, unknown>) };
	}
	if (body === undefined || body === null) {
		return {};
	}
	return { value: body };
};

const toPlainObject = (value: unknown): Record<string, unknown> | null => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return { ...(value as Record<string, unknown>) };
	}
	return null;
};

const extractReservationId = (
	params: Record<string, unknown>,
): string | null => {
	const direct = params.reservationId;
	if (typeof direct === "string" && direct.length > 0) {
		return direct;
	}
	const wildcard = params["*"];
	if (typeof wildcard === "string" && wildcard.length > 0) {
		return wildcard.split("/")[0] ?? null;
	}
	return null;
};

const forwardHousekeepingAssignCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	const taskId = typeof params.taskId === "string" ? params.taskId : null;
	if (!tenantId || !taskId) {
		reply.badRequest("TENANT_AND_TASK_ID_REQUIRED");
		return;
	}

	const body = normalizePayloadObject(request.body);
	if (typeof body.assigned_to !== "string" || body.assigned_to.length === 0) {
		reply.badRequest("ASSIGNED_TO_REQUIRED");
		return;
	}

	const payload = { ...body, task_id: taskId };
	await submitCommand({
		request,
		reply,
		commandName: "housekeeping.task.assign",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardHousekeepingCompleteCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	const taskId = typeof params.taskId === "string" ? params.taskId : null;
	if (!tenantId || !taskId) {
		reply.badRequest("TENANT_AND_TASK_ID_REQUIRED");
		return;
	}
	const payload = { ...normalizePayloadObject(request.body), task_id: taskId };
	await submitCommand({
		request,
		reply,
		commandName: "housekeeping.task.complete",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardRoomInventoryCommand = async ({
	request,
	reply,
	action,
}: {
	request: FastifyRequest;
	reply: FastifyReply;
	action: "block" | "release";
}): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	const roomId = typeof params.roomId === "string" ? params.roomId : null;
	if (!tenantId || !roomId) {
		reply.badRequest("TENANT_AND_ROOM_ID_REQUIRED");
		return;
	}
	const payload = {
		...normalizePayloadObject(request.body),
		room_id: roomId,
		action,
	};
	await submitCommand({
		request,
		reply,
		commandName: "rooms.inventory.block",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardBillingCaptureCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	if (!tenantId) {
		reply.badRequest("TENANT_ID_REQUIRED");
		return;
	}
	const payload = normalizePayloadObject(request.body);
	if (!payload) {
		reply.badRequest("BILLING_CAPTURE_PAYLOAD_REQUIRED");
		return;
	}
	await submitCommand({
		request,
		reply,
		commandName: "billing.payment.capture",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};

const forwardBillingRefundCommand = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const params = (request.params ?? {}) as Record<string, unknown>;
	const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
	const paymentId =
		typeof params.paymentId === "string" ? params.paymentId : null;
	if (!tenantId || !paymentId) {
		reply.badRequest("TENANT_AND_PAYMENT_ID_REQUIRED");
		return;
	}
	const body = normalizePayloadObject(request.body);
	const payload = { ...body, payment_id: paymentId };
	await submitCommand({
		request,
		reply,
		commandName: "billing.payment.refund",
		tenantId,
		payload,
		requiredRole: "MANAGER",
		requiredModules: "core",
	});
};
