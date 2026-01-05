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
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import type { Registry } from "prom-client";

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
    enableMetricsEndpoint = true,
    metricsRegistry,
    serverOptions = {},
    requestLoggingOptions,
    beforeRoutes,
    registerRoutes,
  } = options;

  // Build Fastify instance with logger
  const app = Fastify({
    loggerInstance: logger as FastifyBaseLogger,
    disableRequestLogging: !enableRequestLogging,
    ...serverOptions,
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
  app.register(fastifyHelmet, { global: true });
  app.register(fastifyCors, { origin: corsOrigin });

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

  // Register routes as a plugin so decorations from beforeRoutes are available
  if (registerRoutes) {
    app.register(async (instance) => {
      await beforeRoutesTask;
      await registerRoutes(instance);
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

export type { FastifyInstance, FastifyBaseLogger } from "fastify";
