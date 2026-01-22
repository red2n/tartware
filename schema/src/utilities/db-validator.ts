/**
 * DEV DOC
 * Module: utilities/db-validator.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import type { Dirent } from "node:fs";
import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

type PathKind = "file" | "dir";

type CheckResult = {
	description: string;
	status: "ok" | "warn" | "error";
	details?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaRoot = path.resolve(__dirname, "..", "..");
const repoRoot = path.resolve(schemaRoot, "..");
const scriptsRoot = path.resolve(repoRoot, "scripts");
const tablesRoot = path.join(scriptsRoot, "tables");
const indexesRoot = path.join(scriptsRoot, "indexes");
const constraintsRoot = path.join(scriptsRoot, "constraints");

const REQUIRED_PATHS: Array<{ path: string; kind: PathKind; description: string }> = [
	{
		path: path.join(schemaRoot, "src", "index.ts"),
		kind: "file",
		description: "Schema root export (src/index.ts)",
	},
	{
		path: path.join(repoRoot, "executables", "setup-database", "setup-database.sh"),
		kind: "file",
		description: "Database bootstrap script (executables/setup-database/setup-database.sh)",
	},
	{
		path: path.join(scriptsRoot, "01-database-setup.sql"),
		kind: "file",
		description: "Primary SQL setup script (01-database-setup.sql)",
	},
	{
		path: path.join(scriptsRoot, "verify-all.sql"),
		kind: "file",
		description: "Verification orchestrator (verify-all.sql)",
	},
	{
		path: tablesRoot,
		kind: "dir",
		description: "Tables verification folder",
	},
	{
		path: indexesRoot,
		kind: "dir",
		description: "Indexes verification folder",
	},
	{
		path: constraintsRoot,
		kind: "dir",
		description: "Constraints verification folder",
	},
	{
		path: path.join(schemaRoot, "src", "schemas"),
		kind: "dir",
		description: "Schema domain directory",
	},
];

const errors: CheckResult[] = [];
const warnings: CheckResult[] = [];
const successes: CheckResult[] = [];

const formatError = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

async function ensurePathKind(inputPath: string, kind: PathKind, description: string) {
	try {
		const stats = await stat(inputPath);
		if (kind === "dir" && !stats.isDirectory()) {
			throw new Error("expected directory");
		}
		if (kind === "file" && !stats.isFile()) {
			throw new Error("expected file");
		}
		successes.push({ description, status: "ok" });
	} catch (error) {
		errors.push({
			description,
			status: "error",
			details: `${formatError(error)} at ${inputPath}`,
		});
	}
}

const tableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s(]+)/gi;
const docTableRegexes = [
	/^\s*\*\s*@tables?\s+([^\n*]+)/gim,
	/^\s*\*\s*Tables?:\s+([^\n*]+)/gim,
];
const ignoredTableValues = new Set(["n/a", "na", "none"]);

async function extractTablesFromSql(filePath: string): Promise<string[]> {
	const tables = new Set<string>();
	const sql = await readFile(filePath, "utf-8");

	for (const match of sql.matchAll(tableRegex)) {
		const raw = match[1]?.replace(/["`]/g, "").split(".").pop();
		if (raw) {
			tables.add(raw.toLowerCase());
		}
	}

	return Array.from(tables);
}

async function collectDomainTables(root: string): Promise<Record<string, string[]>> {
	const result: Record<string, string[]> = {};
	let entries: Dirent[];

	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch (error) {
		throw new Error(`Unable to read ${root}: ${formatError(error)}`);
	}

	for (const entry of entries) {
		const entryName = entry.name.toString();
		if (!entry.isDirectory() || !/^\d{2}-/.test(entryName)) continue;
		const domainPath = path.join(root, entryName);
		const files = await readdir(domainPath);
		const tables = new Set<string>();

		for (const file of files) {
			if (!/^\d+_[\w-]+\.sql$/i.test(file)) continue;
			const filePath = path.join(domainPath, file);
			const tableNames = await extractTablesFromSql(filePath);
			tableNames.forEach((name) => {
				tables.add(name);
			});
		}

		result[entryName] = Array.from(tables).sort();
	}

	return result;
}

async function collectSchemaTables(): Promise<Record<string, string[]>> {
	const schemasDir = path.join(schemaRoot, "src", "schemas");
	const result: Record<string, string[]> = {};
	const entries = await readdir(schemasDir, { withFileTypes: true });

	const parseTablesFromSchemaFile = async (
		filePath: string,
	): Promise<{ tables: string[]; hasTableDoc: boolean }> => {
		const content = await readFile(filePath, "utf-8");
		const tables = new Set<string>();
		let hasTableDoc = false;

		for (const regex of docTableRegexes) {
			for (const match of content.matchAll(regex)) {
				const raw = match[1];
				if (!raw) continue;
				hasTableDoc = true;
				raw
					.split(",")
					.map((value) => value.trim())
					.filter(Boolean)
					.forEach((value) => {
						const normalized = value.toLowerCase();
						if (ignoredTableValues.has(normalized)) return;
						if (!/[a-z]/i.test(value)) return;
						tables.add(normalized);
					});
			}
		}

		return { tables: Array.from(tables), hasTableDoc };
	};

	for (const entry of entries) {
		const entryName = entry.name.toString();
		if (!entry.isDirectory() || !/^\d{2}-/.test(entryName)) continue;
		const categoryDir = path.join(schemasDir, entryName);
		const files = await readdir(categoryDir);
		const tables = new Set<string>();

		for (const file of files) {
			if (!file.endsWith(".ts") || file === "index.ts") continue;
			const filePath = path.join(categoryDir, file);
			const { tables: docTables, hasTableDoc } =
				await parseTablesFromSchemaFile(filePath);
			if (docTables.length > 0) {
				for (const table of docTables) {
					tables.add(table);
				}
				continue;
			}
			if (hasTableDoc) {
				continue;
			}
			tables.add(
				file.replace(/\.ts$/, "").replace(/-/g, "_").toLowerCase(),
			);
		}

		result[entryName] = Array.from(tables).sort();
	}

	return result;
}

async function validateCoverage(): Promise<void> {
	const sqlTables = await collectDomainTables(tablesRoot);
	const indexes = await collectDomainTables(indexesRoot);
	const constraints = await collectDomainTables(constraintsRoot);
	const schemaTables = await collectSchemaTables();

	const domains = new Set([
		...Object.keys(sqlTables),
		...Object.keys(schemaTables),
	]);

	for (const domain of domains) {
		const sqlList = sqlTables[domain] ?? [];
		const schemaList = schemaTables[domain] ?? [];

		const missingSchemas = sqlList.filter((table) => !schemaList.includes(table));
		const orphanSchemas = schemaList.filter((table) => !sqlList.includes(table));

		if (missingSchemas.length === 0) {
			successes.push({
				description: `Schema coverage for ${domain}`,
				status: "ok",
			});
		} else {
			errors.push({
				description: `Schema coverage for ${domain}`,
				status: "error",
				details: `Missing schemas for: ${missingSchemas.join(", ")}`,
			});
		}

		if (orphanSchemas.length > 0) {
			warnings.push({
				description: `Schema-only tables in ${domain}`,
				status: "warn",
				details: orphanSchemas.join(", "),
			});
		}
	}

	// Verify indexes and constraints directories exist and have content
	const verifyDomainSet = (
		label: string,
		domainTables: Record<string, string[]>,
	) => {
		if (Object.keys(domainTables).length === 0) {
			warnings.push({
				description: `${label} directories`,
				status: "warn",
				details: `No domains detected under ${label}`,
			});
		} else {
			successes.push({
				description: `${label} directories`,
				status: "ok",
			});
		}
	};

	verifyDomainSet("indexes", indexes);
	verifyDomainSet("constraints", constraints);
}

async function main() {
	for (const item of REQUIRED_PATHS) {
		// eslint-disable-next-line no-await-in-loop -- sequential reporting
		await ensurePathKind(item.path, item.kind, item.description);
	}

	try {
		await validateCoverage();
	} catch (error) {
		errors.push({
			description: "Coverage validation",
			status: "error",
			details: formatError(error),
		});
	}

	const format = (result: CheckResult) => {
		const label =
			result.status === "ok" ? "✅" : result.status === "warn" ? "⚠️" : "❌";
		const detail = result.details ? ` - ${result.details}` : "";
		return `${label} ${result.description}${detail}`;
	};

	[...successes, ...warnings, ...errors].forEach((result) => {
		console.log(format(result));
	});

	if (errors.length > 0) {
		console.error(
			`\nValidation failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}.`,
		);
		process.exitCode = 1;
	} else {
		console.log("\nSchema and database scripts look consistent ✅");
	}
}

main().catch((error) => {
	console.error("Unexpected validator failure:", error);
	process.exitCode = 1;
});
