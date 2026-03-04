# Technical Architecture

> **Updated**: 2025-2026 industry standards reflecting cloud-native PMS evolution (Oracle OPERA Cloud, Mews, Cloudbeds), AI/ML pipeline integration, and modern observability practices.

## System Architecture Patterns

### Cloud-Native PMS Architecture (2025-2026 Standard)

Modern PMS platforms (OPERA Cloud, Mews, Cloudbeds) have converged on cloud-native, API-first architectures with event-driven communication.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    HOSPITALITY PLATFORM                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌───────────┐  │
│  │   API      │   │   Web      │   │   Mobile   │   │  AI/ML    │  │
│  │  Gateway   │   │   Portal   │   │    Apps    │   │  Pipeline │  │
│  └─────┬──────┘   └─────┬──────┘   └─────┬──────┘   └─────┬─────┘  │
│        │                │                 │               │         │
│        └────────────────┼─────────────────┼───────────────┘         │
│                         ▼                                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │               SERVICE MESH / API GATEWAY                       │  │
│  │          (Circuit breakers, rate limiting, mTLS)               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Reserv-  │ │  Front   │ │  House-  │ │ Financial│ │  Guest   │  │
│  │ ations   │ │  Desk    │ │ keeping  │ │          │ │  Profile │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │            │            │            │            │         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │               EVENT BUS / MESSAGE QUEUE (Kafka)                │  │
│  │          (Transactional outbox, exactly-once semantics)        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Room    │ │  Revenue │ │ Channel  │ │ Report   │ │  Notifi- │  │
│  │ Inventory│ │  Mgmt/AI │ │ Manager  │ │  BI/ML   │ │  cation  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │           INTEGRATION PLATFORM (OHIP / HAPI / REST)            │  │
│  │        Partner ecosystem, RMS, channel managers, IoT           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Architecture Evolution (2025-2026)

| Pattern | Legacy PMS | Cloud-Native PMS (2025-2026) |
|---------|-----------|------------------------------|
| Deployment | On-premise, monolith | Multi-cloud, containerized microservices |
| Communication | Synchronous RPC | Event-driven (Kafka/AMQP) + async commands |
| Integration | Proprietary APIs, XML/SOAP | REST/GraphQL + OHIP/HAPI standards |
| Data | Single relational DB | Polyglot persistence (RDBMS + Redis + search) |
| AI/ML | None or basic rules | Real-time pricing, demand forecasting, guest personalization |
| Multi-tenancy | Separate installations | Shared infrastructure, tenant isolation via row-level security |
| Availability | Active-passive failover | Multi-region active-active, 99.99% SLA |

### Multi-Tenancy Models

| Model | Description | Use Case | OPERA Cloud Approach |
|-------|-------------|----------|---------------------|
| **Shared DB, shared schema** | Tenant ID column + RLS | SaaS, cost-effective | Default for cloud PMS |
| **Shared DB, separate schema** | Per-tenant schema | Data isolation | Mid-tier compliance needs |
| **Separate DB** | Per-tenant database | Maximum isolation | Enterprise / data residency |
| **Hybrid** | Mix based on tier | Enterprise + SMB | Common in multi-brand groups |

> **2025-2026 Trend**: Row-level security (RLS) in PostgreSQL and Oracle has made shared-schema multi-tenancy the dominant model for cloud PMS. Data residency requirements (GDPR, India DPDP Act) increasingly require region-specific database sharding.

## Database Design

### Core Tables Structure

```
Properties
├── Rooms
│   ├── Room Types
│   └── Room Statuses
├── Reservations
│   ├── Stay Details
│   ├── Rate Details
│   └── Guest Links
├── Guests
│   ├── Profiles
│   ├── Preferences
│   └── Loyalty
├── Folios
│   ├── Transactions
│   └── Payments
└── Rates
    ├── Rate Codes
    ├── Rate Amounts
    └── Restrictions
```

### Key Relationships

| Parent | Child | Cardinality |
|--------|-------|-------------|
| Property | Room | 1:N |
| Room Type | Room | 1:N |
| Guest | Reservation | 1:N |
| Reservation | Folio | 1:1 |
| Folio | Transaction | 1:N |
| Reservation | Stay (daily) | 1:N |

### Indexing Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| reservations | (property_id, arrival_date) | Arrivals lookup |
| reservations | (confirmation_number) | Direct lookup |
| reservations | (guest_id) | Guest history |
| rooms | (property_id, status) | Availability |
| transactions | (folio_id, created_at) | Folio display |
| guests | (email) | Duplicate detection |

## Performance Benchmarks

### Response Time Targets (2025-2026 Industry Standard)

| Operation | Target | Critical | Cloud PMS Benchmark |
|-----------|--------|----------|---------------------|
| Availability search | < 200ms | < 500ms | OPERA Cloud: sub-200ms with cache |
| Room booking | < 1s | < 3s | Including inventory lock + confirmation |
| Check-in (digital) | < 2s | < 5s | Mobile check-in < 500ms (pre-staged) |
| Folio retrieval | < 300ms | < 1s | Paginated, cached |
| Room status update | < 100ms | < 500ms | Real-time push to all connected clients |
| Rate lookup | < 50ms | < 200ms | Hot cache; AI pricing response < 100ms |
| RMS pricing decision | < 500ms | < 2s | IDeaS G3 / Duetto GameChanger target |
| Guest profile lookup | < 200ms | < 500ms | Includes loyalty tier + preferences |

### Throughput Targets

| Metric | Small Property (<100 rooms) | Medium Property (100-500) | Large Property/Resort (500+) | Cloud Target |
|--------|---------------------------|---------------------------|------------------------------|--------------|
| Check-ins/hour | 20 | 100 | 500+ | Auto-scale |
| Transactions/hour | 200 | 1,000 | 10,000+ | 20K ops/sec burst |
| Availability queries/sec | 10 | 50 | 500+ | CDN + cache |
| Command throughput | 50/sec | 200/sec | 1,000+/sec | Kafka-backed |
| Event processing | 100/sec | 500/sec | 5,000+/sec | Partition-scaled |

### Scalability Considerations

| Dimension | Strategy | 2025-2026 Best Practice |
|-----------|----------|-------------------------|
| Read scaling | Read replicas, caching | Multi-region read replicas + edge caching |
| Write scaling | Sharding by property/tenant | Kafka-backed command bus + transactional outbox |
| Search scaling | Elasticsearch/dedicated search | Managed search (OpenSearch) with real-time indexing |
| File storage | Object storage (S3) | CDN-backed with signed URLs; guest documents encrypted at rest |
| Session management | Distributed cache (Redis) | Redis Cluster with AOF persistence |
| AI/ML inference | Embedded or sidecar | Dedicated inference endpoints with model versioning |
| Rate calculations | In-memory engine | Stateless calculation microservice with horizontal auto-scaling |

## Caching Strategy

### Cache Layers

| Layer | TTL | Data Type | 2026 Standard |
|-------|-----|-----------|---------------|
| L1 (in-memory) | 1-5 min | Session, configuration | Per-pod cache, invalidated via events |
| L2 (Redis Cluster) | 5-60 min | Availability, rates, guest profiles | Redis Cluster with AOF; pub/sub for invalidation |
| L3 (CDN) | Hours-days | Static content, images, rate sheets | Edge caching with stale-while-revalidate |
| L4 (Precomputed) | Event-driven | Materialized views, search indexes | CQRS read models rebuilt from events |

### Cache Invalidation

| Event | Invalidate | Strategy |
|-------|------------|----------|
| Booking created/modified | Availability cache for property+dates | Event-driven (Kafka consumer) |
| Rate changed (RMS decision) | Rate cache by property/dates/segments | Event-driven + TTL fallback |
| Room status changed | Availability cache, housekeeping views | Real-time push (WebSocket) |
| Guest profile updated | Guest cache across all services | Pub/sub invalidation |
| Content updated | CDN cache | CDN purge API + versioned URLs |

## AI/ML Infrastructure (2025-2026)

> 83.9% of hotels now use an RMS, and ML models cut forecast error by up to 54%. AI/ML is no longer optional in PMS architecture.

### AI/ML Capabilities in Modern PMS

| Capability | Use Case | Architecture Pattern |
|------------|----------|---------------------|
| Dynamic pricing | Real-time rate optimization per segment/channel | Inference microservice + cache (IDeaS G3, Duetto, Atomize) |
| Demand forecasting | Occupancy prediction 90-365 days out | Batch ML pipeline + daily refresh |
| Guest personalization | Preference-based recommendations, upsell | Feature store + real-time scoring |
| Revenue optimization | Total Revenue Management across profit centers | Multi-model ensemble + business rules |
| Chatbot/virtual concierge | Guest communication, booking assistance | LLM integration via API gateway |
| Anomaly detection | Fraud, unusual booking patterns, revenue leakage | Stream processing (Kafka Streams) |
| Forecasting accuracy | Night audit variance analysis | Feedback loop into training pipeline |

### ML Pipeline Architecture

```
Data Sources          Feature Engineering      Model Training       Inference
┌──────────┐         ┌──────────────────┐     ┌──────────────┐    ┌──────────┐
│ PMS Data │──ETL──▶ │ Feature Store    │──▶  │ Training     │──▶ │ Model    │
│ (events) │         │ (historical +    │     │ Pipeline     │    │ Registry │
│          │         │  real-time)      │     │ (scheduled)  │    │          │
├──────────┤         └──────────────────┘     └──────────────┘    └────┬─────┘
│ External │                                                          │
│ (weather,│                                                     ┌────▼─────┐
│ events,  │                                                     │ Inference │
│ compset) │                                                     │ Endpoint  │
└──────────┘                                                     └──────────┘
```

### Integration Patterns for RMS

| RMS | Integration | Latency Target | Data Flow |
|-----|-------------|----------------|-----------|
| IDeaS G3 | REST API + file-based | < 2s pricing decision | Bidirectional: PMS → occupancy/booking; RMS → rates |
| Duetto GameChanger | REST API | < 500ms rate push | Real-time push; auto-accept or manual review |
| Atomize | REST API | Real-time | Continuous rate adjustment via API |
| In-house ML | gRPC/REST microservice | < 100ms inference | Event-driven trigger from booking/rate changes |

## Event-Driven Patterns

> **2025-2026 Standard**: Transactional outbox + Kafka is the dominant pattern for PMS write operations. OPERA Cloud and modern cloud PMS platforms emit events for all state changes, enabling real-time integration without polling.

### Event Types

| Event | Trigger | Consumers | Delivery Guarantee |
|-------|---------|-----------|-------------------|
| ReservationCreated | New booking | Channel manager, CRM, housekeeping, RMS | Exactly-once (outbox) |
| ReservationModified | Change to dates/room | Same as above + availability recalc | Exactly-once (outbox) |
| GuestCheckedIn | Check-in complete | Housekeeping, F&B, concierge, loyalty | Exactly-once (outbox) |
| RoomStatusChanged | Housekeeping update | Front desk, availability, digital signage | At-least-once |
| PaymentReceived | Payment posted | Accounting, guest notification, loyalty | Exactly-once (outbox) |
| RateUpdated | RMS decision applied | Channel manager, booking engine, cache | At-least-once |
| NightAuditCompleted | End-of-day processing | Revenue reporting, roll ledger, tax | Exactly-once (outbox) |
| GuestPreferenceUpdated | Profile change | All services with guest context | At-least-once |

### Command-Event Architecture (CQRS)

```
Command Side (Write)                    Query Side (Read)
┌─────────────┐                         ┌─────────────────┐
│ API Gateway │─── POST ──▶ Command ──▶ │ Transactional   │
│             │            Center       │ Outbox          │
└─────────────┘                         └────────┬────────┘
                                                 │
                                           ┌─────▼─────┐
                                           │   Kafka    │
                                           │  Topics    │
                                           └─────┬─────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              ▼                  ▼                  ▼
                        ┌──────────┐      ┌──────────┐      ┌──────────┐
                        │ Domain   │      │ Read     │      │ Event    │
                        │ Service  │      │ Model    │      │ Archive  │
                        │ (Write)  │      │ (Cache)  │      │ (Audit)  │
                        └──────────┘      └──────────┘      └──────────┘
```

### Event Sourcing for Reservations

```
Reservation Aggregate
├── ReservationCreated
├── GuestAssigned
├── RoomAssigned
├── RateApplied
├── DepositReceived
├── CheckedIn
├── ChargePosted (multiple)
├── PaymentReceived
└── CheckedOut
```

## Security Architecture

### Authentication Layers (2025-2026 Standard)

| Layer | Method | Purpose | 2026 Requirement |
|-------|--------|---------|------------------|
| Guest portal | Email + password, social, passkeys | Guest access | FIDO2/WebAuthn support |
| Staff application | SSO (SAML/OIDC), MFA | Employee access | MFA mandatory (PCI DSS v4.0) |
| API | OAuth 2.0 + JWT + API keys | System integration | Short-lived tokens, key rotation |
| Admin | MFA required (TOTP/FIDO2) | Privileged access | Phishing-resistant MFA (FIDO2) |
| Service-to-service | mTLS + JWT | Internal communication | Zero-trust networking |

### Authorization Model

| Role | Scope | Example Permissions |
|------|-------|---------------------|
| Front desk | Property | Check in/out, view reservations |
| Housekeeping | Property | Update room status |
| Revenue manager | Property/portfolio | Rate management, RMS configuration |
| Property admin | Property | User management, configuration |
| Chain admin | All properties | Cross-property reporting |
| System/API | Service-level | Integration endpoints only |

### Security Standards (2025-2026)

| Standard | Requirement | Hotel Impact |
|----------|-------------|--------------|
| PCI DSS v4.0 | Mandatory March 2025 | MFA for all CDE access, 12-char passwords, client-side security |
| TLS 1.3 | Minimum for all connections | TLS 1.0/1.1 deprecated; 1.2 minimum, 1.3 preferred |
| OAuth 2.1 | Token security updates | Proof Key for Code Exchange (PKCE) mandatory, no implicit flow |
| Data residency | Region-specific storage | GDPR, India DPDP Act, China PIPL |
| API security | OWASP API Top 10 | Rate limiting, input validation, broken authentication |

## Observability (2025-2026 Standard)

> Modern PMS platforms use OpenTelemetry as the standard for distributed tracing, metrics, and logging. OPERA Cloud provides built-in analytics; custom cloud PMS implementations should target the three pillars below.

### Metrics

| Category | Metrics | Tool Standard |
|----------|---------|---------------|
| Business | Bookings, revenue, occupancy, ADR, RevPAR, GOPPAR | Custom dashboards + BI |
| Application | Latency (p50/p95/p99), error rate, throughput | Prometheus / Grafana |
| Infrastructure | CPU, memory, disk, network, container health | Prometheus / cloud-native |
| Database | Query time (p95), connection pool, locks, replication lag | pg_stat_statements / Grafana |
| Kafka | Consumer lag, partition throughput, DLQ depth | Kafka metrics + alerting |
| AI/ML | Model inference latency, prediction accuracy, drift detection | MLflow / custom |

### Logging

| Level | Use | Structured Fields |
|-------|-----|-------------------|
| ERROR | Failures requiring attention | `error.code`, `error.stack`, `tenant_id` |
| WARN | Degraded but functional | `degradation.type`, `circuit.state` |
| INFO | Business events, transactions | `event.type`, `entity.id`, `tenant_id` |
| DEBUG | Detailed troubleshooting | Full request/response (non-PII) |

> **Standard**: Pino (JSON structured logging) + OpenTelemetry trace context propagation. Never log PII (guest names, card numbers, emails) — use tokenized references.

### Tracing (OpenTelemetry)

| Trace Point | Purpose | Sampling |
|-------------|---------|----------|
| API gateway | Entry point timing, tenant context | 100% (headers only) |
| Service calls | Inter-service latency, dependency mapping | 10-100% adaptive |
| Database queries | Query performance, N+1 detection | 10% |
| Kafka produce/consume | Event pipeline latency, partition routing | 100% |
| External APIs | Third-party latency (RMS, channel manager, payment) | 100% |
| gRPC calls | Inventory lock latency | 100% |

### Alerting Tiers

| Tier | Severity | Response Time | Example |
|------|----------|---------------|---------|
| P1 (Critical) | Service down | < 5 min | Payment processing failure, booking API 5xx > 1% |
| P2 (High) | Degraded performance | < 15 min | p95 latency > 2x target, Kafka consumer lag > 10K |
| P3 (Medium) | Impacted functionality | < 1 hour | DLQ depth increasing, cache hit ratio < 80% |
| P4 (Low) | Monitoring alert | Next business day | Disk usage > 70%, certificate expiry < 30 days |

---

[← Back to Overview](../README.md)
