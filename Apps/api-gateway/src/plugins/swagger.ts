import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { gatewayConfig } from "../config.js";

const serviceVersion =
	process.env.API_GATEWAY_VERSION ?? process.env.npm_package_version ?? "1.0.0";

const openApiDocument = {
	info: {
		title: `${gatewayConfig.serviceId} API`,
		description:
			"Edge gateway that proxies Tartware PMS requests to the appropriate backend services.",
		version: serviceVersion,
	},
	servers: [{ url: "/" }],
};

const swaggerPlugin = fp(async (app) => {
	await app.register(swagger, {
		openapi: openApiDocument,
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
