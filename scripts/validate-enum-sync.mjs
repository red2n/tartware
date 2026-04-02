#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const sqlPath = path.join(repoRoot, "scripts/02-enum-types.sql");
const schemaPath = path.join(repoRoot, "schema/src/shared/enums.ts");
const excludedSqlEnums = new Set([
	"room_category",
	"rate_type",
	"payment_method",
	"company_type",
	"group_booking_type",
]);

const parseSqlEnums = (content) => {
	const sqlEnums = new Map();
	const createTypePattern =
		/CREATE TYPE\s+([a-z0-9_]+)\s+AS ENUM\s*\(([\s\S]*?)\);/gi;

	for (const match of content.matchAll(createTypePattern)) {
		const [, enumName, rawValues] = match;
		const normalizedValues = rawValues.replace(/--.*$/gm, "");
		const values = [...normalizedValues.matchAll(/'([^']+)'/g)].map(
			(valueMatch) => valueMatch[1],
		);
		if (!excludedSqlEnums.has(enumName)) {
			sqlEnums.set(enumName, values);
		}
	}

	return sqlEnums;
};

const parseSchemaEnums = (content) => {
	const schemaEnums = new Map();
	const enumPattern =
		/\/\*\*[\s\S]*?@database\s+([a-z0-9_]+)[\s\S]*?\*\/\s*export const ([A-Za-z0-9_]+)\s*=\s*z\.enum\(\[([\s\S]*?)\]\);/g;

	for (const match of content.matchAll(enumPattern)) {
		const [, enumName, exportName, rawValues] = match;
		const values = [...rawValues.matchAll(/"([^"]+)"/g)].map(
			(valueMatch) => valueMatch[1],
		);
		schemaEnums.set(enumName, { exportName, values });
	}

	return schemaEnums;
};

const compareEnums = (sqlEnums, schemaEnums) => {
	const failures = [];

	for (const [enumName, sqlValues] of sqlEnums.entries()) {
		const schemaEnum = schemaEnums.get(enumName);
		if (!schemaEnum) {
			failures.push(`Missing schema enum for SQL type '${enumName}'`);
			continue;
		}

		const schemaValues = schemaEnum.values;
		if (
			sqlValues.length !== schemaValues.length ||
			sqlValues.some((value, index) => value !== schemaValues[index])
		) {
			failures.push(
				`Value mismatch for '${enumName}' (${schemaEnum.exportName})\n` +
					`  SQL:    ${sqlValues.join(", ")}\n` +
					`  Schema: ${schemaValues.join(", ")}`,
			);
		}
	}

	for (const [enumName, schemaEnum] of schemaEnums.entries()) {
		if (!sqlEnums.has(enumName)) {
			failures.push(
				`Schema enum '${schemaEnum.exportName}' is marked @database '${enumName}' but missing from scripts/02-enum-types.sql`,
			);
		}
	}

	return failures;
};

const [sqlContent, schemaContent] = await Promise.all([
	readFile(sqlPath, "utf8"),
	readFile(schemaPath, "utf8"),
]);

const sqlEnums = parseSqlEnums(sqlContent);
const schemaEnums = parseSchemaEnums(schemaContent);
const failures = compareEnums(sqlEnums, schemaEnums);

if (failures.length > 0) {
	console.error("Enum sync validation failed.\n");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	`Enum sync validation passed for ${sqlEnums.size} SQL enums and ${schemaEnums.size} schema enums.`,
);
