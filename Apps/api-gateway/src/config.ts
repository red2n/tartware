import { config as loadEnv } from "dotenv";

loadEnv();

const env = process.env;

export const gatewayConfig = {
	port: Number(env.API_GATEWAY_PORT ?? 8080),
	host: env.API_GATEWAY_HOST ?? "0.0.0.0",
	serviceId: env.API_GATEWAY_ID ?? "api-gateway",
	rateLimit: {
		max: Number(env.API_GATEWAY_RATE_MAX ?? 200),
		timeWindow: env.API_GATEWAY_RATE_WINDOW ?? "1 minute",
	},
};

export const serviceTargets = {
	coreServiceUrl: env.CORE_SERVICE_URL ?? "http://localhost:3000",
	reservationCommandServiceUrl:
		env.RESERVATION_COMMAND_SERVICE_URL ?? "http://localhost:3101",
};
