export interface LogEntry {
  id: string;
  timestamp: string | null;
  service: string | null;
  severity: string | null;
  body: unknown;
  traceId: string | null;
  spanId: string | null;
  attributes: Record<string, unknown>;
  resource: Record<string, unknown>;
}

export interface LogSearchResponse {
  entries: LogEntry[];
  nextCursor: string | null;
  total: number;
}

export interface LogQueryParams {
  service?: string;
  severity?: string;
  query?: string;
  from?: string;
  to?: string;
  size?: number;
  cursor?: string | null;
}
