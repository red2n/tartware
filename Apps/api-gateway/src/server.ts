import fastifyHelmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifySensible from "@fastify/sensible";
import fastify, { type FastifyReply, type FastifyRequest } from "fastify";

import { gatewayConfig, serviceTargets } from "./config.js";
import { proxyRequest } from "./utils/proxy.js";

export const buildServer = () => {
	const app = fastify({
		logger: {
			transport:
				process.env.NODE_ENV === "production"
					? undefined
					: {
							target: "pino-pretty",
							options: { colorize: true },
						},
		},
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

	app.get("/health", async () => ({
		status: "ok",
		service: gatewayConfig.serviceId,
	}));

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
