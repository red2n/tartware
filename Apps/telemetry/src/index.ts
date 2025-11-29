import process from "node:process";
import { createRequire } from "node:module";
import { Writable } from "node:stream";

import {
	diag,
	DiagConsoleLogger,
	DiagLogLevel,
	type Attributes,
} from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
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
import pino, { type Logger as PinoLogger } from "pino";

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

const parseOptionalBoolean = (value?: string): boolean | undefined => {
	if (value === undefined) {
		return undefined;
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

export interface ServiceLoggerOptions {
	serviceName: string;
	levelEnv?: string;
	prettyEnv?: string;
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

type OtelLogStreamOptions = {
	serviceName: string;
};

const mapSeverity = (
	level: unknown,
): { severityText: string; severityNumber: SeverityNumber } => {
	const numeric =
		typeof level === "number" ? level : Number.parseInt(String(level ?? ""), 10);
	switch (numeric) {
		case 10:
			return { severityText: "TRACE", severityNumber: SeverityNumber.TRACE };
		case 20:
			return { severityText: "DEBUG", severityNumber: SeverityNumber.DEBUG };
		case 40:
			return { severityText: "WARN", severityNumber: SeverityNumber.WARN };
		case 50:
			return { severityText: "ERROR", severityNumber: SeverityNumber.ERROR };
		case 60:
			return { severityText: "FATAL", severityNumber: SeverityNumber.FATAL };
		default:
			return { severityText: "INFO", severityNumber: SeverityNumber.INFO };
	}
};

class OtelLogStream extends Writable {
	private readonly otelLogger;

	constructor(private readonly options: OtelLogStreamOptions) {
		super({ objectMode: false });
		this.otelLogger = logs.getLogger(this.options.serviceName);
	}

	override _write(
		chunk: unknown,
		_encoding: BufferEncoding,
		callback: (error?: Error | null) => void,
	): void {
		if (!chunk) {
			callback();
			return;
		}
		const payload =
			typeof chunk === "string"
				? chunk
				: Buffer.isBuffer(chunk)
					? chunk.toString("utf8")
					: String(chunk);
		if (!payload) {
			callback();
			return;
		}

		for (const line of payload.split(/\n+/)) {
			if (!line) {
				continue;
			}
			try {
				const entry = JSON.parse(line) as Record<string, unknown>;
				this.emitRecord(entry);
			} catch {
				// ignore malformed log lines
			}
		}

		callback();
	}

	private emitRecord(entry: Record<string, unknown>): void {
		const { severityNumber, severityText } = mapSeverity(entry.level);
		const attributes: Attributes = {};
		for (const [key, value] of Object.entries(entry)) {
			if (key === "msg" || value === undefined) {
				continue;
			}
			if (
				typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean"
			) {
				attributes[key] = value;
			} else {
				attributes[key] = JSON.stringify(value);
			}
		}

		const body =
			typeof entry.msg === "string"
				? entry.msg
				: entry.msg !== undefined
					? JSON.stringify(entry.msg)
					: "";

		this.otelLogger.emit({
			body,
			severityNumber,
			severityText,
			attributes,
		});
	}
}

const createPrettyStream = () => {
	try {
		const _require = createRequire(import.meta.url);
		const pretty = _require("pino-pretty");
		return pretty({
			colorize: true,
			translateTime: "SYS:standard",
			singleLine: true,
		});
	} catch {
		return pino.destination({ sync: false });
	}
};

export const createLogger = (options: LoggerOptions): PinoLogger => {
	const otlpEndpoint =
		process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

	const usePrettyPrint = shouldPrettyPrint(options.pretty, options.environment);

	const baseOptions = {
		name: options.serviceName,
		level: options.level ?? "info",
		base: {
			service: options.serviceName,
			...options.base,
		},
		timestamp: pino.stdTimeFunctions.isoTime,
	};

	const streams: pino.StreamEntry[] = [];

	if (otlpEndpoint) {
		streams.push({
			level: baseOptions.level as pino.Level,
			stream: new OtelLogStream({ serviceName: options.serviceName }),
		});
	}

	if (usePrettyPrint) {
		streams.push({ stream: createPrettyStream() });
	} else {
		streams.push({ stream: pino.destination({ sync: false }) });
	}

	const [primaryStream] = streams;
	if (streams.length === 1 && primaryStream) {
		return pino(baseOptions, primaryStream.stream);
	}

	return pino(baseOptions, pino.multistream(streams));
};

export const createServiceLogger = (options: ServiceLoggerOptions): PinoLogger => {
	const envLevel = options.levelEnv ? process.env[options.levelEnv] : undefined;
	const envPretty = parseOptionalBoolean(
		options.prettyEnv ? process.env[options.prettyEnv] : undefined,
	);

	return createLogger({
		serviceName: options.serviceName,
		level: envLevel ?? options.level,
		pretty: envPretty ?? options.pretty,
		environment: options.environment ?? process.env.NODE_ENV,
		base: options.base,
	});
};

export type { Logger as PinoLogger } from "pino";
