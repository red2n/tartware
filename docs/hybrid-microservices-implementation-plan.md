# Hybrid Microservices Implementation Plan

_Last updated: 2025-11-03_

This plan translates the Tartware PMS long-term architecture goals into executable phases. It focuses on:

- Hybrid service model (lightweight vs. heavyweight workloads)
- Pure microservices topology with gateway, registry, telemetry, and event-driven messaging
- Kubernetes-first deployment and GitOps automation
- Canonical schema enforcement via `schema/` (UI/API/DB source of truth)
- Open-source technology stack only

---

## Guiding Principles

1. **Contract Source of Truth** — The `schema/` package governs every contract surface (API payloads, DB tables, UI models). All services consume the built artifacts.
2. **Domain-Driven Boundaries** — Services align with business domains: Core, Inventory, Bookings, Financial, Operations, Integrations, Analytics.
3. **Operational Excellence** — Observability, reliability, and security built in from day one (OpenTelemetry, mTLS, policy enforcement).
4. **Hybrid Workload Strategy** — Lightweight services optimized for request/response; heavyweight services for data/ML/analytics with asynchronous scaling.
5. **Throughput-Aware Booking Design** — Booking flows target 500k ops/sec by embracing asynchronous pipelines, sharding, and eventual consistency.
6. **100% Open Source** — Prefer CNCF or widely adopted OSS projects with active communities.

---

## Phase 0 – Readiness (Week 0)

- ✅ Create `Apps/` workspace for backend services (complete).
- ✅ Document schema source-of-truth workflow (`schema/SCHEMA_REFERENCE.md`).
- ✅ Establish architectural decision record (ADR) template in `docs/adr/`.
- ☐ Baseline current infrastructure (Docker Compose + PostgreSQL) and capture gap analysis.

**Deliverables:** ADR template, inventory of existing services, gap assessment, go/no-go checkpoint.

---

## Phase 1 – Platform Foundations (Weeks 1-3)

### Objectives
- Stand up cloud-agnostic local platform matching production topology.
- Provide scaffolding for new microservices with consistent telemetry and CI/CD.

### Tasks
1. **Kubernetes Bootstrapping**
   - Deploy management cluster (kind, k3d, or Minikube) for local dev mirror.
   - Install core operators: Cert-Manager, External Secrets, Argo CD, Helmfile/Kustomize pipeline.

2. **Network & Security Mesh**
   - Deploy Istio (ambient mesh) or Linkerd for mTLS, traffic management, zero-trust baseline.
   - Codify policies with Kyverno (resource governance) and Falco (runtime detection).

3. **Service Discovery & Gateway**
   - Roll out HashiCorp Consul (service registry + health checks).
   - Deploy Envoy Gateway or Kong OSS as ingress/API gateway.
   - Add GraphQL Router (Apollo Router) if needed for UI aggregation.

4. **Telemetry Stack**
   - Install OpenTelemetry Collector, Prometheus, Loki, Tempo, Grafana, and Alertmanager.
   - Provide shared OTEL exporters configuration for all services.

5. **CI/CD & GitOps**
   - Configure GitHub Actions (or GitLab CI) to build, test, and sign images.
   - Set up Argo CD applications per service for declarative deploys.

**Deliverables:** Helmfile/Kustomize repo, GitOps pipelines, base cluster manifests.

---

## Phase 2 – Service Carving & Contracts (Weeks 3-6)

### Objectives
- Define service boundaries and contract ownership.
- Scaffold lightweight vs. heavyweight service templates.

### Tasks
1. **Domain Mapping & ADRs**
   - Publish ADRs for each domain boundary (Core, Inventory, etc.).
   - Classify workloads: `lightweight` (stateless APIs) vs. `heavyweight` (analytics/ML/batch).

2. **Contract Enforcement**
   - Generate TypeScript SDKs/types from `schema/` for frontend and service consumption.
   - Introduce API description (OpenAPI/AsyncAPI) derived from Zod via transformers.

3. **Service Templates**
   - Lightweight template: Node.js (Fastify) or Go (Fiber) with OTEL instrumentation.
   - Heavyweight template: Python (FastAPI) or Rust (Axum) with async workers and queue consumers.
   - Include Dockerfiles, Helm charts, KEDA/HPA annotations, OTEL config, health endpoints.

4. **Async Backbone**
   - Deploy Kafka (or Redpanda), Schema Registry (Apicurio), and NATS JetStream for eventing.
   - Define canonical topic naming, retention, and dead-letter policies.
   - Publish partitioning rules (tenant/property shards, minimum 12 partitions per booking region) to sustain 500k booking ops/sec.

**Deliverables:** ADR set, service templates, generated SDKs, messaging conventions.

---

## Phase 3 – Core Service Implementation (Weeks 6-10)

### Objectives
- Build foundational microservices for multi-tenancy, bookings, and inventory.
- Integrate authentication and API gateway policies.

### Initial Services
1. **Identity & Access Service (lightweight)**
   - Auth flows, tenant-aware RBAC, API tokens; integrate with Keycloak for OIDC.
2. **Property Management Service (lightweight)**
   - CRUD for tenants, properties, users using `schema/01-core`. Frontline GraphQL/REST APIs.
3. **Reservation Orchestrator (heavyweight)**
   - Long-running workflows, queue consumers, event sourcing on bookings.
4. **Inventory Availability Service (lightweight)**
   - Real-time availability, caching, business rules for room allocations.
5. **Booking Ingress Service (lightweight)**
   - Receives booking submissions, applies contract validation, enforces idempotency keys, publishes events to booking log within 60ms P99.

### Supporting Components
- **Gateway Policies** — Rate limiting, auth, request validation.
- **Observability Dashboards** — Service golden signals, traces, domain-specific KPIs.
- **Data Storage** — PostgreSQL (transactional), Redis/KeyDB (cache), ClickHouse (analytics pilot).
- **Booking Event Log** — Kafka/Redpanda cluster sized for 500k ops/sec with multi-AZ replication and strict retention/compaction policies.

**Deliverables:** Running services in staging cluster, automated tests, dashboards, alert rules.

---

## Phase 4 – Financial & Operations Expansion (Weeks 10-15)

### Objectives
- Extend microservices to financial and operational domains.
- Introduce event-driven integrations and fraud/compliance guards.

### Tasks
1. **Financial Services (heavyweight)**
   - Billing Engine (invoice generation, payment orchestration).
   - Ledger Service (double-entry, ledger snapshots).
   - Payment Gateway Facade (wrap external PSPs, handle retries, idempotency).

2. **Operations Services (lightweight)**
   - Housekeeping Scheduler, Maintenance Request service, Staff Management.
   - Real-time messaging (WebSockets via NATS or Ably alternative) for staff mobile apps.

3. **Event Bridge & ETL**
   - Debezium CDC from PostgreSQL to Kafka for data lake ingestion.
   - Standardize event schema governance via `schema/` transformations.
   - Maintain materialized booking projections (Redis/KeyDB for hot reads, ClickHouse for analytics) to absorb 500k ops/sec read amplification.

**Deliverables:** Financial and operations services deployed, event schemas published, regulatory compliance runbooks.

---

## Phase 5 – Integrations & Analytics (Weeks 15-22)

### Objectives
- Connect external systems (OTA, GDS, CRM) and deliver analytics/AI capabilities.

### Tasks
1. **Integrations Hub (heavyweight)**
   - Connector framework (OTA, GDS, third-party APIs) with rate limits, retries, monitoring.
   - Webhook Gateway (signed payloads, replay protection) and API key management.

2. **Analytics Platform (heavyweight)**
   - Data warehouse ingestion (dbt + ClickHouse or DuckDB + Iceberg).
   - ML workload services (forecasting, pricing recommendations) using Ray or Flyte.
   - Visualization endpoints (Grafana dashboards, embedded analytics via Superset).

3. **Telemetry Enhancements**
   - Business KPIs instrumentation, tracing through event mesh, anomaly detection.

**Deliverables:** Integration connectors, analytics pipelines, AI service APIs, monitoring packs.

---

## Phase 6 – Reliability, Compliance, and Production Hardening (Weeks 22-26)

### Objectives
- Achieve production readiness with SLOs, chaos testing, and compliance.

### Tasks
1. **Reliability Engineering**
   - Define SLOs/SLIs per service, configure SLO dashboards and burn alerts.
   - Implement autoscaling policies (HPA, VPA, KEDA) tested under load.
   - Chaos experiments (LitmusChaos) to validate failure recovery.

2. **Security & Compliance**
   - Secrets via Vault, rotated automatically through External Secrets Operator.
   - mTLS enforcement, JWT validation, audit logs shipped to Loki + immutability store.
   - Align with PCI/PSD2 or relevant standards; capture evidence in compliance docs.

3. **Disaster Recovery**
   - Multi-zone deployment testing (Velero backups, database replication strategy).
   - Incident response runbooks, on-call rotation, logging retention policies.

**Deliverables:** SLO dashboards, compliance runbooks, DR verified, production launch checklist.

---

## Cross-Cutting Requirements

- **Schema Governance** — Every change to database schemas triggers updates in `schema/` and dependent SDKs. CI must fail if drift is detected.
- **Testing** — Mandatory unit, contract, integration, and chaos tests per service. Snapshot tests validate JSON structures derived from `schema/`.
- **Docs & Onboarding** — Maintain living documentation (architecture diagrams, API catalogs, runbooks) in `docs/`. Keep `README.md` sections synchronized.
- **Developer Experience** — Provide VS Code dev containers, tilt/telepresence profiles for live debugging, and makefile commands abstracting repetitive tasks.
- **High-Throughput Testing** — Maintain k6/Gatling suites and chaos scenarios that emulate 500k booking ops/sec, validating backpressure, idempotency, and degradation plans.

---

## Tooling Stack Summary

| Capability | Recommended OSS |
|------------|-----------------|
| API Gateway | Envoy Gateway / Kong OSS |
| Service Discovery | Consul / Eureka-compatible registry |
| Mesh & Security | Istio (ambient mesh) or Linkerd |
| Telemetry | OpenTelemetry + Prometheus + Loki + Tempo + Grafana |
| Messaging | Kafka (KRaft) + Apicurio Registry, NATS JetStream |
| CI/CD | GitHub Actions, Argo CD, Helmfile/Kustomize |
| Secrets | HashiCorp Vault + External Secrets Operator |
| Databases | PostgreSQL (Citus/shard-aware), Redis/KeyDB, ClickHouse |
| ML/Batch | Flyte or Ray + Spark-on-K8s |
| Testing | Vitest/Jest, k6, LitmusChaos |

---

## Milestones & Checkpoints

1. **M1 (Week 3)** — Platform stack operational; GitOps pipeline running.
2. **M2 (Week 6)** — Core service templates & schema governance automation complete.
3. **M3 (Week 10)** — Core microservices deployed in staging with SLO dashboards.
4. **M4 (Week 15)** — Financial/operations services integrated with event backbone.
5. **M5 (Week 22)** — Integrations and analytics services operational.
6. **M6 (Week 26)** — Production readiness review, compliance sign-off, launch gate.

---

## Risks & Mitigations

- **Schema Drift** — Mitigate with automated diff checks between `scripts/` and `schema/` plus contract tests.
- **Operational Complexity** — Use Infrastructure as Code (Helmfile/Kustomize), blue/green deployments, and progressive delivery (Argo Rollouts).
- **Team Alignment** — Run weekly architecture syncs, maintain ADRs, enforce code review with domain ownership.
- **Vendor Lock-In** — Stick to CNCF projects, self-hosted components, and avoid cloud-specific primitives unless abstracted.
- **Throughput Ceiling** — Mitigate via per-domain sharding, event-driven buffering, autoscaling on queue depth, and regional failover drills.

---

## Next Actions

1. Approve this plan (architecture steering committee).
2. Create ADR-000 for hybrid microservices vision and link to this document.
3. Initiate Phase 0 outstanding tasks (ADR template, gap analysis).
4. Kick off Phase 1 with platform bootstrap proof-of-concept in dev cluster.
5. Ensure `schema/` package is published internally so new services can consume types immediately.
6. Launch booking throughput load-test spike to baseline current limits and validate 500k ops/sec roadmap assumptions.

---

**Document Owner:** Architecture Team (contact: architecture@tartware.dev)

**Change Log:**
- 2025-11-03 — Initial draft (GitHub Copilot / GPT-5-Codex).
