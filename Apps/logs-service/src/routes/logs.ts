import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";

import { config } from "../config.js";
import { searchLogs } from "../opensearch.js";

const querySchema = z.object({
  service: z.string().min(1).optional(),
  severity: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  size: z.coerce.number().int().min(1).max(config.maxPageSize).optional(),
  cursor: z.string().optional(),
});

type QueryParams = z.infer<typeof querySchema>;

const decodeCursor = (cursor?: string): Array<string | number> | undefined => {
  if (!cursor) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return undefined;
  } catch (error) {
    console.warn("[logs-service] Failed to decode cursor", error);
    return undefined;
  }
};

const encodeCursor = (sort?: Array<string | number>): string | null => {
  if (!sort || sort.length === 0) {
    return null;
  }
  return Buffer.from(JSON.stringify(sort)).toString("base64");
};

type SortDefinition = Array<Record<string, { order: "asc" | "desc" }> | string>;

const logsRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get(
    "/v1/logs",
    {
      schema: {
        tags: ["logs"],
        summary: "Search OTLP logs",
        querystring: {
          type: "object",
          properties: {
            service: { type: "string" },
            severity: { type: "string" },
            query: { type: "string" },
            from: { type: "string", format: "date-time" },
            to: { type: "string", format: "date-time" },
            size: { type: "number" },
            cursor: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "INVALID_QUERY",
          details: parsed.error.flatten(),
        });
      }

      const params: QueryParams = parsed.data;
      const size = params.size ?? 50;
      const searchAfter = decodeCursor(params.cursor);

      const must: Record<string, unknown>[] = [];
      const filter: Record<string, unknown>[] = [];

      if (params.service) {
        must.push({ term: { "resource.service.name.keyword": params.service } });
      }

      if (params.severity) {
        must.push({ term: { severity_text: params.severity } });
      }

      if (params.query) {
        must.push({
          query_string: {
            query: params.query,
            default_operator: "AND",
          },
        });
      }

      if (params.from || params.to) {
        filter.push({
          range: {
            time: {
              gte: params.from?.toISOString(),
              lte: params.to?.toISOString(),
            },
          },
        });
      }

      const sort: SortDefinition = [
        { time: { order: "desc" as const } },
        { "trace_id.keyword": { order: "desc" as const } },
        { _id: { order: "desc" as const } },
      ];

      const response = await searchLogs({
        index: config.logIndexPattern,
        search_after: searchAfter,
        body: {
          size,
          sort,
          query: {
            bool: {
              must,
              filter,
            },
          },
        },
      });

      const hits = response.hits.hits ?? [];
      const entries = hits.map((hit) => {
        const source = hit._source ?? {};
        return {
          id: hit._id,
          timestamp: (source.time as string | undefined) ?? null,
          service: (source.resource?.["service.name"] as string | undefined) ?? null,
          severity: (source.severity_text as string | undefined) ?? null,
          body: source.body ?? null,
          traceId: (source.trace_id as string | undefined) ?? null,
          spanId: (source.span_id as string | undefined) ?? null,
          attributes: source.attributes ?? {},
          resource: source.resource ?? {},
        };
      });

      const sortValues = hits
        .at(-1)
        ?.sort?.filter(
          (value): value is string | number =>
            typeof value === "string" || typeof value === "number",
        );

      const totalHits = response.hits.total;
      const total =
        typeof totalHits === "number" ? totalHits : (totalHits?.value ?? entries.length);

      return {
        entries,
        nextCursor: sortValues && entries.length === size ? encodeCursor(sortValues) : null,
        total,
      };
    },
  );
};

export default fp(logsRoute, {
  name: "logs-route",
});
