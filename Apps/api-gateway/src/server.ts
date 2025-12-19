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
import { proxyRequest } from "./utils/proxy.js";

const HEALTH_TAG = "Gateway Health";
const RESERVATION_PROXY_TAG = "Reservation Proxy";
const CORE_PROXY_TAG = "Core Proxy";

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
			return proxyRequest(
				request,
				reply,
				serviceTargets.reservationCommandServiceUrl,
			);
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
