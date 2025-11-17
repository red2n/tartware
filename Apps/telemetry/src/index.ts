import process from "node:process";
import { createRequire } from 'module';

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
	BatchLogRecordProcessor,
	LoggerProvider,
} from "@opentelemetry/sdk-logs";
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

	const traceEndpoint =
		process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

	if (!traceEndpoint) {
		console.info(
			"[telemetry] No OTLP trace endpoint configured - telemetry disabled.",
		);
		return undefined;
	}

	// Configure log exporter
	const logEndpoint =
		process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

	const loggerProvider = logEndpoint
		? new LoggerProvider({ resource })
		: undefined;

	if (loggerProvider && logEndpoint) {
		loggerProvider.addLogRecordProcessor(
			new BatchLogRecordProcessor(
				new OTLPLogExporter({
					url: logEndpoint,
					headers: parseHeaders(
						process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS ??
							process.env.OTEL_EXPORTER_OTLP_HEADERS,
					),
				}),
			),
		);
		console.info("[telemetry] Log export enabled to", logEndpoint);
	} else {
		console.info("[telemetry] Log export disabled - no endpoint configured");
	}

	const sdk = new NodeSDK({
		resource,
		logRecordProcessor: loggerProvider
			? new BatchLogRecordProcessor(
				  new OTLPLogExporter({
					  url: logEndpoint,
					  headers: parseHeaders(
						  process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS ??
							  process.env.OTEL_EXPORTER_OTLP_HEADERS,
					  ),
				  }),
			  )
			: undefined,
		traceExporter: new OTLPTraceExporter({
			url: traceEndpoint,
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
	const otlpEndpoint =
		process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

	const usePrettyPrint = shouldPrettyPrint(options.pretty, options.environment);

	// Priority: OTLP transport > Pretty print > No transport
	// If OTLP is configured, prefer it — but guard using createRequire to
	// ensure the transport module exists and won't crash the worker thread.
	let transport: any | undefined;
	if (otlpEndpoint) {
		try {
			const _require = createRequire(import.meta.url);
			_require.resolve("pino-opentelemetry-transport");
			transport = {
				target: "pino-opentelemetry-transport",
				options: {
					url: otlpEndpoint,
					resourceAttributes: {
						"service.name": options.serviceName,
						"service.version": options.base?.version,
						"deployment.environment":
							options.environment ??
							process.env.NODE_ENV ??
							"development",
					},
				},
			};
		} catch (err) {
			if (usePrettyPrint) {
				transport = {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "SYS:standard",
						singleLine: true,
					},
				};
			}
		}
	} else if (usePrettyPrint) {
		transport = {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "SYS:standard",
				singleLine: true,
			},
		};
	}
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
