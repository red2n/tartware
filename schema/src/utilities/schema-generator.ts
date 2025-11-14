#!/usr/bin/env tsx
/**
 * Schema Generator Utility
 * Auto-generates Zod schemas from PostgreSQL information_schema
 *
 * Usage: tsx src/utilities/schema-generator.ts [category]
 */

import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection from environment
const client = new Client({
	host: process.env.DB_HOST || "localhost",
	port: parseInt(process.env.DB_PORT || "5432", 10),
	database: process.env.DB_NAME || "tartware",
	user: process.env.DB_USER || "postgres",
	password: process.env.DB_PASSWORD || "postgres",
});

const schemaRoot = path.resolve(__dirname, "..", "..");
const repoRoot = path.resolve(schemaRoot, "..");
const tablesRoot = path.join(repoRoot, "scripts", "tables");

type CategoryTables = Record<string, string[]>;

const formatError = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

const getTablesForCategory = (
	category: string,
	tableMap: CategoryTables,
): string[] => {
	const tables = tableMap[category];
	if (!tables) {
		throw new Error(`Unknown category: ${category}`);
	}
	return tables;
};

async function discoverCategoryTables(): Promise<CategoryTables> {
	let domainEntries: Dirent[];
	try {
		domainEntries = await fs.readdir(tablesRoot, { withFileTypes: true });
	} catch (error) {
		throw new Error(
			`Unable to read tables directory at ${tablesRoot}: ${formatError(error)}`,
		);
	}

	const result: CategoryTables = {};

	for (const entry of domainEntries) {
		if (!entry.isDirectory() || !/^\d{2}-/.test(entry.name)) continue;

		const domainPath = path.join(tablesRoot, entry.name);
		const files = await fs.readdir(domainPath);
		const tables = new Set<string>();

		for (const file of files) {
			if (!/^\d+_[\w-]+\.sql$/i.test(file)) continue;
			const filePath = path.join(domainPath, file);
			const sql = await fs.readFile(filePath, "utf-8");
			const tableRegex =
				/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s(]+)/gi;
			let match: RegExpExecArray | null;

			while ((match = tableRegex.exec(sql)) !== null) {
				const rawName = match[1].replace(/["`]/g, "").split(".").pop();
				if (rawName) {
					tables.add(rawName.toLowerCase());
				}
			}
		}

		if (tables.size > 0) {
			result[entry.name] = Array.from(tables).sort();
		}
	}

	if (Object.keys(result).length === 0) {
		throw new Error(`No table categories discovered under ${tablesRoot}`);
	}

	return result;
}

// Map PostgreSQL types to Zod base schemas
function mapPostgresToZod(
	dataType: string,
	udtName: string,
	isNullable: boolean,
): string {
	let zodType: string;

	// Handle custom ENUM types
	if (dataType === "USER-DEFINED") {
		const enumName = udtName
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join("");
		zodType = `${enumName}Enum`;
	} else {
		switch (udtName) {
			case "uuid":
				zodType = "uuid";
				break;
			case "varchar":
			case "text":
			case "bpchar":
				zodType = "z.string()";
				break;
			case "int2":
			case "int4":
				zodType = "z.number().int()";
				break;
			case "int8":
				zodType = "z.bigint()";
				break;
			case "numeric":
				zodType = "money";
				break;
			case "bool":
				zodType = "z.boolean()";
				break;
			case "timestamp":
			case "timestamptz":
				zodType = "z.coerce.date()";
				break;
			case "date":
				zodType = "z.coerce.date()";
				break;
			case "time":
				zodType = "z.string()"; // Time strings
				break;
			case "jsonb":
				zodType = "z.record(z.unknown())"; // Generic JSONB
				break;
			case "_varchar":
			case "_text":
				zodType = "z.array(z.string())";
				break;
			case "_uuid":
				zodType = "z.array(uuid)";
				break;
			case "_date":
				zodType = "z.array(z.coerce.date())";
				break;
			case "_int4":
				zodType = "z.array(z.number().int())";
				break;
			default:
				zodType = "z.unknown()";
		}
	}

	return isNullable ? `${zodType}.optional()` : zodType;
}

async function generateSchema(
	tableName: string,
	category: string,
): Promise<void> {
	console.log(`Generating schema for ${tableName}...`);

	// Get table columns
	const result = await client.query<{
		column_name: string;
		data_type: string;
		udt_name: string;
		is_nullable: string;
		column_default: string | null;
	}>(
		`
    SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position
    `,
		[tableName],
	);

	const columns = result.rows;

	// Generate schema name
	const schemaName = tableName
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");

	// Generate imports
	const baseSchemaImports = new Set<string>();
	const enumImports = new Set<string>();

	const schemaFields: string[] = [];

	for (const col of columns) {
		const { column_name, data_type, udt_name, is_nullable } = col;
		const zodType = mapPostgresToZod(
			data_type,
			udt_name,
			is_nullable === "YES",
		);

		// Track imports
		if (zodType.includes("uuid")) baseSchemaImports.add("uuid");
		if (zodType.includes("money")) baseSchemaImports.add("money");
		if (zodType.includes("Enum")) {
			const enumName = zodType.replace(".optional()", "");
			enumImports.add(enumName);
		}

		schemaFields.push(`  ${column_name}: ${zodType},`);
	}

	// Build import statements
	let importStatements = "import { z } from 'zod';\n";

	if (baseSchemaImports.size > 0) {
		importStatements += `import {\n  ${Array.from(baseSchemaImports).join(",\n  ")}\n} from '../../shared/base-schemas.js';\n`;
	}

	if (enumImports.size > 0) {
		importStatements += `import { ${Array.from(enumImports).join(", ")} } from '../../shared/enums.js';\n`;
	}

	// Generate schema content
	const content = `/**
 * ${schemaName} Schema
 * @table ${tableName}
 * @category ${category}
 * @synchronized ${new Date().toISOString().split("T")[0]}
 */

${importStatements}
/**
 * Complete ${schemaName} schema
 */
export const ${schemaName}Schema = z.object({
${schemaFields.join("\n")}
});

export type ${schemaName} = z.infer<typeof ${schemaName}Schema>;

/**
 * Schema for creating a new ${tableName.replace(/_/g, " ")}
 */
export const Create${schemaName}Schema = ${schemaName}Schema.omit({
  // TODO: Add fields to omit for creation
});

export type Create${schemaName} = z.infer<typeof Create${schemaName}Schema>;

/**
 * Schema for updating a ${tableName.replace(/_/g, " ")}
 */
export const Update${schemaName}Schema = ${schemaName}Schema.partial();

export type Update${schemaName} = z.infer<typeof Update${schemaName}Schema>;
`;

		// Write to file
		const fileName = `${tableName.replace(/_/g, "-")}.ts`;
	const filePath = path.join(__dirname, "..", "schemas", category, fileName);

	await fs.writeFile(filePath, content, "utf-8");
	console.log(`✅ Generated ${filePath}`);
}

async function main() {
	const categoryTables: CategoryTables | null =
		await discoverCategoryTables().catch((error) => {
			console.error(
				"Failed to discover categories from scripts/tables:",
				formatError(error),
			);
			process.exit(1);
			return null;
		});

	if (!categoryTables) return;

	const availableCategories = Object.keys(categoryTables).sort();
	const preferredDefault = "02-inventory";
	const categoryArg = process.argv[2];
	const category =
		categoryArg ??
		(availableCategories.includes(preferredDefault)
			? preferredDefault
			: availableCategories[0]);

	let tables: string[];
	try {
		tables = getTablesForCategory(category, categoryTables);
	} catch (error) {
		console.error(formatError(error));
		console.error(`Available categories: ${availableCategories.join(", ")}`);
		process.exit(1);
		return;
	}

	console.log(`Generating schemas for category: ${category}`);
	console.log(`Tables: ${tables.length}`);

	try {
		await client.connect();
		console.log("✅ Connected to database");

		for (const tableName of tables) {
			await generateSchema(tableName, category);
		}

		console.log(`\n✅ Generated ${tables.length} schemas for ${category}`);
	} catch (error) {
		console.error("❌ Error:", formatError(error));
		process.exit(1);
	} finally {
		await client.end();
	}
}

void main();
