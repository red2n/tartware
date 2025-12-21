import {
	Pool,
	type PoolClient,
	type QueryResult,
	type QueryResultRow,
	types,
} from "pg";

import { dbConfig } from "../config.js";

const parseBigInt = (value: string | null): bigint | null => {
	if (value === null) {
		return null;
	}
	return BigInt(value);
};

const parseTimestamp = (value: string | null): Date | null => {
	if (value === null) {
		return null;
	}
	return new Date(`${value}Z`);
};

types.setTypeParser(20, parseBigInt as (value: string) => unknown);
types.setTypeParser(1114, parseTimestamp as (value: string) => unknown);
types.setTypeParser(1184, parseTimestamp as (value: string) => unknown);

const pool = new Pool({
	host: dbConfig.host,
	port: dbConfig.port,
	database: dbConfig.database,
	user: dbConfig.user,
	password: dbConfig.password,
	ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
	max: dbConfig.max,
	idleTimeoutMillis: dbConfig.idleTimeoutMillis,
});

pool.on("error", (error: unknown) => {
	console.error("Unexpected PostgreSQL pool error", error);
});

export const query = async <T extends QueryResultRow = QueryResultRow>(
	text: string,
	params: unknown[] = [],
): Promise<QueryResult<T>> => {
	return pool.query<T>(text, params);
};

export const withTransaction = async <T>(
	callback: (client: PoolClient) => Promise<T>,
): Promise<T> => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const result = await callback(client);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		try {
			await client.query("ROLLBACK");
		} catch (rollbackError) {
			console.error("Failed to rollback transaction", rollbackError);
		}
		throw error;
	} finally {
		client.release();
	}
};
