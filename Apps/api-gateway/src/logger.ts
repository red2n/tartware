import type { PinoLogger } from "@tartware/telemetry";
import { createServiceLogger } from "@tartware/telemetry";

import { gatewayConfig } from "./config.js";

export const gatewayLogger: PinoLogger = createServiceLogger({
	serviceName: gatewayConfig.serviceId ?? "api-gateway",
	levelEnv: "API_GATEWAY_LOG_LEVEL",
	prettyEnv: "API_GATEWAY_LOG_PRETTY",
	environment: process.env.NODE_ENV,
});
