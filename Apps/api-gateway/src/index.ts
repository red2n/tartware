import process from "node:process";

import { initTelemetry } from "@tartware/telemetry";

import { gatewayConfig } from "./config.js";
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
		await telemetry
			?.shutdown()
			.catch((telemetryError) =>
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
			.catch((error) =>
				app.log.error(error, "Error while shutting down server (SIGTERM)"),
			)
			.finally(() =>
				telemetry
					?.shutdown()
					.catch((error) =>
						app.log.error(error, "Error while shutting down telemetry"),
					)
					.finally(() => proc.exit(0)),
			);
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
			.catch((error) =>
				app.log.error(error, "Error while shutting down server (SIGINT)"),
			)
			.finally(() =>
				telemetry
					?.shutdown()
					.catch((error) =>
						app.log.error(error, "Error while shutting down telemetry"),
					)
					.finally(() => proc.exit(0)),
			);
	});
}

start().catch((error) => {
	app.log.error(error, "Unhandled error during startup");
	telemetry?.shutdown().catch((telemetryError) => {
		app.log.error(telemetryError, "Failed to shutdown telemetry after error");
	});
});
