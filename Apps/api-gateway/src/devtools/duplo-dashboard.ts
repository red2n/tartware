import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRouteSchema } from "@tartware/openapi";
import { Eta } from "eta";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";

interface DuploSummary {
	timestamp: string;
	status: number;
	duplicates_count: number;
	duplicates_per_file: Record<string, number>;
}

interface DuploSummaryRecord {
	fileName: string;
	filePath: string;
	relativePath: string;
	metadata: DuploSummary;
}

interface DashboardContext {
	hasReports: boolean;
	availableReports: Array<{
		timestamp: string;
		displayLabel: string;
		duplicatesCount: number;
		status: number;
		isSelected: boolean;
	}>;
	selectedReport?: {
		timestamp: string;
		displayLabel: string;
		duplicatesCount: number;
		status: number;
		relativePath: string;
		duplicates: Array<{ file: string; count: number }>;
	};
	generatedAtIso: string;
}

const SUMMARY_FILE_PATTERN = /^duplo-summary-(\d{8}-\d{6})\.json$/;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(moduleDir, "../..");
const repoRoot = path.resolve(workspaceRoot, "..", "..");
const reportsDir = path.join(repoRoot, "reports", "duplo");
const viewsDir = path.join(workspaceRoot, "views");

const eta = new Eta({
	views: viewsDir,
	cache: process.env.NODE_ENV === "production",
});

const formatTimestampLabel = (timestamp: string): string => {
	if (!/^\d{8}-\d{6}$/.test(timestamp)) {
		return timestamp;
	}

	const year = timestamp.slice(0, 4);
	const month = timestamp.slice(4, 6);
	const day = timestamp.slice(6, 8);
	const hour = timestamp.slice(9, 11);
	const minute = timestamp.slice(11, 13);
	const second = timestamp.slice(13, 15);
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

const listDuploSummaries = async (
	logger: FastifyBaseLogger,
): Promise<DuploSummaryRecord[]> => {
	let entries: string[] = [];
	try {
		entries = await fs.readdir(reportsDir);
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException;
		if (nodeError?.code === "ENOENT") {
			return [];
		}
		logger.error(error, "failed to list Duplo reports");
		return [];
	}

	const summaries: DuploSummaryRecord[] = [];
	for (const entry of entries) {
		const match = SUMMARY_FILE_PATTERN.exec(entry);
		if (!match) {
			continue;
		}

		const filePath = path.join(reportsDir, entry);
		let raw: string;
		try {
			raw = await fs.readFile(filePath, "utf8");
		} catch (error) {
			logger.warn(
				{ error, filePath },
				"failed to read Duplo summary file; skipping",
			);
			continue;
		}

		let parsed: Partial<DuploSummary> | null = null;
		try {
			parsed = raw.trim().length === 0 ? null : JSON.parse(raw);
		} catch (error) {
			logger.warn(
				{ error, filePath },
				"failed to parse Duplo summary file; skipping",
			);
			continue;
		}

		if (!parsed) {
			continue;
		}

		const timestamp =
			typeof parsed.timestamp === "string" ? parsed.timestamp : match[1];
		const record: DuploSummaryRecord = {
			fileName: entry,
			filePath,
			relativePath: path.posix.join("reports/duplo", entry),
			metadata: {
				timestamp,
				status: typeof parsed.status === "number" ? parsed.status : 0,
				duplicates_count:
					typeof parsed.duplicates_count === "number"
						? parsed.duplicates_count
						: 0,
				duplicates_per_file:
					typeof parsed.duplicates_per_file === "object" &&
					parsed.duplicates_per_file !== null
						? Object.fromEntries(
								Object.entries(parsed.duplicates_per_file).filter(
									([key, value]) =>
										typeof key === "string" && typeof value === "number",
								),
							)
						: {},
			},
		};
		summaries.push(record);
	}

	return summaries.sort((a, b) =>
		b.metadata.timestamp.localeCompare(a.metadata.timestamp),
	);
};

const buildDashboardContext = (
	summaries: DuploSummaryRecord[],
	selectedTimestamp?: string,
): DashboardContext => {
	const selected = selectedTimestamp
		? summaries.find(
				(summary) => summary.metadata.timestamp === selectedTimestamp,
			)
		: undefined;
	const fallbackSummary = summaries[0];
	const activeSummary = selected ?? fallbackSummary;

	const duplicates = activeSummary
		? Object.entries(activeSummary.metadata.duplicates_per_file)
				.map(([file, count]) => ({ file, count }))
				.sort((left, right) => {
					if (right.count === left.count) {
						return left.file.localeCompare(right.file);
					}
					return right.count - left.count;
				})
		: [];

	return {
		hasReports: summaries.length > 0,
		availableReports: summaries.map((summary) => ({
			timestamp: summary.metadata.timestamp,
			displayLabel: formatTimestampLabel(summary.metadata.timestamp),
			duplicatesCount: summary.metadata.duplicates_count,
			status: summary.metadata.status,
			isSelected:
				summary.metadata.timestamp === activeSummary?.metadata.timestamp,
		})),
		selectedReport: activeSummary
			? {
					timestamp: activeSummary.metadata.timestamp,
					displayLabel: formatTimestampLabel(activeSummary.metadata.timestamp),
					duplicatesCount: activeSummary.metadata.duplicates_count,
					status: activeSummary.metadata.status,
					relativePath: activeSummary.relativePath,
					duplicates,
				}
			: undefined,
		generatedAtIso: new Date().toISOString(),
	};
};

export const registerDuploDashboard = (app: FastifyInstance): void => {
	app.get(
		"/developers/duplo",
		{
			schema: buildRouteSchema({
				tag: "Developer Utilities",
				summary: "View duplicate code findings from the latest Duplo scans.",
				querystring: {
					type: "object",
					properties: {
						timestamp: {
							type: "string",
							pattern: "^\\d{8}-\\d{6}$",
							description: "Specific Duplo summary timestamp to render.",
						},
					},
					additionalProperties: false,
				},
				response: {
					200: { type: "string" },
				},
			}),
		},
		async (request, reply) => {
			const summaries = await listDuploSummaries(request.log);

			const context = buildDashboardContext(
				summaries,
				(request.query as { timestamp?: string } | undefined)?.timestamp,
			);

			const html = eta.render("duplo-dashboard", context);
			if (typeof html !== "string") {
				request.log.error("Eta template rendering returned empty output");
				return reply
					.code(500)
					.type("text/plain")
					.send("Unable to render Duplo dashboard");
			}

			return reply
				.header("Content-Type", "text/html; charset=utf-8")
				.send(html);
		},
	);
};
