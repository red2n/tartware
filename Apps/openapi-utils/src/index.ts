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
    type: { type: "string", description: "URI identifying the problem type" },
    title: { type: "string", description: "Short human-readable summary" },
    status: { type: "integer", description: "HTTP status code" },
    detail: { type: "string", description: "Human-readable explanation" },
    instance: { type: "string", description: "URI reference for this occurrence" },
  },
  required: ["type", "title", "status", "detail"],
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

    // `target: "openApi3"` emits OpenAPI's `nullable: true`, which the response
    // serializer (fast-json-stringify) does not understand — it only honours
    // JSON Schema's `type` keyword. AJV additionally rejects `nullable` with no
    // `type` at all. So every nullable node needs a `type` that itself admits
    // null, otherwise a null value serialises as "does not match schema
    // definition" and the route 500s on perfectly valid data.
    if (record.nullable === true) {
      const withNull = (type: unknown): unknown => {
        if (typeof type === "string") {
          return type === "null" ? type : [type, "null"];
        }
        if (Array.isArray(type)) {
          return type.includes("null") ? type : [...type, "null"];
        }
        return type;
      };

      if (record.type) {
        record.type = withNull(record.type);
      } else if (Array.isArray(record.anyOf)) {
        const types = new Set(
          record.anyOf.map((s: { type?: string }) => s.type).filter(Boolean) as string[],
        );
        // A single underlying type can be hoisted; a genuine union cannot, so
        // leave `type` off and let the anyOf branch below carry nullability.
        record.type = types.size === 1 ? withNull([...types][0]) : withNull("string");
        if (types.size !== 1 && types.size !== 0) {
          delete record.type;
        }
      } else {
        record.type = withNull("string");
      }

      // The union must admit null too: a top-level type of ["string","null"]
      // still fails if every anyOf branch rejects null, since both apply.
      if (
        Array.isArray(record.anyOf) &&
        !record.anyOf.some((s: { type?: unknown }) => s?.type === "null")
      ) {
        record.anyOf = [...record.anyOf, { type: "null" }];
      }
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
