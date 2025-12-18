import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export type JsonSchema = Record<string, unknown>;

export const jsonObjectSchema: JsonSchema = {
	type: "object",
	additionalProperties: true,
} as const;

export const jsonArraySchema: JsonSchema = {
	type: "array",
	items: jsonObjectSchema,
} as const;

export const errorResponseSchema: JsonSchema = {
	type: "object",
	properties: {
		error: { type: "string" },
		message: { type: "string" },
	},
	required: ["error", "message"],
	additionalProperties: true,
} as const satisfies JsonSchema;

export const schemaFromZod = (schema: ZodTypeAny, name: string): JsonSchema => {
	const jsonSchema = zodToJsonSchema(schema, {
		name,
		target: "openApi3",
		$refStrategy: "none",
	}) as JsonSchema & { $schema?: string };

	if (jsonSchema.$schema) {
		delete jsonSchema.$schema;
	}

	const normalizedSchema = normalizeNumericBounds(jsonSchema);
	return resolveRootRef(normalizedSchema);
};

const normalizeNumericBounds = (schema: JsonSchema): JsonSchema => {
	const normalizeNode = (node: unknown): void => {
		if (!node || typeof node !== "object") {
			return;
		}

		if (Array.isArray(node)) {
			for (const value of node) {
				normalizeNode(value);
			}
			return;
		}

		const record = node as Record<string, unknown>;
		const minimum = record.minimum;
		const exclusiveMinimum = record.exclusiveMinimum;
		if (exclusiveMinimum === true && typeof minimum === "number") {
			record.exclusiveMinimum = minimum;
			delete record.minimum;
		}

		const maximum = record.maximum;
		const exclusiveMaximum = record.exclusiveMaximum;
		if (exclusiveMaximum === true && typeof maximum === "number") {
			record.exclusiveMaximum = maximum;
			delete record.maximum;
		}

		for (const value of Object.values(record)) {
			normalizeNode(value);
		}
	};

	normalizeNode(schema);
	return schema;
};

const resolveRootRef = (schema: JsonSchema): JsonSchema => {
	if (typeof schema.$ref !== "string") {
		return schema;
	}

	const refSegments = schema.$ref.split("/");
	const refKey = refSegments.at(-1);
	const definitions = (schema.definitions ?? schema.$defs) as
		| Record<string, JsonSchema>
		| undefined;

	if (!refKey || !definitions || typeof definitions !== "object") {
		return schema;
	}

	const referencedSchema = definitions[refKey];
	if (!referencedSchema) {
		return schema;
	}

	const resolvedSchema: JsonSchema = {
		...referencedSchema,
	};

	const remainingDefinitions = { ...definitions };
	delete remainingDefinitions[refKey];
	if (Object.keys(remainingDefinitions).length > 0) {
		resolvedSchema.definitions = remainingDefinitions;
	}

	return resolvedSchema;
};

export type RouteSchemaOptions = {
	tag: string;
	summary: string;
	description?: string;
	response?: Record<number | string, JsonSchema>;
	body?: JsonSchema;
	params?: JsonSchema;
	querystring?: JsonSchema;
	security?: Array<JsonSchema>;
};

export const buildRouteSchema = ({
	tag,
	summary,
	description,
	response,
	body,
	params,
	querystring,
	security,
}: RouteSchemaOptions) => {
	const schema: Record<string, unknown> = {
		tags: [tag],
		summary,
	};

	if (description) {
		schema.description = description;
	}

	if (body) {
		schema.body = body;
	}

	if (params) {
		schema.params = params;
	}

	if (querystring) {
		schema.querystring = querystring;
	}

	if (security) {
		schema.security = security;
	}

	schema.response = response ?? {
		200: jsonObjectSchema,
	};

	return schema;
};
