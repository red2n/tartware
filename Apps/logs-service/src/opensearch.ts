import { Client } from "@opensearch-project/opensearch";
import type { SearchResponse } from "@opensearch-project/opensearch/api/types";

import { config } from "./config.js";

export const opensearchClient = new Client({
  node: config.opensearchUrl,
  maxRetries: 3,
  requestTimeout: 15000,
});

export type OpenSearchSource = Record<string, unknown> & {
  time?: string;
  time_unix_nano?: number;
  severity_text?: string;
  severity_number?: number;
  resource?: Record<string, unknown>;
  body?: unknown;
  trace_id?: string;
  span_id?: string;
  attributes?: Record<string, unknown>;
};

export type LogSearchResponse = SearchResponse<OpenSearchSource>;

type SearchParams = {
  index: string;
  body: {
    size: number;
    sort: Array<Record<string, { order: "asc" | "desc" }> | string>;
    query: Record<string, unknown>;
  };
  search_after?: Array<string | number>;
};

export async function searchLogs(params: SearchParams): Promise<LogSearchResponse> {
  const response = await opensearchClient.search<OpenSearchSource>({
    index: params.index,
    body: {
      ...params.body,
      search_after: params.search_after,
    },
  });
  return response.body as unknown as LogSearchResponse;
}
