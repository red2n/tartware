/**
 * DEV DOC
 * Module: api/errors.ts
 * Purpose: Standardized error response schemas for all API services (RFC 9457)
 * Ownership: Schema package
 *
 * All error responses follow RFC 9457 Problem Details for HTTP APIs.
 * Content-Type: application/problem+json
 *
 * Standard members: type, title, status, detail, instance
 * Extension members: errors (validation details), code (machine-readable)
 *
 * Route handlers should use @fastify/sensible httpErrors (reply.notFound(),
 * reply.badRequest(), etc.) which flow through the centralized error handler
 * in @tartware/fastify-server.
 */

import { z } from "zod";

// =====================================================
// RFC 9457 PROBLEM DETAILS
// =====================================================

/**
 * Validation error detail — used for Zod and Ajv validation errors.
 * Extension member for 400 Bad Request responses.
 */
export const ValidationIssueSchema = z.object({
	path: z.string().describe("Dot-separated path to the invalid field"),
	message: z.string().describe("Human-readable validation message"),
	code: z.string().optional().describe("Validation rule code"),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * RFC 9457 Problem Details response schema for all Tartware API services.
 *
 * Standard members:
 *   - type:     URI reference identifying the problem type (default: "about:blank")
 *   - title:    Short human-readable summary (same for same type)
 *   - status:   HTTP status code
 *   - detail:   Human-readable explanation specific to this occurrence
 *   - instance: URI reference identifying this specific occurrence (request path)
 *
 * Extension members:
 *   - code:     Machine-readable error code (e.g. "RESERVATION_NOT_FOUND")
 *   - errors:   Validation issue details (for 400 errors)
 */
export const ProblemDetailSchema = z.object({
	type: z.string().url().default("about:blank").describe("URI identifying the problem type"),
	title: z.string().describe("Short human-readable summary (e.g. 'Not Found')"),
	status: z.number().int().min(400).max(599).describe("HTTP status code"),
	detail: z.string().describe("Human-readable explanation of the problem"),
	instance: z.string().optional().describe("URI reference for this occurrence (request path)"),
	code: z.string().optional().describe("Machine-readable error code"),
	errors: z
		.array(ValidationIssueSchema)
		.optional()
		.describe("Validation error details (for 400 responses)"),
});

export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

/**
 * Not Found (404) problem detail.
 */
export const NotFoundProblemSchema = ProblemDetailSchema.extend({
	status: z.literal(404),
	title: z.literal("Not Found"),
});

/**
 * Bad Request (400) problem detail.
 */
export const BadRequestProblemSchema = ProblemDetailSchema.extend({
	status: z.literal(400),
	title: z.literal("Bad Request"),
});

/**
 * Unauthorized (401) problem detail.
 */
export const UnauthorizedProblemSchema = ProblemDetailSchema.extend({
	status: z.literal(401),
	title: z.literal("Unauthorized"),
});

/**
 * Forbidden (403) problem detail.
 */
export const ForbiddenProblemSchema = ProblemDetailSchema.extend({
	status: z.literal(403),
	title: z.literal("Forbidden"),
});

/**
 * Conflict (409) problem detail.
 */
export const ConflictProblemSchema = ProblemDetailSchema.extend({
	status: z.literal(409),
	title: z.literal("Conflict"),
});

/**
 * Internal Server Error (500) problem detail.
 */
export const InternalServerErrorProblemSchema = ProblemDetailSchema.extend({
	status: z.literal(500),
	title: z.literal("Internal Server Error"),
});

// =====================================================
// BACKWARD COMPATIBILITY ALIASES
// =====================================================

/** @deprecated Use ProblemDetailSchema instead */
export const ErrorResponseSchema = ProblemDetailSchema;
/** @deprecated Use ProblemDetail instead */
export type ErrorResponse = ProblemDetail;
/** @deprecated Use NotFoundProblemSchema instead */
export const NotFoundErrorSchema = NotFoundProblemSchema;
/** @deprecated Use BadRequestProblemSchema instead */
export const BadRequestErrorSchema = BadRequestProblemSchema;
/** @deprecated Use UnauthorizedProblemSchema instead */
export const UnauthorizedErrorSchema = UnauthorizedProblemSchema;
/** @deprecated Use ForbiddenProblemSchema instead */
export const ForbiddenErrorSchema = ForbiddenProblemSchema;
/** @deprecated Use ConflictProblemSchema instead */
export const ConflictErrorSchema = ConflictProblemSchema;
/** @deprecated Use InternalServerErrorProblemSchema instead */
export const InternalServerErrorSchema = InternalServerErrorProblemSchema;
