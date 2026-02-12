import { randomUUID } from "node:crypto";
import { STATUS_CODES } from "node:http";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import {
	buildSecureRequestLoggingOptions,
	type PinoLogger,
	withRequestLogging,
} from "@tartware/telemetry";
import Fastify, {
	type FastifyBaseLogger,
	type FastifyError,
	type FastifyInstance,
	type FastifyReply,
	type FastifyRequest,
	type FastifyServerOptions,
} from "fastify";
import type { Registry } from "prom-client";

/** Detect ZodError by duck typing to avoid hard zod dependency. */
const isZodError = (
	error: unknown,
): error is Error & {
	errors: Array<{ path: (string | number)[]; message: string; code: string }>;
} =>
	error instanceof Error &&
	error.name === "ZodError" &&
	Array.isArray((error as { errors?: unknown }).errors);

export interface BuildFastifyServerOptions {
	/**
	 * Logger instance to use for the Fastify server
	 */
	logger: PinoLogger;

	/**
	 * Whether to enable request logging
	 * @default true
	 */
	enableRequestLogging?: boolean;

	/**
	 * Whether to enable CORS
	 * @default false (no CORS)
	 */
	corsOrigin?: boolean | string | string[] | RegExp | RegExp[];

	/**
	 * Whether to allow credentials in CORS requests
	 * @default false
	 */
	corsCredentials?: boolean;

	/**
	 * Max age for CORS preflight cache (in seconds)
	 * @default 86400 (24 hours)
	 */
	corsMaxAge?: number;

	/**
	 * Whether to add Cache-Control headers to API responses
	 * @default true
	 */
	enableCacheControl?: boolean;

	/**
	 * Whether to enable the metrics endpoint
	 * @default true
	 */
	enableMetricsEndpoint?: boolean;

	/**
	 * Prometheus metrics registry (required if enableMetricsEndpoint is true)
	 */
	metricsRegistry?: Registry;

	/**
	 * Additional Fastify server options to merge with defaults
	 */
	serverOptions?: Partial<FastifyServerOptions>;

	/**
	 * Request logging options
	 */
	requestLoggingOptions?: {
		includeRequestHeaders?: boolean;
		includeResponseHeaders?: boolean;
		maxDepth?: number;
		sensitiveKeys?: string[];
	};

	/**
	 * Called after basic plugins are registered but before routes
	 * Use this to register custom plugins
	 */
	beforeRoutes?: (app: FastifyInstance) => void | Promise<void>;

	/**
	 * Called inside app.after() to register routes
	 */
	registerRoutes?: (app: FastifyInstance) => void | Promise<void>;
}

/** Content-Type for RFC 9457 Problem Details responses. */
const PROBLEM_JSON = "application/problem+json";

/**
 * Centralized error handler for all services.
 * Produces RFC 9457 Problem Details responses:
 *   { type, title, status, detail, instance?, code?, errors? }
 * Content-Type: application/problem+json
 */
const defaultErrorHandler = (
	error: FastifyError,
	request: FastifyRequest,
	reply: FastifyReply,
): void => {
	request.log.error(
		{ err: error, method: request.method, url: request.url },
		error.message,
	);

	const instance = request.url;

	// Zod validation errors → 400 with structured errors
	if (isZodError(error)) {
		reply
			.status(400)
			.header("content-type", PROBLEM_JSON)
			.send({
				type: "about:blank",
				title: "Bad Request",
				status: 400,
				detail: "Validation failed",
				instance,
				errors: error.errors.map((err) => ({
					path: err.path.join("."),
					message: err.message,
					code: err.code,
				})),
			});
		return;
	}

	// Fastify/Ajv schema validation errors → 400
	if (error.validation) {
		reply
			.status(400)
			.header("content-type", PROBLEM_JSON)
			.send({
				type: "about:blank",
				title: "Bad Request",
				status: 400,
				detail: error.message || "Validation failed",
				instance,
				errors: error.validation.map((v) => ({
					path:
						v.instancePath?.replace(/^\//, "").replace(/\//g, ".") ||
						v.params?.missingProperty ||
						"",
					message: v.message || "Validation error",
					code: v.keyword,
				})),
			});
		return;
	}

	// Known HTTP errors (from @fastify/sensible or statusCode < 500)
	if (error.statusCode && error.statusCode < 500) {
		reply
			.status(error.statusCode)
			.header("content-type", PROBLEM_JSON)
			.send({
				type: "about:blank",
				title: STATUS_CODES[error.statusCode] ?? error.name,
				status: error.statusCode,
				detail: error.message,
				instance,
			});
		return;
	}

	// Unexpected 500 errors — hide details in production
	const statusCode = error.statusCode ?? 500;
	reply
		.status(statusCode)
		.header("content-type", PROBLEM_JSON)
		.send({
			type: "about:blank",
			title: "Internal Server Error",
			status: statusCode,
			detail:
				process.env.NODE_ENV === "production"
					? "An unexpected error occurred"
					: error.message,
			instance,
		});
};

/**
 * Build a standardized Fastify server with common plugins and configuration
 */
export const buildFastifyServer = (
	options: BuildFastifyServerOptions,
): FastifyInstance => {
	const {
		logger,
		enableRequestLogging = true,
		corsOrigin = false,
		corsCredentials = false,
		corsMaxAge = 86400,
		enableCacheControl = true,
		enableMetricsEndpoint = true,
		metricsRegistry,
		serverOptions = {},
		requestLoggingOptions,
		beforeRoutes,
		registerRoutes,
	} = options;

	// Build Fastify instance with logger
	// Use X-Request-Id header if present, otherwise generate a UUID
	const app = Fastify({
		loggerInstance: logger as FastifyBaseLogger,
		disableRequestLogging: !enableRequestLogging,
		requestIdHeader: "x-request-id",
		genReqId: () => randomUUID(),
		...serverOptions,
	});

	// Propagate request ID back in response header for client correlation
	app.addHook("onSend", async (request, reply, payload) => {
		reply.header("X-Request-Id", request.id);
		return payload;
	});

	// Register request logging if enabled
	if (enableRequestLogging) {
		withRequestLogging(
			app,
			buildSecureRequestLoggingOptions(requestLoggingOptions),
		);
	}

	// Register core plugins
	app.register(fastifySensible);

	// Register centralized error handler
	app.setErrorHandler(defaultErrorHandler);

	// Register not-found handler — log at WARN level instead of INFO
	app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
		request.log.warn(
			{ method: request.method, url: request.url },
			`Route ${request.method}:${request.url} not found`,
		);
		reply
			.status(404)
			.header("content-type", PROBLEM_JSON)
			.send({
				type: "about:blank",
				title: "Not Found",
				status: 404,
				detail: `Route ${request.method}:${request.raw.url} not found`,
				instance: request.url,
			});
	});

	// Register Helmet with enhanced security headers
	app.register(fastifyHelmet, {
		global: true,
		// Content Security Policy
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				imgSrc: ["'self'", "data:"],
				connectSrc: ["'self'"],
				fontSrc: ["'self'"],
				objectSrc: ["'none'"],
				frameAncestors: ["'none'"],
				upgradeInsecureRequests: [],
			},
		},
		// Strict Transport Security
		hsts: {
			maxAge: 31536000, // 1 year
			includeSubDomains: true,
			preload: true,
		},
		// X-Frame-Options
		frameguard: { action: "deny" },
		// X-Content-Type-Options
		noSniff: true,
		// Referrer-Policy
		referrerPolicy: { policy: "strict-origin-when-cross-origin" },
		// X-XSS-Protection (legacy but still useful)
		xssFilter: true,
		// X-DNS-Prefetch-Control
		dnsPrefetchControl: { allow: false },
		// X-Download-Options (IE)
		ieNoOpen: true,
		// X-Permitted-Cross-Domain-Policies
		permittedCrossDomainPolicies: { permittedPolicies: "none" },
	});

	// Register CORS with enhanced configuration
	app.register(fastifyCors, {
		origin: corsOrigin,
		credentials: corsCredentials,
		maxAge: corsMaxAge,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"X-Request-Id",
			"X-Tenant-Id",
			"X-Idempotency-Key",
		],
		exposedHeaders: [
			"X-Request-Id",
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset",
		],
	});

	// Add Permissions-Policy header (not covered by helmet)
	app.addHook("onSend", async (_request, reply, payload) => {
		reply.header(
			"Permissions-Policy",
			"geolocation=(), camera=(), microphone=(), payment=(), usb=(), bluetooth=()",
		);
		return payload;
	});

	// Add Cache-Control headers for API responses (exclude health/metrics)
	if (enableCacheControl) {
		app.addHook("onSend", async (request, reply, payload) => {
			const url = request.url;
			// Skip cache headers for health and metrics endpoints
			if (url === "/health" || url === "/metrics" || url === "/ready") {
				return payload;
			}
			reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
			reply.header("Pragma", "no-cache");
			reply.header("Expires", "0");
			return payload;
		});
	}

	// Register metrics endpoint if enabled
	if (enableMetricsEndpoint && metricsRegistry) {
		app.get("/metrics", async (_request, reply) => {
			const body = await metricsRegistry.metrics();
			reply.header("Content-Type", metricsRegistry.contentType).send(body);
		});
	}

	// Call beforeRoutes hook if provided (support async hooks)
	const beforeRoutesTask = beforeRoutes
		? Promise.resolve(beforeRoutes(app))
		: Promise.resolve();

	if (registerRoutes) {
		app.after(async (error) => {
			if (error) {
				throw error;
			}
			await beforeRoutesTask;
			await registerRoutes(app);
		});
	} else if (beforeRoutes) {
		app.after(async (error) => {
			if (error) {
				throw error;
			}
			await beforeRoutesTask;
		});
	}

	return app;
};

/**
 * Helper to track registered routes
 */
export const createRouteTracker = (app: FastifyInstance) => {
	const registeredRoutes = new Map<string, { method: string; url: string }>();

	app.addHook("onRoute", (routeOptions) => {
		const methods = Array.isArray(routeOptions.method)
			? routeOptions.method
			: [routeOptions.method ?? "GET"];

		for (const method of methods) {
			if (typeof method !== "string") {
				continue;
			}

			const normalizedMethod = method.toUpperCase();
			if (normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
				continue;
			}

			const routeKey = `${normalizedMethod} ${routeOptions.url}`;
			registeredRoutes.set(routeKey, {
				method: normalizedMethod,
				url: routeOptions.url,
			});
		}
	});

	return {
		registeredRoutes,
		logRoutes: () => {
			const routeSummaries = Array.from(registeredRoutes.values()).map(
				({ method, url }) => `(${method}) ${url}`,
			);
			app.log.info({ routes: routeSummaries }, "fastify routes registered");
		},
	};
};

export type { FastifyBaseLogger, FastifyInstance } from "fastify";
