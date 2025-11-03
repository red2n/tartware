# Phase 0 Gap Analysis

_Last updated: 2025-11-03_

## Purpose
Document the current Tartware backend runtime (Docker Compose + PostgreSQL) and highlight the gaps relative to the hybrid microservices target, with special focus on the 500k booking ops/sec requirement.

---

## Current Runtime Snapshot

- **Environment**: Single Docker Compose stack
  - `tartware-postgres` container exposing PostgreSQL 16 on `127.0.0.1:5432`
  - Database: `tartware`, user: `postgres`, password: `postgres`
  - No additional services (cache, message queue, metrics) are running locally
- **API Surface**: `Apps/core-service` Fastify server (proto) connecting directly to PostgreSQL
- **Contracts**: `schema/` package generated Zod models; consumed directly by the service
- **Tooling**: Local Knip + ESLint + TypeScript for lint/build validation

### Observed Characteristics
- RPS capacity limited to single Fastify instance and database host (no load distribution)
- Booking writes execute synchronously against PostgreSQL; no queueing or async buffering
- PostgreSQL configured with default shared buffers, connection limits, synchronous commits
- No infrastructure automation beyond Compose (no IaC, no GitOps)
- Observability minimal (Fastify logs only); no distributed tracing, metrics, or alerts

---

## Target vs. Current Gap Summary

| Capability | Target State | Current State | Gap / Risk |
|------------|--------------|---------------|------------|
| **Platform** | Kubernetes (multi-AZ), GitOps, mesh | Docker Compose | No orchestration, no declarative deploys |
| **Ingress** | Envoy/Kong + global LB | Direct Fastify | No routing, security policies, rate limits |
| **Booking Throughput** | 500k ops/sec via async + sharding | <500 ops/sec synchronous writes | High risk; no queueing, no partitioning |
| **Data Layer** | Sharded/Postgres+Citus, Redis, ClickHouse | Single Postgres instance | Single point of failure, limited IOPS |
| **Messaging** | Kafka/Redpanda + schema registry + NATS | None | Cannot decouple or scale services |
| **Observability** | OTEL, Prometheus, Loki, Tempo, Grafana | App logs | No telemetry or alerting |
| **Testing** | Automated load (k6/Gatling), chaos, contract | Manual curl | No throughput validation |
| **Security** | mTLS, Vault, policy agents | None | No secrets management or zero-trust controls |

---

## Immediate Remediation Actions

1. **Provision Dev Cluster**: Stand up local kind/k3d cluster with Helmfile scaffold (Phase 1 kick-off).
2. **Event Backbone POC**: Deploy Kafka + NATS to enable async booking pipeline.
3. **Database Scaling Plan**: Draft ADR covering sharding strategy (e.g., Citus vs. partitioned clusters).
4. **Load Test Baseline**: Build k6 scenario against current booking API to measure max sustainable RPS.
5. **Observability Bootstrap**: Install OTEL Collector + Prometheus stack for metrics/traces.
6. **Security Foundations**: Introduce Vault/ESO and service mesh (Istio ambient) for mTLS.

---

## Metrics to Capture During Phase 1

- Booking ingress latency (P50/P95/P99) vs. throughput
- PostgreSQL CPU, I/O, connection pool saturation under load
- Kafka partition utilization once async flow is introduced
- Mesh traffic telemetry (egress/ingress) and error budgets
- Queue depth and consumer lag for booking pipeline

---

## Dependencies & Open Questions

- Need infrastructure provisioning decision (self-hosted vs. managed Kubernetes).
- Confirm tenancy shard key (tenant_id vs. property_id) for partitioning strategy.
- Determine acceptable consistency window for booking confirmation (eventual vs. immediate).
- Align with finance team on transactional guarantees for payment capture during peak events.
