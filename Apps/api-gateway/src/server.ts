import fastifyHelmet from "@fastify/helmet";
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
	type FastifyReply,
	type FastifyRequest,
} from "fastify";

import { gatewayConfig, serviceTargets } from "./config.js";
import { gatewayLogger } from "./logger.js";
import swaggerPlugin from "./plugins/swagger.js";
import { forwardCommandToCommandCenter } from "./utils/command-center-forwarder.js";
import { proxyRequest } from "./utils/proxy.js";

const HEALTH_TAG = "Gateway Health";
const RESERVATION_PROXY_TAG = "Reservation Proxy";
const CORE_PROXY_TAG = "Core Proxy";
const GUESTS_PROXY_TAG = "Guests Proxy";
const BILLING_PROXY_TAG = "Billing Proxy";

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

export const buildServer = () => {
	const app = fastify({
		logger: gatewayLogger as FastifyBaseLogger,
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

	app.register(rateLimit, {
		max: gatewayConfig.rateLimit.max,
		timeWindow: gatewayConfig.rateLimit.timeWindow,
		keyGenerator: (request) =>
			(request.headers["x-api-key"] as string | undefined) ??
			request.ip ??
			"anonymous",
		ban: 0,
	});

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

		app.all(
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

		app.all(
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

		app.all(
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

		app.all(
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

		app.all(
			"/v1/*",
			{
				schema: buildRouteSchema({
					tag: CORE_PROXY_TAG,
					summary: "Proxy remaining v1 routes to the core-service.",
					response: {
						200: jsonObjectSchema,
					},
				}),
			},
			async (request: FastifyRequest, reply: FastifyReply) => {
				return proxyRequest(request, reply, serviceTargets.coreServiceUrl);
			},
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

	await forwardCommandToCommandCenter({
		request,
		reply,
		commandName: "guest.register",
		tenantId,
		payload,
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
	let payload: unknown = request.body ?? {};

	switch (method) {
		case "POST":
			commandName = "reservation.create";
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

	await forwardCommandToCommandCenter({
		request,
		reply,
		commandName,
		tenantId,
		payload,
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
