# Infra Uplift Blueprint (20k ops/sec Target)

## 1. Guiding Principles

1. **Blast Radius Isolation** – run each tier (ingress, compute, data, streaming, observability) in its own autoscaling group / Kubernetes workload with per-tier SLOs and clear failure domains.
2. **Stateless Edge, Stateful Core** – Fastify services remain stateless, pulling config from env/consul and pushing durable work into Kafka + Postgres. All stateful tiers run with leader election, replication, and automated failover.
3. **Event-First Writes** – every CRUD mutation flows through Kafka. Postgres projections become consumers of the streams, so horizontal API replicas never execute cross-node transactions.

## 2. Target Topology (per region)

| Layer | Technology | Notes |
| --- | --- | --- |
| Ingress | L7 load balancer (e.g. AWS ALB/GCP HTTPS LB) | Terminates TLS, distributes to API gateway pods. |
| API Gateway | Fastify service on Kubernetes (2–6 replicas) | Stateless; readiness gate ensures downstreams reachable. |
| Core / Reservation Services | Fastify services on Kubernetes (3–10 replicas each) | Auto-scaled on CPU + queue depth; rely on shared Redis for cache/Bloom filter. |
| Stream Platform | Kafka cluster (3 brokers, 3 ZooKeeper or KIP-500 mode) | 3 AZ spread, SSD-backed storage, 12+ partitions/topic, ISR=2. |
| Command Processing | Reservations command service (Kafka producer + consumer) | Each consumer group scaled to N pods; cooperative-sticky rebalancing enabled. |
| Datastore | Postgres cluster with streaming replicas or Citus/Cockroach for sharding | Primary handles writes; read replicas or shards serve projections / analytics. |
| Cache | Redis Cluster (3 shards + 1 replica each) | Enables Bloom filters + rate limiting; sentinel or managed service for failover. |
| Observability | OTEL collector DaemonSet + managed OpenSearch/Tempo/Prometheus | Every service exports traces/logs/metrics over OTLP gRPC. |

## 3. Kafka Scaling Plan

1. **Bootstrap 3-broker cluster** (e.g., MSK/Confluent Cloud). Configure:
   - `num.partitions=24` minimum for reservations events.
   - `min.insync.replicas=2`, `default.replication.factor=3`.
   - Rack-aware placement across AZs.
2. **Migrate producers** to support multiple bootstrap addresses (already handled via `KAFKA_BROKERS`). Enable idempotent producers in `kafkajs` (`enableIdempotence: true`, `maxInFlightRequests: 5`) for exactly-once semantics.
3. **Consumers**: enable cooperative-sticky rebalancing, set `session.timeout.ms=45000`, and roll out horizontal pods up to partition count. Add lag metrics (Kafka Exporter) feeding Prometheus alerts.
4. **DLQ & Replay**: standardize `<topic>.dlq` topics with retention 7d; add n8n/worker job to replay dead letters after remediation.

## 4. Database Partitioning Plan

1. **Short Term**: promote managed Postgres (Aurora, AlloyDB, etc.) with:
   - 1 writer, 2+ read replicas.
   - Connection pooling via PgBouncer sidecars.
   - Logical replication slot feeding Debezium/Flink for projections.
2. **Mid Term**: adopt Citus/Cockroach for horizontal partitioning.
   - Shard by `tenant_id` (hash) for bookings/financial tables.
   - Keep small global tables (modules, settings) unsharded.
   - Use coordinator connection string for migrations; application DSN routed via pooler aware of shard.
3. **Schema Guardrails**:
   - Enforce tenant_id presence in sharded tables.
   - Add global sequence generator (Snowflake IDs) to avoid ID collisions.
4. **Failover Testing**: quarterly simulated failovers (promote replica, observe API impact) recorded in runbooks.

## 5. Service Scaling Hooks

1. **Pod Readiness/Startup Probes** – each Fastify service exposes:
   - `/healthz` (existing) for liveness.
   - `/readyz` that checks DB + Kafka connectivity, rejects traffic until caches warm.
2. **Graceful Shutdown** – ensure signal handlers stop consuming Kafka, flush telemetry, drain HTTP connections before the pod is terminated (already started; confirm for every service).
3. **Idempotent Config** – env-var based configuration stored in Secrets/ConfigMaps; no mutable local disk writes.
4. **Autoscaling Signals**:
   - API gateway / core-service HPA: CPU 70% + custom metric (requests per second).
   - Reservations command service: consumer lag via KEDA (scale from 1 → N on lag thresholds).

## 6. Sequenced Execution Plan

1. **Phase 0 – Baseline** (done): load testing + tracing.
2. **Phase 1 – Domain Events & Projections** (done): all reservation CRUD via Kafka, projection freshness monitoring.
3. **Phase 2 – Reliability Layer** (in progress): idempotency keys enforced across ingress plus a DB-backed retry/ack sweeper with a `/v1/reliability/status` + `/reliability/dashboard` console for ops.
4. **Phase 3 – Horizontal Hooks** (in progress): readiness endpoints, autoscaling config, signal-safe shutdown, stateless caches.
5. **Phase 4 – Infra Rollout**:
   - Deploy multi-broker Kafka; cut producers/consumers over.
   - Migrate Postgres to managed HA; enable read replicas.
   - Introduce Redis Cluster + sentinel.
6. **Phase 5 – Partitioning / Streaming Analytics**:
   - Introduce Citus/Cockroach (or Spanner) for sharded workloads.
   - Stand up Flink/Pinot for near-real-time dashboards.
7. **Phase 6 – Capacity Validation**:
   - Re-run k6 + chaos tests at 20k ops/sec.
   - Document new SLOs, alert playbooks, and rollback paths.

## 7. Deliverables & Ownership

- **Infra-as-Code** (Terraform/Pulumi) modules for Kafka, Postgres, Redis, OTEL collector.
- **Runbooks** for:
  - Kafka broker replacement.
  - Postgres failover / replica promotion.
  - Redis shard failover.
- **Observability Dashboards** (Grafana/OpenSearch Dashboards) showing:
  - Requests/sec, p95 latency per service.
  - Kafka consumer lag per topic.
  - DB replica lag and connection saturation.
  - Projection lag stats (fed from `/v1/monitoring/reservations/projection`).

Following this blueprint keeps the stack cloud-portable (managed services or self-hosted on Kubernetes) and provides clear checkpoints before attempting the 20k ops/sec target in production. Update this document as each phase lands so ops has a single source of truth for the scaling posture.
