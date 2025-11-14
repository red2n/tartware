# Logs Service

The logs service exposes a lightweight REST API that lets the Tartware UI query OTLP logs stored in OpenSearch. It applies simple filtering (service, severity, text search, time range) and uses cursor-based pagination so the UI can stream new batches without paying the deep pagination cost.

## Local development

```bash
# Ensure OpenSearch + OTLP collector are running (docker compose up opensearch-node otel-collector)
cd Apps/logs-service
npm install
npm run dev
```

| Environment variable | Description | Default |
| --- | --- | --- |
| `PORT` | HTTP port for the service | `3100` |
| `OPENSEARCH_URL` | Connection string for OpenSearch | `http://localhost:9200` |
| `LOGS_INDEX_PATTERN` | Index or pattern to search | `otel-logs-*` |
| `MAX_PAGE_SIZE` | Upper bound for `size` query param | `200` |

## API

`GET /v1/logs`

Query parameters:

| Param | Description |
| --- | --- |
| `service` | Filter by `resource.service.name` |
| `severity` | Filter by `severity_text` |
| `query` | Query string applied to all indexed fields |
| `from` / `to` | ISO timestamps for date range |
| `size` | Page size (default 50, max 200) |
| `cursor` | Base64 encoded search cursor for pagination |

Response:

```json
{
  "entries": [
    {
      "id": "abc",
      "timestamp": "2025-11-14T10:00:00.000Z",
      "service": "api-gateway",
      "severity": "INFO",
      "body": "Processed request",
      "traceId": "…",
      "spanId": "…",
      "attributes": { "http.status_code": 200 }
    }
  ],
  "nextCursor": "…",
  "total": 1234
}
```
