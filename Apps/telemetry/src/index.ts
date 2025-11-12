import process from "node:process";

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import pino, {
	type Logger as PinoLogger,
	type LoggerOptions as PinoLoggerOptions,
} from "pino";

type AutoInstrumentationOptions = Parameters<
	typeof getNodeAutoInstrumentations
>[0];

const FALSEY_ENV_VALUES = new Set(["0", "false", "no", "off"]);

const parseBoolean = (
	value: string | undefined,
	defaultValue: boolean,
): boolean => {
	if (value === undefined) {
		return defaultValue;
	}
	return !FALSEY_ENV_VALUES.has(value.toLowerCase());
};

const parseHeaders = (rawHeaders?: string): Record<string, string> => {
	if (!rawHeaders) {
		return {};
	}

	return rawHeaders
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0 && entry.includes("="))
		.reduce<Record<string, string>>((headers, entry) => {
			const [key, ...valueParts] = entry.split("=");
			const value = valueParts.join("=").trim();
			if (!key || !value) {
				return headers;
			}
			headers[key.trim()] = value;
			return headers;
		}, {});
};

const resolveDiagLevel = (level?: string): DiagLogLevel => {
	switch (level?.toLowerCase()) {
		case "all":
			return DiagLogLevel.ALL;
		case "debug":
		case "verbose":
			return DiagLogLevel.DEBUG;
		case "info":
			return DiagLogLevel.INFO;
		case "warn":
			return DiagLogLevel.WARN;
		case "none":
			return DiagLogLevel.NONE;
		default:
			return DiagLogLevel.ERROR;
	}
};

export interface TelemetryOptions {
	serviceName: string;
	serviceVersion?: string;
	environment?: string;
	disableMetrics?: boolean;
	metricIntervalMillis?: number;
	instrumentationOptions?: AutoInstrumentationOptions;
	resourceAttributes?: Record<string, unknown>;
}

export const initTelemetry = async (
	options: TelemetryOptions,
): Promise<NodeSDK | undefined> => {
	if ((process.env.OTEL_SDK_DISABLED ?? "").toLowerCase() === "true") {
		console.info("[telemetry] OTEL_SDK_DISABLED=true. Telemetry disabled.");
		return undefined;
	}

	if (!options?.serviceName) {
		throw new Error("initTelemetry requires a serviceName.");
	}

	diag.setLogger(
		new DiagConsoleLogger(),
		resolveDiagLevel(process.env.OTEL_LOG_LEVEL),
	);

	const metricsEnabled = options.disableMetrics
		? false
		: parseBoolean(process.env.OTEL_METRICS_ENABLED, true);

	const resource = new Resource({
		[SemanticResourceAttributes.SERVICE_NAME]:
			process.env.OTEL_SERVICE_NAME ?? options.serviceName,
		[SemanticResourceAttributes.SERVICE_VERSION]:
			process.env.OTEL_SERVICE_VERSION ??
			options.serviceVersion ??
			process.env.npm_package_version,
		[SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
			process.env.OTEL_ENVIRONMENT ??
			options.environment ??
			process.env.NODE_ENV ??
			"development",
		...options.resourceAttributes,
	});

	const sdk = new NodeSDK({
		resource,
		traceExporter: new OTLPTraceExporter({
			url:
				process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
				process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
			headers: parseHeaders(
				process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS ??
					process.env.OTEL_EXPORTER_OTLP_HEADERS,
			),
		}),
		instrumentations: [
			getNodeAutoInstrumentations(options.instrumentationOptions),
		],
	});

	if (!metricsEnabled) {
		console.info("[telemetry] Metrics export disabled.");
	}

	try {
		await sdk.start();
		console.info(
			`[telemetry] OpenTelemetry SDK started for ${options.serviceName}`,
		);
		return sdk;
	} catch (error) {
		console.error(
			`[telemetry] Failed to start OpenTelemetry SDK for ${options.serviceName}`,
			error,
		);
		return undefined;
	}
};

export type { NodeSDK } from "@opentelemetry/sdk-node";

export interface LoggerOptions {
	serviceName: string;
	level?: string;
	pretty?: boolean;
	environment?: string;
	base?: Record<string, unknown>;
}

const shouldPrettyPrint = (
	requestedPretty: boolean | undefined,
	environment: string | undefined,
): boolean => {
	if (typeof requestedPretty === "boolean") {
		return requestedPretty;
	}

	const resolvedEnvironment = (
		environment ?? process.env.NODE_ENV ?? "development"
	).toLowerCase();

	return resolvedEnvironment !== "production" && Boolean(process.stdout?.isTTY);
};

export const createPinoOptions = (options: LoggerOptions): PinoLoggerOptions => {
	const transport = shouldPrettyPrint(options.pretty, options.environment)
		? {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "SYS:standard",
					singleLine: true,
				},
			}
		: undefined;

	return {
		name: options.serviceName,
		level: options.level ?? "info",
		base: {
			service: options.serviceName,
			...options.base,
		},
		timestamp: pino.stdTimeFunctions.isoTime,
		transport,
	};
};

export const createLogger = (options: LoggerOptions): PinoLogger => {
	return pino(createPinoOptions(options));
};

export type { Logger as PinoLogger } from "pino";
