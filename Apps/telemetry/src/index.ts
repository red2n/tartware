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
import type { FastifyReply, FastifyRequest } from "fastify";
import pino, { type Logger as PinoLogger } from "pino";

type RedactObject = {
	paths?: string[];
	censor?: unknown;
	remove?: boolean;
	[key: string]: unknown;
};

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

export const DEFAULT_SENSITIVE_LOG_KEYS = Object.freeze([
	"password",
	"current_password",
	"new_password",
	"passcode",
	"token",
	"email",
	"emailaddress",
	"primaryemail",
	"guestemail",
	"billingemail",
	"phone",
	"id_number",
	"idnumber",
	"passport_number",
	"passportnumber",
	"ssn",
	"tax_id",
	"taxid",
	"national_id",
	"nationalid",
	"drivers_license",
	"driverslicense",
	"payment_reference",
	"paymentmethod",
	"payment_token",
	"paymenttoken",
	"paymentidentifier",
	"routing_number",
	"routingnumber",
	"account_number",
	"accountnumber",
	"card_number",
	"cardnumber",
	"cardtoken",
	"cardholder",
	"cvv",
	"authorization",
	"devicefingerprint",
	"device_fingerprint",
]);

export const DEFAULT_LOG_REDACT_PATHS = Object.freeze([
	"req.headers",
	"request.headers",
	"res.headers",
	"response.headers",
	"req.body",
	"request.body",
	"res.body",
	"response.body",
	"req.query",
	"request.query",
	"req.params",
	"request.params",
	...DEFAULT_SENSITIVE_LOG_KEYS.map((key) => `*.${key}`),
]);

export const DEFAULT_LOG_REDACT_CENSOR = "[REDACTED]" as const;

export const DEFAULT_LOG_REDACT_CONFIG = Object.freeze({
	paths: DEFAULT_LOG_REDACT_PATHS,
	censor: DEFAULT_LOG_REDACT_CENSOR,
});

const buildSensitiveKeySet = (keys?: string[]): Set<string> => {
	const merged = new Set(DEFAULT_SENSITIVE_LOG_KEYS.map((key) => key.toLowerCase()));
	if (Array.isArray(keys)) {
		for (const key of keys) {
			if (typeof key === "string" && key.trim().length > 0) {
				merged.add(key.toLowerCase());
			}
		}
	}
	return merged;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (value === null || typeof value !== "object") {
		return false;
	}
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

const EMAIL_REGEX =
	/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?:\.[A-Z]{2,})?/i;
const PASSPORT_REGEX = /\b[CFGHJKLMNPRTVWXYZ][0-9]{7,8}\b/i;
const IBAN_REGEX = /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}\b/;

const normalizeDigits = (value: string): string => value.replace(/\D/g, "");

const looksLikeCardNumber = (value: string): boolean => {
	const digitsOnly = normalizeDigits(value);
	if (digitsOnly.length < 13 || digitsOnly.length > 19) {
		return false;
	}

	let sum = 0;
	let shouldDouble = false;

	for (let index = digitsOnly.length - 1; index >= 0; index -= 1) {
		let digit = Number(digitsOnly[index]);
		if (Number.isNaN(digit)) {
			return false;
		}

		if (shouldDouble) {
			digit *= 2;
			if (digit > 9) {
				digit -= 9;
			}
		}

		sum += digit;
		shouldDouble = !shouldDouble;
	}

	return sum % 10 === 0;
};

type SensitiveValueTester = (value: string) => boolean;

const DEFAULT_SENSITIVE_VALUE_TESTERS: ReadonlyArray<SensitiveValueTester> = [
	(value) => EMAIL_REGEX.test(value),
	(value) => looksLikeCardNumber(value),
	(value) => PASSPORT_REGEX.test(value),
	(value) => IBAN_REGEX.test(value),
];

const buildValueTesterList = (
	additional?: SensitiveValueTester[],
): SensitiveValueTester[] => {
	const testers = [...DEFAULT_SENSITIVE_VALUE_TESTERS];
	if (Array.isArray(additional)) {
		for (const tester of additional) {
			if (typeof tester === "function") {
				testers.push(tester);
			}
		}
	}
	return testers;
};

const shouldRedactString = (
	value: string,
	testers: SensitiveValueTester[],
): boolean => testers.some((tester) => tester(value));

export interface LogSanitizerOptions {
	sensitiveKeys?: string[];
	censor?: string;
	maxDepth?: number;
	valueTesters?: SensitiveValueTester[];
}

export const createLogSanitizer = (options?: LogSanitizerOptions) => {
	const sensitiveKeys = buildSensitiveKeySet(options?.sensitiveKeys);
	const censor = options?.censor ?? DEFAULT_LOG_REDACT_CENSOR;
	const maxDepth = Math.max(1, options?.maxDepth ?? 6);
	const sensitiveValueTesters = buildValueTesterList(options?.valueTesters);

	const sanitizeInternal = (
		value: unknown,
		depth: number,
		visited: WeakSet<object>,
	): unknown => {
		if (value === null || typeof value === "undefined") {
			return value;
		}

		if (typeof value === "string") {
			if (shouldRedactString(value, sensitiveValueTesters)) {
				return censor;
			}
			return value;
		}

		if (typeof value !== "object") {
			return value;
		}

		if (depth >= maxDepth) {
			return "[TRUNCATED]";
		}

		if (visited.has(value as object)) {
			return "[CIRCULAR]";
		}

		visited.add(value as object);
		try {
			if (Array.isArray(value)) {
				return value.map((entry) =>
					sanitizeInternal(entry, depth + 1, visited),
				);
			}

			if (!isPlainObject(value)) {
				return value;
			}

			const entries = Object.entries(value).map(([key, nestedValue]) => {
				if (sensitiveKeys.has(key.toLowerCase())) {
					return [key, censor] as const;
				}
				return [key, sanitizeInternal(nestedValue, depth + 1, visited)] as const;
			});

			return Object.fromEntries(entries);
		} finally {
			visited.delete(value as object);
		}
	};

	return (value: unknown): unknown => sanitizeInternal(value, 0, new WeakSet());
};

export const sanitizeLogValue = (
	value: unknown,
	options?: LogSanitizerOptions,
): unknown => createLogSanitizer(options)(value);

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

const hasEnumerableValues = (value: unknown): boolean => {
	if (value === null || value === undefined) {
		return false;
	}
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	if (typeof value === "object") {
		return Object.keys(value as Record<string, unknown>).length > 0;
	}
	return true;
};

export interface RequestLoggingOptions extends LogSanitizerOptions {
	enabled?: boolean;
	logOnRequest?: boolean;
	logOnResponse?: boolean;
	includeQuery?: boolean;
	includeParams?: boolean;
	includeBody?: boolean;
	includeRequestHeaders?: boolean;
	includeResponseHeaders?: boolean;
	requestMessage?: string;
	responseMessage?: string;
	skip?: (request: FastifyRequest) => boolean;
	buildRequestContext?: (
		request: FastifyRequest,
	) => Record<string, unknown> | void;
	buildResponseContext?: (
		request: FastifyRequest,
		reply: FastifyReply,
	) => Record<string, unknown> | void;
}

type FastifyAppLike = {
	addHook: (
		name: "onRequest" | "onResponse",
		hook: (...args: any[]) => unknown,
	) => unknown;
};

const ADDITIONAL_REQUEST_LOG_SENSITIVE_KEYS = Object.freeze([
	"primaryEmail",
	"primary_email",
	"guestEmail",
	"guest_email",
	"billingEmail",
	"billing_email",
	"deviceFingerprint",
	"device_fingerprint",
	"cardToken",
	"card_token",
	"routingNumber",
	"routing_number",
	"accountNumber",
	"account_number",
	"paymentToken",
	"payment_token",
]);

const STANDARD_REQUEST_LOG_SENSITIVE_KEYS = Array.from(
	new Set([
		...DEFAULT_SENSITIVE_LOG_KEYS,
		...ADDITIONAL_REQUEST_LOG_SENSITIVE_KEYS,
	]),
);
Object.freeze(STANDARD_REQUEST_LOG_SENSITIVE_KEYS);

const STANDARD_REQUEST_LOGGING_OPTIONS: RequestLoggingOptions = {
	includeBody: true,
	includeQuery: true,
	includeParams: true,
	includeRequestHeaders: false,
	includeResponseHeaders: false,
	logOnRequest: true,
	logOnResponse: true,
	maxDepth: 6,
	sensitiveKeys: STANDARD_REQUEST_LOG_SENSITIVE_KEYS,
	valueTesters: [...DEFAULT_SENSITIVE_VALUE_TESTERS],
};
Object.freeze(STANDARD_REQUEST_LOGGING_OPTIONS);

export const buildSecureRequestLoggingOptions = (
	overrides?: Partial<RequestLoggingOptions>,
): RequestLoggingOptions => {
	const base = STANDARD_REQUEST_LOGGING_OPTIONS;
	const merged: RequestLoggingOptions = {
		...base,
		...(overrides ?? {}),
	};

	if (overrides?.sensitiveKeys?.length) {
		merged.sensitiveKeys = Array.from(
			new Set([
				...(base.sensitiveKeys ?? []),
				...overrides.sensitiveKeys,
			]),
		);
	} else {
		merged.sensitiveKeys = base.sensitiveKeys;
	}

	if (overrides?.valueTesters?.length) {
		merged.valueTesters = [
			...(base.valueTesters ?? []),
			...overrides.valueTesters,
		];
	} else {
		merged.valueTesters = base.valueTesters ? [...base.valueTesters] : undefined;
	}

	return merged;
};

export const withRequestLogging = (
	app: FastifyAppLike,
	options?: RequestLoggingOptions,
): void => {
	if (!app || options?.enabled === false) {
		return;
	}

	const logOnRequest = options?.logOnRequest ?? true;
	const logOnResponse = options?.logOnResponse ?? true;

	if (!logOnRequest && !logOnResponse) {
		return;
	}

	const includeQuery = options?.includeQuery ?? true;
	const includeParams = options?.includeParams ?? true;
	const includeBody = options?.includeBody ?? false;
	const includeRequestHeaders = options?.includeRequestHeaders ?? false;
	const includeResponseHeaders = options?.includeResponseHeaders ?? false;
	const sanitize = createLogSanitizer(options);

	const shouldSkip = (request: FastifyRequest) =>
		Boolean(options?.skip?.(request));

	if (logOnRequest) {
		app.addHook("onRequest", async (request) => {
			if (shouldSkip(request)) {
				return;
			}

			const payload: Record<string, unknown> = {
				requestId: request.id,
				method: request.method,
				url: request.url,
			};

			if (includeQuery && hasEnumerableValues(request.query)) {
				payload.query = sanitize(request.query);
			}

			if (includeParams && hasEnumerableValues(request.params)) {
				payload.params = sanitize(request.params);
			}

			if (includeBody && hasEnumerableValues(request.body)) {
				payload.body = sanitize(request.body);
			}

			if (includeRequestHeaders && hasEnumerableValues(request.headers)) {
				payload.headers = sanitize(request.headers);
			}

			const context = options?.buildRequestContext?.(request);
			if (context && Object.keys(context).length > 0) {
				Object.assign(payload, context);
			}

			request.log.info(payload, options?.requestMessage ?? "request received");
		});
	}

	if (logOnResponse) {
		app.addHook("onResponse", async (request, reply) => {
			if (shouldSkip(request)) {
				return;
			}

			const durationMs =
				typeof reply.elapsedTime === "number"
					? reply.elapsedTime
					: typeof reply.getResponseTime === "function"
						? reply.getResponseTime()
						: undefined;

			const payload: Record<string, unknown> = {
				requestId: request.id,
				method: request.method,
				url: request.url,
				statusCode: reply.statusCode,
			};

			if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
				payload.durationMs = durationMs;
			}

			if (includeResponseHeaders) {
				const headers =
					typeof reply.getHeaders === "function"
						? reply.getHeaders()
						: (reply as unknown as { headers?: unknown })?.headers;
				if (hasEnumerableValues(headers)) {
					payload.responseHeaders = sanitize(headers);
				}
			}

			const context = options?.buildResponseContext?.(request, reply);
			if (context && Object.keys(context).length > 0) {
				Object.assign(payload, context);
			}

			request.log.info(
				payload,
				options?.responseMessage ?? "request completed",
			);
		});
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

	// Configure log exporter
	const logEndpoint =
		process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

	if (!traceEndpoint && !logEndpoint) {
		console.info(
			"[telemetry] No OTLP endpoints configured - telemetry disabled.",
		);
		return undefined;
	}

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
		traceExporter: traceEndpoint
			? new OTLPTraceExporter({
					url: traceEndpoint,
					headers: parseHeaders(
						process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS ??
							process.env.OTEL_EXPORTER_OTLP_HEADERS,
					),
				})
			: undefined,
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

const mergeRedactOptions = (
	provided: pino.LoggerOptions["redact"],
	additionalPaths: string[] | undefined,
	useDefaults: boolean | undefined,
	censorOverride: string | undefined,
): pino.LoggerOptions["redact"] => {
	const includeDefaults = useDefaults !== false;
	const pathSet = new Set<string>();
	let baseConfig: RedactObject | undefined;

	if (includeDefaults) {
		for (const path of DEFAULT_LOG_REDACT_PATHS) {
			pathSet.add(path);
		}
	}

	if (Array.isArray(provided)) {
		for (const path of provided) {
			if (path) {
				pathSet.add(path);
			}
		}
	} else if (provided && typeof provided === "object") {
		baseConfig = { ...provided };
		if (Array.isArray(baseConfig.paths)) {
			for (const path of baseConfig.paths) {
				if (path) {
					pathSet.add(path);
				}
			}
		}
	} else if (typeof provided === "string") {
		pathSet.add(provided);
	}

	if (Array.isArray(additionalPaths)) {
		for (const path of additionalPaths) {
			if (path) {
				pathSet.add(path);
			}
		}
	}

	if (pathSet.size === 0) {
		return provided;
	}

	const resolved: RedactObject = {
		...(baseConfig ?? {}),
		paths: Array.from(pathSet),
	};

	if (censorOverride !== undefined) {
		resolved.censor = censorOverride;
	} else if (resolved.censor === undefined) {
		resolved.censor = baseConfig?.censor ?? DEFAULT_LOG_REDACT_CENSOR;
	}

	return resolved as pino.LoggerOptions["redact"];
};

export interface LoggerOptions {
	serviceName: string;
	level?: string;
	pretty?: boolean;
	environment?: string;
	base?: Record<string, unknown>;
	redact?: pino.LoggerOptions["redact"];
	redactPaths?: string[];
	useDefaultRedactions?: boolean;
	redactCensor?: string;
}

export interface ServiceLoggerOptions {
	serviceName: string;
	levelEnv?: string;
	prettyEnv?: string;
	level?: string;
	pretty?: boolean;
	environment?: string;
	base?: Record<string, unknown>;
	redact?: pino.LoggerOptions["redact"];
	redactPaths?: string[];
	useDefaultRedactions?: boolean;
	redactCensor?: string;
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
	const redact = mergeRedactOptions(
		options.redact,
		options.redactPaths,
		options.useDefaultRedactions,
		options.redactCensor,
	);

	const baseOptions = {
		name: options.serviceName,
		level: options.level ?? "info",
		base: {
			service: options.serviceName,
			...options.base,
		},
		timestamp: pino.stdTimeFunctions.isoTime,
		redact,
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
		redact: options.redact,
		redactPaths: options.redactPaths,
		useDefaultRedactions: options.useDefaultRedactions,
		redactCensor: options.redactCensor,
	});
};

export type { Logger as PinoLogger } from "pino";
