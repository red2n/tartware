import swagger, { type SwaggerOptions } from "@fastify/swagger";
import swaggerUi, { type FastifySwaggerUiOptions } from "@fastify/swagger-ui";
import type {
	FastifyInstance,
	FastifyPluginAsync,
	FastifyRegisterOptions,
} from "fastify";
import fp from "fastify-plugin";

import { gatewayConfig } from "../config.js";

const swaggerPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
	await app.register(
		swagger as unknown as FastifyPluginAsync,
		{
			openapi: {
				info: {
					title: `${gatewayConfig.serviceId} API`,
					description:
						"Gateway routes for core, reservation, and settings APIs.",
					version: gatewayConfig.version ?? "1.0.0",
				},
				servers: [{ url: "/" }],
			},
			mode: "dynamic",
		} as unknown as FastifyRegisterOptions<SwaggerOptions>,
	);

	await app.register(
		swaggerUi as unknown as FastifyPluginAsync,
		{
			routePrefix: "/docs",
			uiConfig: {
				docExpansion: "list",
				deepLinking: false,
			},
			staticCSP: true,
		} as unknown as FastifyRegisterOptions<FastifySwaggerUiOptions>,
	);
};

export default fp(swaggerPlugin);
