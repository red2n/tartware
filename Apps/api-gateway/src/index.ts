import { gatewayConfig } from "./config.js";
import { buildServer } from "./server.js";

const app = buildServer();
const proc = globalThis.process;

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
		proc?.exit(1);
	}
};

if (proc && "on" in proc && typeof proc.on === "function") {
	proc.on("SIGTERM", () => {
		app.log.info("SIGTERM received, shutting down");
		app.close().finally(() => proc.exit(0));
	});
	proc.on("SIGINT", () => {
		app.log.info("SIGINT received, shutting down");
		app.close().finally(() => proc.exit(0));
	});
}

start().catch((error) => {
	app.log.error(error, "Unhandled error during startup");
});
