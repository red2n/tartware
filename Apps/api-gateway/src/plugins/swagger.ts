import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { gatewayConfig } from "../config.js";

const swaggerPlugin = fp(async (app) => {
	await app.register(swagger, {
		openapi: {
			info: {
				title: `${gatewayConfig.serviceId} API`,
				description: "Gateway routes for core, reservation, and settings APIs.",
				version: gatewayConfig.version ?? "1.0.0",
			},
			servers: [{ url: "/" }],
		},
		mode: "dynamic",
	});

	await app.register(swaggerUi, {
		routePrefix: "/docs",
		uiConfig: {
			docExpansion: "list",
			deepLinking: false,
		},
		staticCSP: true,
	});
});

export default swaggerPlugin;
