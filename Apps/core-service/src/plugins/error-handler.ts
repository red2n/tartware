/**
 * Error Handler Plugin
 * Transforms errors into appropriate HTTP responses
 */

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

async function errorHandlerPlugin(
	fastify: FastifyInstance,
): Promise<void> {
	fastify.setErrorHandler(
		(error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
			// Log the error with full context
			request.log.error(
				{
					err: error,
					req: {
						method: request.method,
						url: request.url,
						hostname: request.hostname,
						remoteAddress: request.ip,
					},
					res: { statusCode: reply.statusCode },
				},
				error.message,
			);

			// Handle Zod validation errors
			if (error instanceof ZodError) {
				return reply.status(400).send({
					error: "Bad Request",
					message: "Validation failed",
					statusCode: 400,
					details: error.errors.map((err) => ({
						path: err.path.join("."),
						message: err.message,
						code: err.code,
					})),
				});
			}

			// Handle Fastify validation errors
			if (error.validation) {
				return reply.status(400).send({
					error: "Bad Request",
					message: error.message || "Validation failed",
					statusCode: 400,
					validation: error.validation,
				});
			}

			// Handle known HTTP errors (from @fastify/sensible)
			if (error.statusCode && error.statusCode < 500) {
				return reply.status(error.statusCode).send({
					error: error.name,
					message: error.message,
					statusCode: error.statusCode,
				});
			}

			// Handle unexpected errors (500)
			return reply.status(500).send({
				error: "Internal Server Error",
				message:
					process.env.NODE_ENV === "production"
						? "An unexpected error occurred"
						: error.message,
				statusCode: 500,
			});
		},
	);
}

export default fp(errorHandlerPlugin, {
	name: "error-handler",
});
