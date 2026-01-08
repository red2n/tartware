import { databaseSchema, loadServiceConfig } from "@tartware/config";
import { config as loadEnv } from "dotenv";

loadEnv();

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/api-gateway";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";
process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "local-dev-secret";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "tartware-core";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware";

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

const toNumber = (value: string | undefined, fallback: number): number => {
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}
	return fallback;
};

const toRetryCount = (value: string | undefined, fallback: number): number => {
	if (value === undefined) {
		return fallback;
	}
	const parsed = Number(value);
	if (Number.isNaN(parsed)) {
		return fallback;
	}
	if (parsed < 0) {
		return -1;
	}
	return Math.floor(parsed);
};

const toDelay = (value: string | undefined, fallback: number): number => {
	const parsed = toNumber(value, fallback);
	return Math.max(250, parsed);
};

const parseBrokerList = (
	value: string | undefined,
	fallback?: string,
): string[] =>
	(value ?? fallback ?? "")
		.split(",")
		.map((broker) => broker.trim())
		.filter((broker) => broker.length > 0);

const baseConfig = loadServiceConfig(databaseSchema);
const runtimeEnvironment = (env.NODE_ENV ?? "development").toLowerCase();
const isProduction = runtimeEnvironment === "production";

export const gatewayConfig = {
	port: toNumber(env.API_GATEWAY_PORT, baseConfig.PORT ?? 8080),
	host: env.API_GATEWAY_HOST ?? baseConfig.HOST ?? "0.0.0.0",
	serviceId: env.API_GATEWAY_ID ?? baseConfig.SERVICE_NAME ?? "api-gateway",
	version: env.API_GATEWAY_VERSION ?? baseConfig.SERVICE_VERSION ?? "1.0.0",
	rateLimit: {
		max: Number(env.API_GATEWAY_RATE_MAX ?? 200),
		timeWindow: env.API_GATEWAY_RATE_WINDOW ?? "1 minute",
	},
	logRequests: parseBoolean(env.API_GATEWAY_LOG_REQUESTS, false),
};
export const devToolsConfig = {
	duploDashboard: {
		enabled: parseBoolean(
			env.API_GATEWAY_ENABLE_DUPLO_DASHBOARD,
			!isProduction,
		),
		sharedSecret:
			env.API_GATEWAY_DUPLO_TOKEN && env.API_GATEWAY_DUPLO_TOKEN.length > 0
				? env.API_GATEWAY_DUPLO_TOKEN
				: undefined,
	},
};

export const serviceTargets = {
	coreServiceUrl: env.CORE_SERVICE_URL ?? "http://localhost:3000",
	reservationCommandServiceUrl:
		env.RESERVATION_COMMAND_SERVICE_URL ?? "http://localhost:3101",
	guestsServiceUrl: env.GUESTS_SERVICE_URL ?? "http://localhost:3300",
	roomsServiceUrl: env.ROOMS_SERVICE_URL ?? "http://localhost:3400",
	housekeepingServiceUrl:
		env.HOUSEKEEPING_SERVICE_URL ?? "http://localhost:3500",
	billingServiceUrl: env.BILLING_SERVICE_URL ?? "http://localhost:3600",
};

export const dbConfig = {
	host: baseConfig.DB_HOST,
	port: baseConfig.DB_PORT,
	database: baseConfig.DB_NAME,
	user: baseConfig.DB_USER,
	password: baseConfig.DB_PASSWORD,
	ssl: baseConfig.DB_SSL,
	max: baseConfig.DB_POOL_MAX,
	idleTimeoutMillis: baseConfig.DB_POOL_IDLE_TIMEOUT_MS,
};

export const authConfig = {
	jwt: {
		secret: process.env.AUTH_JWT_SECRET ?? "local-dev-secret",
		issuer: process.env.AUTH_JWT_ISSUER ?? "tartware-core",
		audience: process.env.AUTH_JWT_AUDIENCE ?? "tartware",
	},
};

const primaryKafkaBrokers = parseBrokerList(
	env.KAFKA_BROKERS,
	"localhost:29092",
);
const usedDefaultPrimary = (env.KAFKA_BROKERS ?? "").trim().length === 0;
const failoverKafkaBrokers = parseBrokerList(env.KAFKA_FAILOVER_BROKERS);
const requestedCluster = (env.KAFKA_ACTIVE_CLUSTER ?? "primary").toLowerCase();
const failoverToggle = parseBoolean(env.KAFKA_FAILOVER_ENABLED, false);
const shouldUseFailover =
	(requestedCluster === "failover" || failoverToggle) &&
	failoverKafkaBrokers.length > 0;
const resolvedBrokers =
	shouldUseFailover && failoverKafkaBrokers.length > 0
		? failoverKafkaBrokers
		: primaryKafkaBrokers.length > 0
			? primaryKafkaBrokers
			: failoverKafkaBrokers;
const resolvedCluster =
	resolvedBrokers === failoverKafkaBrokers && resolvedBrokers.length > 0
		? "failover"
		: "primary";

if (primaryKafkaBrokers.length === 0 && failoverKafkaBrokers.length === 0) {
	throw new Error("KAFKA_BROKERS or KAFKA_FAILOVER_BROKERS must be set");
}

if (shouldUseFailover && failoverKafkaBrokers.length === 0) {
	throw new Error(
		"Failover requested/enabled but KAFKA_FAILOVER_BROKERS is empty",
	);
}

if (resolvedCluster === "primary" && primaryKafkaBrokers.length === 0) {
	throw new Error("Primary cluster requested but KAFKA_BROKERS is empty");
}

if (isProduction && usedDefaultPrimary && resolvedCluster === "primary") {
	throw new Error(
		"Production requires explicit KAFKA_BROKERS; default localhost fallback is disabled",
	);
}

export const kafkaConfig = {
	clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-api-gateway",
	primaryBrokers: primaryKafkaBrokers,
	failoverBrokers: failoverKafkaBrokers,
	activeCluster: resolvedCluster,
	brokers: resolvedBrokers,
	commandTopic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
};

export const commandRegistryConfig = {
	refreshIntervalMs: toNumber(env.COMMAND_REGISTRY_REFRESH_MS, 30000),
	startupMaxRetries: toRetryCount(env.COMMAND_REGISTRY_STARTUP_RETRIES, 12),
	startupRetryDelayMs: toDelay(
		env.COMMAND_REGISTRY_STARTUP_RETRY_DELAY_MS,
		5000,
	),
};
