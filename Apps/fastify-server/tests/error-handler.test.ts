import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";

import { buildFastifyServer } from "../src/index.js";

const WARN = 40;
const ERROR = 50;

interface LogRecord {
	level: number;
	msg: string;
	statusCode?: number;
	validation?: string[];
	err?: { type?: string; stack?: string };
}

interface ZodIssue {
	code: string;
	message: string;
	path: (string | number)[];
}

/**
 * Stand-in for zod's error. fastify-server detects zod by shape rather than
 * instanceof so it keeps no hard zod dependency, but pino's err serializer
 * reports the *constructor* name — so this has to be a real named class to
 * reproduce what a service actually logs.
 */
class ZodError extends Error {
	readonly errors: ZodIssue[];

	constructor(issues: ZodIssue[]) {
		// ZodError.message really is a multi-line JSON dump of every issue.
		super(JSON.stringify(issues, null, 2));
		this.name = "ZodError";
		this.errors = issues;
	}
}

/** Mirrors what @fastify/sensible throws for reply.conflict() and friends. */
class ConflictError extends Error {
	readonly statusCode: number;

	constructor(statusCode: number, message: string) {
		super(message);
		this.name = "ConflictError";
		this.statusCode = statusCode;
	}
}

const makeZodError = (): Error =>
	new ZodError([
		{
			code: "custom",
			message: "end_time must differ from start_time",
			path: ["end_time"],
		},
	]);

const makeHttpError = (statusCode: number, message: string): Error =>
	new ConflictError(statusCode, message);

/** Build a server logging at `level`, throw `thrown` from a route, collect output. */
const captureFor = async (level: string, thrown: Error) => {
	const records: LogRecord[] = [];
	const stream = new Writable({
		write(chunk, _encoding, callback) {
			for (const line of String(chunk).split("\n")) {
				if (line.trim()) {
					records.push(JSON.parse(line) as LogRecord);
				}
			}
			callback();
		},
	});

	const app = buildFastifyServer({
		logger: pino({ level }, stream),
		enableRequestLogging: false,
	});
	app.get("/boom", async () => {
		throw thrown;
	});
	await app.ready();

	const response = await app.inject({ method: "GET", url: "/boom" });
	await app.close();

	return { records, response };
};

describe("defaultErrorHandler logging", () => {
	it("logs a validation failure at warn with no stack, and summarises the issues", async () => {
		const { records, response } = await captureFor("info", makeZodError());

		expect(response.statusCode).toBe(400);
		expect(records).toHaveLength(1);

		const [record] = records;
		expect(record?.level).toBe(WARN);
		expect(record?.statusCode).toBe(400);
		// The multi-line JSON blob must never become the log message.
		expect(record?.msg).toBe("request validation failed");
		expect(record?.validation).toEqual([
			"end_time: end_time must differ from start_time",
		]);
		expect(record?.err).toBeUndefined();
	});

	it("restores the full error on a 4xx when LOG_LEVEL is debug", async () => {
		const { records } = await captureFor("debug", makeZodError());

		const record = records.find((entry) => entry.statusCode === 400);
		expect(record?.level).toBe(WARN);
		expect(record?.err?.type).toBe("ZodError");
		expect(record?.err?.stack).toContain("ZodError");
		// The compact summary stays alongside the full object.
		expect(record?.validation).toEqual([
			"end_time: end_time must differ from start_time",
		]);
	});

	it("logs a 409 conflict at warn without a stack", async () => {
		const { records, response } = await captureFor(
			"info",
			makeHttpError(409, "Meeting room is already booked for that time range"),
		);

		expect(response.statusCode).toBe(409);
		expect(records).toHaveLength(1);
		expect(records[0]?.level).toBe(WARN);
		expect(records[0]?.msg).toBe(
			"Meeting room is already booked for that time range",
		);
		expect(records[0]?.err).toBeUndefined();
		expect(records[0]?.validation).toBeUndefined();
	});

	it("logs an unexpected fault at error with the full stack, regardless of level", async () => {
		const { records, response } = await captureFor(
			"info",
			new Error("connection terminated unexpectedly"),
		);

		expect(response.statusCode).toBe(500);
		expect(records).toHaveLength(1);
		expect(records[0]?.level).toBe(ERROR);
		expect(records[0]?.statusCode).toBe(500);
		expect(records[0]?.err?.stack).toContain(
			"connection terminated unexpectedly",
		);
	});
});
