import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

export interface SwaggerPluginOptions {
	/** Service title displayed in Swagger UI */
	title: string;
	/** Service description */
	description: string;
	/** API version string */
	version: string;
	/** Route prefix for Swagger UI (default: "/docs") */
	routePrefix?: string;
}

/**
 * Create a standardized Swagger plugin for a Tartware service.
 * Wraps in `fp()` for proper Fastify encapsulation.
 * Respects `DISABLE_SWAGGER=true` environment variable.
 */
export const createSwaggerPlugin = (options: SwaggerPluginOptions) => {
	const { title, description, version, routePrefix = "/docs" } = options;

	return fp(async (app) => {
		if (process.env.DISABLE_SWAGGER === "true") {
			app.log.warn("Swagger UI disabled via DISABLE_SWAGGER");
			return;
		}

		await app.register(swagger as never, {
			openapi: {
				info: {
					title,
					version,
					description,
				},
				servers: [{ url: "/" }],
			},
			mode: "dynamic",
		});

		await app.register(swaggerUi as never, {
			routePrefix,
			uiConfig: {
				docExpansion: "list",
				deepLinking: false,
			},
			staticCSP: true,
		});
	});
};
