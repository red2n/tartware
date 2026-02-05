# Technical Architecture

## System Architecture Patterns

### Microservices Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    HOSPITALITY PLATFORM                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐                    │
│  │   API      │   │   Web      │   │   Mobile   │                    │
│  │  Gateway   │   │   Portal   │   │    Apps    │                    │
│  └─────┬──────┘   └─────┬──────┘   └─────┬──────┘                    │
│        │                │                 │                          │
│        └────────────────┼─────────────────┘                          │
│                         ▼                                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    SERVICE MESH                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Reserv-  │ │  Front   │ │  House-  │ │ Financial│ │  Guest   │  │
│  │ ations   │ │  Desk    │ │ keeping  │ │          │ │  Profile │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │            │            │            │            │         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │               EVENT BUS / MESSAGE QUEUE                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │  Room    │ │   Rate   │ │ Channel  │ │ Report   │               │
│  │ Inventory│ │ Management│ │ Manager  │ │   BI     │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Multi-Tenancy Models

| Model | Description | Use Case |
|-------|-------------|----------|
| **Shared DB, shared schema** | Tenant ID column | SaaS, cost-effective |
| **Shared DB, separate schema** | Per-tenant schema | Data isolation |
| **Separate DB** | Per-tenant database | Maximum isolation |
| **Hybrid** | Mix based on tier | Enterprise + SMB |

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

### Response Time Targets

| Operation | Target | Critical |
|-----------|--------|----------|
| Availability search | < 500ms | < 1s |
| Room booking | < 2s | < 5s |
| Check-in | < 3s | < 10s |
| Folio retrieval | < 500ms | < 2s |
| Room status update | < 200ms | < 1s |
| Rate lookup | < 100ms | < 500ms |

### Throughput Targets

| Metric | Small Property | Medium Property | Large Property |
|--------|----------------|-----------------|----------------|
| Rooms | < 100 | 100-500 | 500+ |
| Check-ins/hour | 20 | 100 | 500+ |
| Transactions/hour | 200 | 1,000 | 10,000+ |
| Availability queries/sec | 10 | 50 | 500+ |

### Scalability Considerations

| Dimension | Strategy |
|-----------|----------|
| Read scaling | Read replicas, caching |
| Write scaling | Sharding by property/tenant |
| Search scaling | Elasticsearch/dedicated search |
| File storage | Object storage (S3) |
| Session management | Distributed cache (Redis) |

## Caching Strategy

### Cache Layers

| Layer | TTL | Data Type |
|-------|-----|-----------|
| L1 (in-memory) | 1-5 min | Session, configuration |
| L2 (Redis) | 5-60 min | Availability, rates |
| L3 (CDN) | Hours | Static content, images |

### Cache Invalidation

| Event | Invalidate |
|-------|------------|
| Booking created | Availability cache |
| Rate changed | Rate cache by property/dates |
| Room status changed | Availability cache |
| Content updated | CDN cache |

## Event-Driven Patterns

### Event Types

| Event | Trigger | Consumers |
|-------|---------|-----------|
| ReservationCreated | New booking | Channel manager, CRM, housekeeping |
| ReservationModified | Change to dates/room | Same as above |
| GuestCheckedIn | Check-in complete | Housekeeping, F&B, concierge |
| RoomStatusChanged | Housekeeping update | Front desk, availability |
| PaymentReceived | Payment posted | Accounting, guest notification |

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

### Authentication Layers

| Layer | Method | Purpose |
|-------|--------|---------|
| Guest portal | Email + password, social | Guest access |
| Staff application | SSO, MFA | Employee access |
| API | OAuth 2.0 + API keys | System integration |
| Admin | MFA required | Privileged access |

### Authorization Model

| Role | Scope | Example Permissions |
|------|-------|---------------------|
| Front desk | Property | Check in/out, view reservations |
| Housekeeping | Property | Update room status |
| Revenue manager | Property/portfolio | Rate management |
| Property admin | Property | User management, configuration |
| Chain admin | All properties | Cross-property reporting |

## Observability

### Metrics

| Category | Metrics |
|----------|---------|
| Business | Bookings, revenue, occupancy |
| Application | Latency, error rate, throughput |
| Infrastructure | CPU, memory, disk, network |
| Database | Query time, connections, locks |

### Logging

| Level | Use |
|-------|-----|
| ERROR | Failures requiring attention |
| WARN | Degraded but functional |
| INFO | Business events, transactions |
| DEBUG | Detailed troubleshooting |

### Tracing

| Trace Point | Purpose |
|-------------|---------|
| API gateway | Entry point timing |
| Service calls | Inter-service latency |
| Database queries | Query performance |
| External APIs | Third-party latency |

---

[← Back to Overview](../README.md)
