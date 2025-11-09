/**
 * Error Handler Plugin
 * Transforms errors into appropriate HTTP responses with user-friendly messages
 */

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

// User-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "You must be logged in to access this resource.",
  TENANT_ROLE_INSUFFICIENT:
    "You don't have permission to access this resource. Admin role is required.",
  TENANT_ACCESS_DENIED: "You don't have access to this tenant.",
  TENANT_ACCESS_INACTIVE: "Your access to this tenant is inactive.",
  TENANT_ID_REQUIRED: "Tenant ID is required for this operation.",
  INVALID_TENANT_ID_FORMAT: "The provided tenant ID format is invalid.",
  USER_NOT_FOUND: "User not found.",
  INVALID_CREDENTIALS: "Invalid username or password.",
  RESOURCE_NOT_FOUND: "The requested resource was not found.",
};

async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
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
      // Use user-friendly message if available, otherwise use original error message
      const userFriendlyMessage = ERROR_MESSAGES[error.message] || error.message;

      return reply.status(error.statusCode).send({
        error: error.name,
        message: userFriendlyMessage,
        code: error.message, // Keep original error code for debugging
        statusCode: error.statusCode,
      });
    }

    // Handle unexpected errors (500)
    return reply.status(500).send({
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "production" ? "An unexpected error occurred" : error.message,
      statusCode: 500,
    });
  });
}

export default fp(errorHandlerPlugin, {
  name: "error-handler",
});
