import process from "node:process";

import { initTelemetry } from "@tartware/telemetry";

import {
	shutdownCommandRegistry,
	startCommandRegistry,
} from "./command-center/index.js";
import { gatewayConfig } from "./config.js";
import { shutdownProducer, startProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";

const telemetry = await initTelemetry({
	serviceName: gatewayConfig.serviceId ?? "api-gateway",
	instrumentationOptions: {
		"@opentelemetry/instrumentation-fastify": {
			enabled: true,
		},
		"@opentelemetry/instrumentation-http": {
			enabled: true,
		},
	},
});
const app = buildServer();
const proc = process;
let isShuttingDown = false;

const start = async () => {
	try {
		await startCommandRegistry();
		await startProducer();
		await app.listen({ port: gatewayConfig.port, host: gatewayConfig.host });
		app.log.info(
			{
				service: gatewayConfig.serviceId,
				port: gatewayConfig.port,
				host: gatewayConfig.host,
			},
			"API gateway listening",
		);
	} catch (error) {
		app.log.error(error, "Failed to start API gateway");
		await app.close();
		await shutdownProducer().catch((producerError: unknown) =>
			app.log.error(producerError, "Failed to shutdown Kafka producer"),
		);
		await shutdownCommandRegistry().catch((registryError: unknown) =>
			app.log.error(registryError, "Failed to shutdown command registry"),
		);
		await telemetry
			?.shutdown()
			.catch((telemetryError: unknown) =>
				app.log.error(
					telemetryError,
					"Failed to shutdown telemetry after startup failure",
				),
			);
		proc?.exit(1);
	}
};

if (proc && "on" in proc && typeof proc.on === "function") {
	proc.on("SIGTERM", () => {
		if (isShuttingDown) {
			app.log.info("Shutdown already in progress (SIGTERM)");
			return;
		}
		isShuttingDown = true;
		app.log.info("SIGTERM received, shutting down");
		app
			.close()
			.catch((error: unknown) =>
				app.log.error(error, "Error while shutting down server (SIGTERM)"),
			)
			.finally(async () => {
				await Promise.allSettled([
					shutdownProducer().catch((error: unknown) =>
						app.log.error(error, "Error while shutting down Kafka producer"),
					),
					shutdownCommandRegistry().catch((error: unknown) =>
						app.log.error(error, "Error while shutting down command registry"),
					),
					telemetry
						?.shutdown()
						.catch((error: unknown) =>
							app.log.error(error, "Error while shutting down telemetry"),
						),
				]);
				proc.exit(0);
			});
	});
	proc.on("SIGINT", () => {
		if (isShuttingDown) {
			app.log.info("Shutdown already in progress (SIGINT)");
			return;
		}
		isShuttingDown = true;
		app.log.info("SIGINT received, shutting down");
		app
			.close()
			.catch((error: unknown) =>
				app.log.error(error, "Error while shutting down server (SIGINT)"),
			)
			.finally(async () => {
				await Promise.allSettled([
					shutdownProducer().catch((error: unknown) =>
						app.log.error(error, "Error while shutting down Kafka producer"),
					),
					shutdownCommandRegistry().catch((error: unknown) =>
						app.log.error(error, "Error while shutting down command registry"),
					),
					telemetry
						?.shutdown()
						.catch((error: unknown) =>
							app.log.error(error, "Error while shutting down telemetry"),
						),
				]);
				proc.exit(0);
			});
	});
}

start().catch((error: unknown) => {
	app.log.error(error, "Unhandled error during startup");
	void Promise.allSettled([
		shutdownProducer().catch((producerError: unknown) =>
			app.log.error(producerError, "Failed to shutdown Kafka producer"),
		),
		shutdownCommandRegistry().catch((registryError: unknown) =>
			app.log.error(registryError, "Failed to shutdown command registry"),
		),
		telemetry
			?.shutdown()
			.catch((telemetryError: unknown) =>
				app.log.error(
					telemetryError,
					"Failed to shutdown telemetry after error",
				),
			),
	]);
});
