## Implementation Plan

1. **Reservation Event Processor (JVM microservice)**  
   - Define shared Avro/protobuf schemas for reservation events emitted by Node services.  
   - Build a Spring Boot (or Quarkus) consumer using Kafka Streams to ingest, validate, and persist reservation mutations with partition-aware concurrency.  
   - Implement dead-letter topics, retry/backoff policies, and exposure of ingestion metrics/health endpoints.  
   - Benchmark throughput vs. the existing Node consumer and switch the API gateway write path once parity is reached.

2. **Real-Time Metrics Pipeline**  
   - Stream reservation and payment events into a dedicated Kafka topic or CDC feed.  
   - Create a Flink/Spark job that maintains per-tenant/property occupancy + revenue summaries inside Redis or Pinot for <50 ms read latency.  
   - Refactor `Apps/core-service` dashboard/report routes to read from the materialized store and add cache invalidation hooks.  
   - Schedule periodic reconciliation jobs to refresh long-range analytics (month/year) for accuracy.

3. **Telemetry Fan-In Layer**  
   - Deploy an OpenTelemetry Collector (or Vector) cluster that receives OTLP spans/logs from every Node process.  
   - Configure batching, sampling, and export pipelines to OpenSearch/Jaeger so applications no longer block on HTTP exporters.  
   - Update `@tartware/telemetry` defaults to point at the collector service with graceful fallbacks and alerting.

4. **Bloom Filter & Cache Maintenance Job**  
   - Implement a JVM worker that pages through the `users` table, streams usernames into Redis Bloom filters, and refreshes TTLed caches incrementally.  
   - Run the job on deployment and nightly; publish Prometheus metrics so `core-service` can detect stale filters.  
   - Remove the synchronous warm-up step from `Apps/core-service/src/index.ts` after verifying the external job’s reliability.

5. **Billing & Settlement Service**  
   - Design a Java microservice that owns payment ingestion, gateway callbacks, FX conversions, and ledger reconciliation.  
   - Emit normalized payment events for analytics while writing authoritative ledger entries to Postgres.  
   - Expose audit/export endpoints (PCI/SOX ready) and have the Node billing API consume reconciled data for consistency.
