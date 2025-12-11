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
import { proxyRequest } from "./utils/proxy.js";

export const buildServer = () => {
	const app = fastify({
		logger: gatewayLogger as FastifyBaseLogger,
	});

	app.register(fastifyHelmet, { global: true });
	app.register(fastifySensible);

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

	app.get("/health", async (_request, reply) => {
		allowCorsHeaders(reply);
		return reply.send({
			status: "ok",
			service: gatewayConfig.serviceId,
		});
	});

	app.get("/ready", async (_request, reply) => {
		allowCorsHeaders(reply);
		const targets = [
			{
				name: "core-service",
				url: `${serviceTargets.coreServiceUrl}/health`,
			},
			{
				name: "reservations-command-service",
				url: `${serviceTargets.reservationCommandServiceUrl}/health`,
			},
		];

		const checks = await Promise.all(
			targets.map(async (target) => {
				try {
					const controller = new AbortController();
					const timeout = setTimeout(() => controller.abort(), 2000);
					const response = await fetch(target.url, {
						method: "GET",
						signal: controller.signal,
					});
					clearTimeout(timeout);
					return {
						name: target.name,
						healthy: response.ok,
					};
				} catch {
					return { name: target.name, healthy: false };
				}
			}),
		);

		const unhealthy = checks.filter((check) => !check.healthy);
		if (unhealthy.length > 0) {
			return reply.status(503).send({
				status: "degraded",
				service: gatewayConfig.serviceId,
				unhealthyTargets: unhealthy.map((item) => item.name),
			});
		}

		return reply.send({
			status: "ok",
			service: gatewayConfig.serviceId,
		});
	});

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

	app.all("/v1/tenants/:tenantId/reservations", reservationHandler);
	app.all("/v1/tenants/:tenantId/reservations/*", reservationHandler);

	app.all("/v1/*", async (request: FastifyRequest, reply: FastifyReply) => {
		return proxyRequest(request, reply, serviceTargets.coreServiceUrl);
	});

	return app;
};
