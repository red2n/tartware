import { config as loadEnv } from "dotenv";

loadEnv();

const env = process.env;

const parseBoolean = (
	value: string | undefined,
	fallback: boolean,
): boolean => {
	if (value === undefined) {
		return fallback;
	}
	return !["0", "false", "no", "off"].includes(value.toLowerCase());
};

export const gatewayConfig = {
	port: Number(env.API_GATEWAY_PORT ?? 8080),
	host: env.API_GATEWAY_HOST ?? "0.0.0.0",
	serviceId: env.API_GATEWAY_ID ?? "api-gateway",
	version: env.API_GATEWAY_VERSION ?? "1.0.0",
	rateLimit: {
		max: Number(env.API_GATEWAY_RATE_MAX ?? 200),
		timeWindow: env.API_GATEWAY_RATE_WINDOW ?? "1 minute",
	},
	logRequests: parseBoolean(env.API_GATEWAY_LOG_REQUESTS, false),
};

export const serviceTargets = {
	coreServiceUrl: env.CORE_SERVICE_URL ?? "http://localhost:3000",
	reservationCommandServiceUrl:
		env.RESERVATION_COMMAND_SERVICE_URL ?? "http://localhost:3101",
	guestsServiceUrl: env.GUESTS_SERVICE_URL ?? "http://localhost:3300",
};
