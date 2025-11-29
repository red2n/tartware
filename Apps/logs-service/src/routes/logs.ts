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

type SortOrder = {
  order: "asc" | "desc";
  unmapped_type?: "date" | "long" | "keyword" | "text";
  missing?: "_last" | "_first";
};

type SortDefinition = Array<Record<string, SortOrder> | string>;

const toUnixNano = (date?: Date): number | undefined => {
  if (!date) {
    return undefined;
  }
  return date.getTime() * 1_000_000;
};

const buildTermFilter = (fields: string[], value: string): Record<string, unknown> => {
  const clauses = fields.map((field) => ({
    term: { [field]: value },
  }));

  if (clauses.length === 1) {
    return clauses[0] as Record<string, unknown>;
  }

  return {
    bool: {
      should: clauses,
      minimum_should_match: 1,
    },
  };
};

const buildTimestampFilter = (from?: Date, to?: Date): Record<string, unknown> | null => {
  const isoRange: Record<string, string> = {};
  const nanoRange: Record<string, number> = {};

  if (from) {
    isoRange.gte = from.toISOString();
    const fromNano = toUnixNano(from);
    if (typeof fromNano === "number") {
      nanoRange.gte = fromNano;
    }
  }

  if (to) {
    isoRange.lte = to.toISOString();
    const toNano = toUnixNano(to);
    if (typeof toNano === "number") {
      nanoRange.lte = toNano;
    }
  }

  const rangeFilters: Record<string, unknown>[] = [];

  if (Object.keys(isoRange).length > 0) {
    rangeFilters.push({ range: { "@timestamp": isoRange } });
    rangeFilters.push({ range: { observedTimestamp: isoRange } });
  }

  if (Object.keys(nanoRange).length > 0) {
    rangeFilters.push({ range: { time_unix_nano: nanoRange } });
  }

  if (rangeFilters.length === 0) {
    return null;
  }

  if (rangeFilters.length === 1) {
    return rangeFilters[0] as Record<string, unknown>;
  }

  return {
    bool: {
      should: rangeFilters,
      minimum_should_match: 1,
    },
  };
};

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
        must.push(buildTermFilter(["severity.text.keyword", "severity_text"], params.severity));
      }

      if (params.query) {
        must.push({
          query_string: {
            query: params.query,
            default_operator: "AND",
          },
        });
      }

      const timestampFilter = buildTimestampFilter(params.from, params.to);
      if (timestampFilter) {
        filter.push(timestampFilter);
      }

      const sort: SortDefinition = [
        { "@timestamp": { order: "desc", unmapped_type: "date" } },
        { observedTimestamp: { order: "desc", unmapped_type: "date" } },
        { time_unix_nano: { order: "desc", unmapped_type: "long" } },
        { "trace_id.keyword": { order: "desc", unmapped_type: "keyword" } },
        { _id: { order: "desc" } },
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
        const timeFromNanos =
          typeof source.time_unix_nano === "number"
            ? new Date(Math.floor(source.time_unix_nano / 1_000_000)).toISOString()
            : null;
        const timestamp =
          (source["@timestamp"] as string | undefined) ??
          (source.observedTimestamp as string | undefined) ??
          (source.time as string | undefined) ??
          timeFromNanos;

        const resourceFields = source.resource ?? {};
        const nestedService = resourceFields.service as Record<string, unknown> | undefined;
        const nestedServiceName =
          typeof nestedService?.name === "string" ? (nestedService.name as string) : undefined;
        const serviceName =
          (resourceFields["service.name" as keyof typeof resourceFields] as string | undefined) ??
          nestedServiceName ??
          null;

        const severityField = source.severity;
        const severity =
          (source.severity_text as string | undefined) ??
          (typeof severityField?.text === "string" ? severityField.text : undefined) ??
          null;

        const traceFields = source.trace;
        const traceId =
          (source.trace_id as string | undefined) ??
          (traceFields?.trace_id as string | undefined) ??
          (traceFields?.id as string | undefined) ??
          null;
        const spanField = traceFields?.span;
        const spanId =
          (source.span_id as string | undefined) ??
          (traceFields?.span_id as string | undefined) ??
          (typeof spanField?.id === "string" ? spanField.id : undefined) ??
          null;

        return {
          id: hit._id,
          timestamp,
          service: serviceName,
          severity,
          body: source.body ?? null,
          traceId,
          spanId,
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
