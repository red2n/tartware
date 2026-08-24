/// <reference types="@fastify/sensible" />
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
import {
	type MeshIdentityOptions,
	meshIdentityOptionsFromEnv,
	meshIdentityPlugin,
} from "./mesh-identity.js";
import { startServiceRegistration } from "./registry-client.js";

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
	 * Additional CORS allowed request headers (merged with the defaults).
	 */
	corsAllowedHeaders?: string[];

	/**
	 * Additional CORS exposed response headers (merged with the defaults).
	 */
	corsExposedHeaders?: string[];

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

	/**
	 * Service registry configuration for auto-registration.
	 * When provided, the server registers with the service registry on ready
	 * and deregisters on close, with periodic heartbeats.
	 */
	serviceRegistry?: {
		registryUrl: string;
		serviceName: string;
		serviceVersion: string;
		host: string;
		port: number;
		displayName?: string;
		description?: string;
	};

	/**
	 * Mesh caller-identity verification — rejects callers whose mTLS peer
	 * identity is not on the allowlist.
	 *
	 * Defaults to reading `MESH_IDENTITY_ENFORCEMENT` and
	 * `MESH_ALLOWED_PRINCIPALS` from the environment, which means it is off
	 * unless a deployment turns it on. Pass an explicit object to override.
	 *
	 * @see ./mesh-identity.ts
	 */
	meshIdentity?: MeshIdentityOptions;
}

/** Content-Type for RFC 9457 Problem Details responses. */
const PROBLEM_JSON = "application/problem+json";

/**
 * Whether the caller wants full error detail (stack, cause chain, zod issues)
 * attached to client-error records. Driven entirely by LOG_LEVEL: set it to
 * `debug` or `trace` and 4xx records carry the same `err` object 5xx always has.
 *
 * Fastify types `request.log` as a Pick<> of pino's BaseLogger that omits
 * isLevelEnabled, so probe for it and fall back to comparing the level string.
 */
const wantsErrorDetail = (log: FastifyBaseLogger): boolean => {
	const maybePino = log as unknown as {
		isLevelEnabled?: (level: string) => boolean;
	};
	if (typeof maybePino.isLevelEnabled === "function") {
		return maybePino.isLevelEnabled("debug");
	}
	return log.level === "debug" || log.level === "trace";
};

/** Status this error will be answered with — mirrors the reply branches below. */
const resolveStatusCode = (error: FastifyError): number => {
	if (isZodError(error) || error.validation) {
		return 400;
	}
	return error.statusCode ?? 500;
};

/** Flatten Ajv/zod issues into one compact "path: message" line each. */
const formatValidationIssues = (error: FastifyError): string[] | undefined => {
	if (isZodError(error)) {
		return error.errors.map(
			(issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
		);
	}
	if (error.validation) {
		return error.validation.map((issue) => {
			const path =
				issue.instancePath?.replace(/^\//, "").replace(/\//g, ".") ||
				issue.params?.missingProperty ||
				"(root)";
			return `${path}: ${issue.message ?? "validation error"}`;
		});
	}
	return undefined;
};

/**
 * Log a failed request once, at a level that reflects whose fault it is.
 *
 * 4xx is expected traffic — a malformed payload or a booking conflict is the
 * caller's problem, not a service fault — so it logs at warn with no stack,
 * keeping `error` meaningful as an alerting signal. 5xx always logs at error
 * with the full serialized error. LOG_LEVEL=debug restores full detail on 4xx.
 */
const logRequestError = (
	error: FastifyError,
	request: FastifyRequest,
	statusCode: number,
): void => {
	const payload: Record<string, unknown> = {
		method: request.method,
		url: request.url,
		statusCode,
	};

	if (statusCode >= 500) {
		payload.err = error;
		request.log.error(payload, error.message);
		return;
	}

	if (wantsErrorDetail(request.log)) {
		payload.err = error;
	}

	const validation = formatValidationIssues(error);
	if (validation) {
		payload.validation = validation;
		// ZodError.message is a multi-line JSON dump of every issue — never use it
		// as the log message; `validation` above carries the same facts on one line.
		request.log.warn(payload, "request validation failed");
		return;
	}

	request.log.warn(payload, error.message);
};

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
	const resolvedStatus = resolveStatusCode(error);
	logRequestError(error, request, resolvedStatus);

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
	reply
		.status(resolvedStatus)
		.header("content-type", PROBLEM_JSON)
		.send({
			type: "about:blank",
			title: "Internal Server Error",
			status: resolvedStatus,
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
		corsAllowedHeaders: extraAllowedHeaders = [],
		corsExposedHeaders: extraExposedHeaders = [],
		enableCacheControl = true,
		enableMetricsEndpoint = true,
		metricsRegistry,
		serverOptions = {},
		requestLoggingOptions,
		beforeRoutes,
		registerRoutes,
		serviceRegistry,
		meshIdentity,
	} = options;

	// Build Fastify instance with logger
	// Use X-Request-Id header if present, otherwise generate a UUID
	const app = Fastify({
		loggerInstance: logger as FastifyBaseLogger,
		requestIdHeader: "x-request-id",
		genReqId: () => randomUUID(),
		...serverOptions,
		// Must be last — withRequestLogging (telemetry) handles request/response
		// logging. This must not be overrideable by serverOptions or it produces
		// two "request completed" log lines per request (2× log volume at 20K ops/sec).
		disableRequestLogging: true,
	});

	// Propagate request ID back in response header for client correlation
	app.addHook("onSend", async (request, reply, payload) => {
		reply.header("X-Request-Id", request.id);
		return payload;
	});

	// Register request logging if enabled
	if (enableRequestLogging) {
		const baseOptions = buildSecureRequestLoggingOptions(requestLoggingOptions);
		withRequestLogging(app, {
			...baseOptions,
			skip: (request) => {
				const path = request.raw.url?.split("?")[0] ?? "";
				return (
					path === "/metrics" ||
					path === "/health" ||
					path === "/ready" ||
					(baseOptions.skip?.(request) ?? false)
				);
			},
		});
	}

	// Register core plugins
	app.register(fastifySensible);

	// Verify the caller's mesh identity before any route logic runs.
	// No-op unless MESH_IDENTITY_ENFORCEMENT is set to warn/enforce, so this
	// changes nothing for local development or non-mesh deployments.
	const meshIdentityOptions = meshIdentity ?? meshIdentityOptionsFromEnv();
	if (meshIdentityOptions.enforcement !== "off") {
		app.register(meshIdentityPlugin, meshIdentityOptions);
	}

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
			...extraAllowedHeaders,
		],
		exposedHeaders: [
			"X-Request-Id",
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset",
			...extraExposedHeaders,
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
		app.get("/metrics", { logLevel: "silent" }, async (_request, reply) => {
			const body = await metricsRegistry.metrics();
			return reply
				.header("Content-Type", metricsRegistry.contentType)
				.send(body);
		});
	}

	// Register beforeRoutes and registerRoutes inside app.after()
	// to ensure all core plugins (Helmet, CORS, sensible) are fully initialized first.
	// beforeRoutes registers plugins (e.g. tenant-auth) whose decorators must be ready
	// before registerRoutes runs, so they go in separate app.after() blocks.
	if (beforeRoutes) {
		app.after(async (error) => {
			if (error) {
				throw error;
			}
			await beforeRoutes(app);
		});
	}

	if (registerRoutes) {
		app.after(async (error) => {
			if (error) {
				throw error;
			}
			await registerRoutes(app);
		});
	}

	// Auto-register with service registry.
	// Only registers when REGISTRY_URL is explicitly set or serviceRegistry option is provided.
	const registryUrl = process.env.REGISTRY_URL;
	const registryPort = Number(process.env.PORT) || 0;
	const registryConfig =
		serviceRegistry ??
		(registryUrl && registryPort
			? {
					registryUrl,
					serviceName: process.env.SERVICE_NAME ?? "unknown",
					serviceVersion: process.env.SERVICE_VERSION ?? "0.0.0",
					host: process.env.HOST ?? "localhost",
					port: registryPort,
					displayName: process.env.SERVICE_DISPLAY_NAME,
					description: process.env.SERVICE_DESCRIPTION,
				}
			: undefined);

	if (registryConfig?.registryUrl) {
		let registration: { stop: () => Promise<void> } | undefined;

		app.addHook("onReady", async () => {
			registration = startServiceRegistration(registryConfig, logger);
		});

		app.addHook("onClose", async () => {
			await registration?.stop();
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

// Re-export @fastify/sensible types so consumers pick up the FastifyReply augmentations
// (.unauthorized, .forbidden, .notFound, etc.) without needing to import sensible directly.
export type { HttpError, HttpErrors } from "@fastify/sensible";
export type { FastifyBaseLogger, FastifyInstance } from "fastify";
export { type BootstrapServiceInput, bootstrapService } from "./bootstrap.js";
export type { CreateHealthRoutesOptions, HealthDependency } from "./health.js";
export { createHealthRoutes } from "./health.js";
export type {
	MeshIdentityEnforcement,
	MeshIdentityOptions,
} from "./mesh-identity.js";
export {
	meshIdentityOptionsFromEnv,
	meshIdentityPlugin,
	parseClientCertPrincipals,
} from "./mesh-identity.js";
export { sseTokenPromotePlugin } from "./sse-token.js";
