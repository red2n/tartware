/**
 * Shared service bootstrap — eliminates repeated index.ts boilerplate.
 *
 * Every Fastify-based service follows the same start/shutdown lifecycle:
 * 1. Init telemetry
 * 2. Check dependencies (Postgres, Kafka, OTel)
 * 3. Start Kafka consumers (if enabled)
 * 4. Listen on configured port
 * 5. Handle SIGTERM/SIGINT for graceful shutdown
 *
 * This module encapsulates all of that into a single `bootstrapService()` call.
 */
import process from "node:process";
import { ensureDependencies, parseHostPort, resolveOtelDependency } from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";
import type { FastifyInstance } from "fastify";

export type BootstrapServiceInput = {
	/** The Fastify server instance (from buildServer()). */
	app: FastifyInstance;
	/** Minimum config shape required for bootstrap. */
	config: {
		service: { name: string; version: string };
		port: number;
		host: string;
		db: { host: string; port: number };
		kafka: { brokers: string[] };
	};
	/** Kafka consumer start functions. Called in order when Kafka is enabled. */
	consumerStarters?: Array<() => Promise<void>>;
	/** Kafka consumer shutdown functions. Called in order during shutdown. */
	consumerShutdowns?: Array<() => Promise<void>>;
	/** Kafka producer shutdown. Called after consumers during shutdown. */
	shutdownProducer?: () => Promise<void>;
};

/**
 * Bootstrap a Fastify service with telemetry, dependency checks,
 * Kafka consumer lifecycle, and graceful shutdown.
 */
export async function bootstrapService(input: BootstrapServiceInput): Promise<void> {
	const { app, config } = input;
	const proc = process;
	const kafkaEnabled = process.env.DISABLE_KAFKA !== "true";

	const telemetry = await initTelemetry({
		serviceName: config.service.name,
		serviceVersion: config.service.version,
		environment: process.env.NODE_ENV ?? "development",
		instrumentationOptions: {
			"@opentelemetry/instrumentation-fastify": { enabled: true },
			"@opentelemetry/instrumentation-http": { enabled: true },
			"@opentelemetry/instrumentation-pg": { enabled: true },
		},
	});

	const start = async () => {
		try {
			const kafkaBroker = config.kafka.brokers[0];
			const telemetryDependency = resolveOtelDependency(true);
			const dependenciesOk = await ensureDependencies(
				[
					{ name: "PostgreSQL", host: config.db.host, port: config.db.port },
					...(kafkaEnabled && kafkaBroker
						? [{ name: "Kafka broker", ...parseHostPort(kafkaBroker, 9092) }]
						: []),
					...(telemetryDependency ? [telemetryDependency] : []),
				],
				{ logger: app.log },
			);
			if (!dependenciesOk) {
				app.log.warn("Dependencies missing; exiting without starting service");
				await telemetry
					?.shutdown()
					.catch((e: unknown) => app.log.error(e, "Failed to shutdown telemetry"));
				proc?.exit(0);
				return;
			}

			if (kafkaEnabled && input.consumerStarters?.length) {
				for (const starter of input.consumerStarters) {
					await starter();
				}
			} else if (!kafkaEnabled) {
				app.log.warn("Kafka disabled via DISABLE_KAFKA; skipping consumer start");
			}

			await app.listen({ port: config.port, host: config.host });
			app.log.info(
				{
					port: config.port,
					host: config.host,
					environment: process.env.NODE_ENV ?? "development",
				},
				`${config.service.name} started`,
			);
		} catch (error) {
			app.log.error(error, `Failed to start ${config.service.name}`);
			await app.close();
			await telemetry
				?.shutdown()
				.catch((e: unknown) => app.log.error(e, "failed to shutdown telemetry"));
			proc?.exit(1);
		}
	};

	const shutdown = async (signal: NodeJS.Signals) => {
		app.log.info({ signal }, "shutdown signal received");
		try {
			if (kafkaEnabled && input.consumerShutdowns?.length) {
				for (const shutdownFn of input.consumerShutdowns) {
					await shutdownFn();
				}
			}
			if (kafkaEnabled && input.shutdownProducer) {
				await input.shutdownProducer();
			}
			await app.close();
			await telemetry
				?.shutdown()
				.catch((e: unknown) => app.log.error(e, "failed to shutdown telemetry"));
			proc?.exit(0);
		} catch (error) {
			app.log.error(error, "error during shutdown");
			proc?.exit(1);
		}
	};

	process.on("SIGTERM", () => void shutdown("SIGTERM"));
	process.on("SIGINT", () => void shutdown("SIGINT"));

	await start();
}
