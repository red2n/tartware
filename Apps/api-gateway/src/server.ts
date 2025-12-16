import fastifyHelmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifySensible from "@fastify/sensible";
import fastify, {
	type FastifyBaseLogger,
	type FastifyReply,
	type FastifyRequest,
} from "fastify";

import { gatewayConfig, serviceTargets } from "./config.js";
import { gatewayLogger } from "./logger.js";
import swaggerPlugin from "./plugins/swagger.js";
import { proxyRequest } from "./utils/proxy.js";

const healthResponseSchema = {
	type: "object",
	properties: {
		status: { type: "string", enum: ["ok"] },
		service: { type: "string" },
	},
	required: ["status", "service"],
	additionalProperties: false,
} as const;

const proxyResponseSchema = {
	description:
		"Proxied response from downstream service. Shape mirrors upstream target.",
	type: "object",
	additionalProperties: true,
} as const;

const reservationProxySchema = {
	tags: ["Reservations"],
	summary:
		"Proxy reservation traffic to the Core or Reservation Command service",
	params: {
		type: "object",
		properties: {
			tenantId: { type: "string", description: "Tenant identifier" },
		},
		required: ["tenantId"],
	},
	response: {
		200: proxyResponseSchema,
		"2xx": proxyResponseSchema,
		"4xx": proxyResponseSchema,
		"5xx": proxyResponseSchema,
	},
} as const;

const catchAllProxySchema = {
	tags: ["Gateway"],
	summary: "Proxy any remaining /v1 requests to the Core Service",
	response: {
		200: proxyResponseSchema,
		"2xx": proxyResponseSchema,
		"4xx": proxyResponseSchema,
		"5xx": proxyResponseSchema,
	},
} as const;

export const buildServer = () => {
	const app = fastify({
		loggerInstance: gatewayLogger as FastifyBaseLogger,
	});

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

	app.after(() => {
		app.addHook("onRequest", async (request, reply) => {
			allowCorsHeaders(reply);
			if (request.method.toUpperCase() === "OPTIONS") {
				return reply.status(204).send();
			}
		});

		app.options("/health", async (_request, reply) => {
			allowCorsHeaders(reply);
			return reply.status(204).send();
		});

		app.get(
			"/health",
			{
				schema: {
					tags: ["Health"],
					summary: "Simple health probe for the API gateway",
					response: {
						200: healthResponseSchema,
					},
				},
			},
			async (_request, reply) => {
				allowCorsHeaders(reply);
				return reply.send({
					status: "ok",
					service: gatewayConfig.serviceId,
				});
			},
		);

		app.all(
			"/v1/tenants/:tenantId/reservations",
			{ schema: reservationProxySchema },
			reservationHandler,
		);
		app.all(
			"/v1/tenants/:tenantId/reservations/*",
			{ schema: reservationProxySchema },
			reservationHandler,
		);

		app.all(
			"/v1/*",
			{ schema: catchAllProxySchema },
			async (request: FastifyRequest, reply: FastifyReply) => {
				return proxyRequest(request, reply, serviceTargets.coreServiceUrl);
			},
		);
	});

	return app;
};
