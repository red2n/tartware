import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildRouteSchema, jsonObjectSchema, schemaFromZod } from "../index.js";

describe("schemaFromZod", () => {
  it("normalizes exclusive numeric bounds", () => {
    const NumericSchema = z.object({
      score: z.number().gt(0).lt(100),
    });

    const jsonSchema = schemaFromZod(NumericSchema, "NumericSchema") as {
      properties?: Record<string, Record<string, unknown>>;
    };

    expect(jsonSchema).not.toHaveProperty("$schema");

    const scoreSchema = jsonSchema.properties?.score;
    expect(scoreSchema).toMatchObject({
      type: "number",
      exclusiveMinimum: 0,
      exclusiveMaximum: 100,
    });
    expect(scoreSchema).not.toHaveProperty("minimum");
    expect(scoreSchema).not.toHaveProperty("maximum");
  });

  it("resolves root $ref definitions", () => {
    const IdSchema = z.string().uuid();
    const jsonSchema = schemaFromZod(IdSchema, "ReservationId");

    expect(jsonSchema).toMatchObject({
      type: "string",
      format: "uuid",
    });
    expect(jsonSchema).not.toHaveProperty("$ref");
    expect(jsonSchema).not.toHaveProperty("definitions");
  });
});

describe("buildRouteSchema", () => {
  it("applies defaults for omitted fields", () => {
    const routeSchema = buildRouteSchema({
      tag: "Health",
      summary: "Health probe.",
    });

    expect(routeSchema).toMatchObject({
      tags: ["Health"],
      summary: "Health probe.",
      response: {
        200: jsonObjectSchema,
      },
    });
    expect(routeSchema).not.toHaveProperty("body");
  });

  it("preserves explicit schema overrides", () => {
    const responseSchema = {
      204: { type: "null" },
    };
    const paramsSchema = { type: "object" };

    const schema = buildRouteSchema({
      tag: "Example",
      summary: "Example route.",
      params: paramsSchema,
      response: responseSchema,
    });

    expect(schema).toMatchObject({
      params: paramsSchema,
      response: responseSchema,
    });
  });
});
