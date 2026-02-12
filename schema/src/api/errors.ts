/**
 * DEV DOC
 * Module: api/errors.ts
 * Purpose: Standardized error response schemas for all API services
 * Ownership: Schema package
 *
 * All services must return errors in this shape. Route handlers should use
 * @fastify/sensible httpErrors (reply.notFound(), reply.badRequest(), etc.)
 * which flow through the centralized error handler in @tartware/fastify-server.
 */

import { z } from "zod";

// =====================================================
// STANDARD ERROR RESPONSE
// =====================================================

/**
 * Validation issue detail — used for Zod and Ajv validation errors.
 */
export const ValidationIssueSchema = z.object({
	path: z.string().describe("Dot-separated path to the invalid field"),
	message: z.string().describe("Human-readable validation message"),
	code: z.string().optional().describe("Validation rule code"),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * Standard error response shape for all Tartware API services.
 *
 * Every error response must include `statusCode`, `error`, and `message`.
 * Optional fields: `code` (machine-readable error code), `details` (validation issues).
 */
export const ErrorResponseSchema = z.object({
	statusCode: z
		.number()
		.int()
		.min(400)
		.max(599)
		.describe("HTTP status code"),
	error: z.string().describe("HTTP status text (e.g. 'Not Found', 'Bad Request')"),
	message: z.string().describe("Human-readable error description"),
	code: z.string().optional().describe("Machine-readable error code (e.g. 'RESERVATION_NOT_FOUND')"),
	details: z
		.array(ValidationIssueSchema)
		.optional()
		.describe("Validation issue details (for 400 errors)"),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Not Found (404) error response schema.
 */
export const NotFoundErrorSchema = ErrorResponseSchema.extend({
	statusCode: z.literal(404),
	error: z.literal("Not Found"),
});

/**
 * Bad Request (400) error response schema.
 */
export const BadRequestErrorSchema = ErrorResponseSchema.extend({
	statusCode: z.literal(400),
	error: z.literal("Bad Request"),
});

/**
 * Unauthorized (401) error response schema.
 */
export const UnauthorizedErrorSchema = ErrorResponseSchema.extend({
	statusCode: z.literal(401),
	error: z.literal("Unauthorized"),
});

/**
 * Forbidden (403) error response schema.
 */
export const ForbiddenErrorSchema = ErrorResponseSchema.extend({
	statusCode: z.literal(403),
	error: z.literal("Forbidden"),
});

/**
 * Conflict (409) error response schema.
 */
export const ConflictErrorSchema = ErrorResponseSchema.extend({
	statusCode: z.literal(409),
	error: z.literal("Conflict"),
});

/**
 * Internal Server Error (500) error response schema.
 */
export const InternalServerErrorSchema = ErrorResponseSchema.extend({
	statusCode: z.literal(500),
	error: z.literal("Internal Server Error"),
});
