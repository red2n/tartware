# Tartware PMS

A **command-driven Property Management System** built as a TypeScript monorepo targeting **20K ops/sec**. All write traffic flows through a central Command Center into Kafka; domain services consume commands asynchronously. Read traffic is proxied via the API Gateway directly to backend services.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Overall Application Flow](#overall-application-flow)
- [Service Directory](#service-directory)
  - [1. API Gateway](#1-api-gateway-port-8080)
  - [2. Core Service](#2-core-service-port-3000)
  - [3. Rooms Service](#3-rooms-service-port-3015)
  - [4. Guests Service](#4-guests-service-port-3010)
  - [5. Reservations Command Service](#5-reservations-command-service-port-3020)
  - [6. Billing Service](#6-billing-service-port-3025)
  - [7. Housekeeping Service](#7-housekeeping-service-port-3030)
  - [8. Availability Guard Service](#8-availability-guard-service-port-3045--grpc-4400)
  - [9. Notification Service](#9-notification-service-port-3055)
  - [10. Revenue Service](#10-revenue-service-port-3060)
- [Shared Libraries](#shared-libraries)
- [Industry Standards](#industry-standards)
- [Best Practices](#best-practices)
- [Quick Start](#quick-start)
- [Dev Ports](#dev-ports)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (UI / API)                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY (:8080)                              │
│  JWT Auth → Rate Limiting → Circuit Breaker → Route                 │
│    ┌─────────────┐    ┌──────────────────┐                          │
│    │ GET requests │    │ POST/PUT/DELETE  │                          │
│    │ → HTTP Proxy │    │ → Kafka Command  │                          │
│    └──────┬──────┘    └────────┬─────────┘                          │
└───────────┼────────────────────┼────────────────────────────────────┘
            │                    │
    ┌───────▼───────┐    ┌──────▼──────────────┐
    │ Backend       │    │ commands.primary     │
    │ Services      │    │ (Kafka, 12 parts)    │
    │ (HTTP GET)    │    └──────┬───────────────┘
    └───────────────┘           │
                    ┌───────────┼───────────────────────┐
                    ▼           ▼                       ▼
             Domain Services consume commands asynchronously
```

---

## Overall Application Flow

This diagram shows how a request moves through the entire Tartware ecosystem — from client to data store and back.

```mermaid
flowchart TB
    subgraph Client
        UI[PMS UI / Guest Portal]
    end

    subgraph Gateway["API Gateway (:8080)"]
        AUTH[JWT Authentication]
        RL[Rate Limiting<br/>Redis-backed]
        CB[Circuit Breaker<br/>5-fail / 30s reset]
        ROUTER{Read or Write?}
    end

    subgraph Kafka["Apache Kafka"]
        CMD_TOPIC[commands.primary<br/>12 partitions]
        RES_EVENTS[reservations.events<br/>12 partitions]
        DLQ[commands.primary.dlq<br/>Dead Letter Queue]
    end

    subgraph CommandCenter["Command Center"]
        VALIDATE[Validate Command<br/>Zod + Feature Flags]
        OUTBOX[Transactional Outbox<br/>SKIP LOCKED]
    end

    subgraph DomainServices["Domain Services"]
        CORE[Core Service :3000]
        ROOMS[Rooms Service :3015]
        GUESTS[Guests Service :3010]
        RES[Reservations Cmd :3020]
        BILLING[Billing Service :3025]
        HK[Housekeeping :3030]
        NOTIFY[Notification :3055]
        REVENUE[Revenue :3060]
    end

    subgraph Infrastructure
        PG[(PostgreSQL<br/>201 tables)]
        REDIS[(Redis<br/>Cache + Rate Limit)]
        GUARD[Availability Guard<br/>:3045 HTTP / :4400 gRPC]
    end

    UI -->|HTTPS| AUTH
    AUTH --> RL
    RL --> CB
    CB --> ROUTER

    ROUTER -->|GET / Read| CORE & ROOMS & GUESTS & BILLING & HK & NOTIFY & REVENUE
    ROUTER -->|POST / Write| VALIDATE
    VALIDATE --> OUTBOX
    OUTBOX --> CMD_TOPIC

    CMD_TOPIC --> RES & ROOMS & GUESTS & BILLING & HK & NOTIFY & REVENUE
    CMD_TOPIC -.->|Failed| DLQ

    RES -->|Events| RES_EVENTS
    RES_EVENTS --> NOTIFY & REVENUE & BILLING

    RES -->|gRPC Lock/Release| GUARD

    CORE & ROOMS & GUESTS & RES & BILLING & HK & NOTIFY & REVENUE --> PG
    AUTH --> REDIS
    RL --> REDIS
    GUARD --> PG
```

---

## Service Directory

### 1. API Gateway (Port 8080)

**Role:** Single entry point for all client traffic. Performs **zero domain logic** — it either proxies read requests to backend services or dispatches write requests as Kafka commands.

**Where it stands:** The gateway is the outermost boundary of the system. Every request — whether from the PMS UI, guest portal, or external API consumer — must pass through the gateway. It enforces authentication, rate limiting, and circuit breaking before any request reaches a domain service.

#### How It Processes a Request

```mermaid
flowchart LR
    REQ[Incoming Request] --> JWT{Valid JWT?}
    JWT -->|No| R401[401 Unauthorized]
    JWT -->|Yes| RATE{Rate Limit OK?}
    RATE -->|No| R429[429 Too Many Requests]
    RATE -->|Yes| SCOPE{Tenant Scope Valid?}
    SCOPE -->|No| R403[403 Forbidden]
    SCOPE -->|Yes| METHOD{HTTP Method?}

    METHOD -->|GET / HEAD| PROXY[Proxy to Backend]
    METHOD -->|POST / PUT / DELETE| CMD[Build Command]

    PROXY --> CB{Circuit Breaker<br/>State?}
    CB -->|CLOSED| FWD[Forward Request]
    CB -->|OPEN| R503[503 Service Unavailable]
    CB -->|HALF_OPEN| PROBE[Send Probe]
    FWD --> RESP[Return Response]
    PROBE -->|Success| FWD
    PROBE -->|Fail| R503

    CMD --> VAL[Validate Payload<br/>Zod Schema]
    VAL --> OUTBOX[Insert to Outbox<br/>in Transaction]
    OUTBOX --> ACK[202 Accepted]
```

#### Key Features

| Feature | Details |
|---------|---------|
| **Authentication** | RS256 JWT verification, role hierarchy (OWNER > ADMIN > MANAGER > STAFF > VIEWER) |
| **Rate Limiting** | Redis-backed with in-memory fallback. 200 req/min default, 60 req/min writes, 20 req/min auth |
| **Circuit Breaker** | Per-service state machine: 5-failure threshold, 30s reset timeout, half-open probing |
| **Proxy** | 30s timeout, retry on GET/HEAD (2 retries, 250ms exponential backoff with jitter) |
| **Command Dispatch** | Zod validation → transactional outbox → Kafka `commands.primary` topic |

#### Proxy Targets

| Target Service | Proxied Routes |
|---------------|---------------|
| core-service (:3000) | Tenants, properties, auth, users, dashboard, modules, settings, reports, operations, compliance, night-audit, registry |
| guests-service (:3010) | Guest CRUD, loyalty, self-service, GDPR |
| rooms-service (:3015) | Rooms, room-types, buildings, rates, rate-calendar, availability, recommendations |
| reservations-cmd (:3020) | Reservation lifecycle |
| billing-service (:3025) | Payments, charges, folios, invoices, AR, calculations, tax config |
| housekeeping (:3030) | Tasks, incidents, maintenance |
| notification (:3055) | Templates, send, history, rules |
| revenue (:3060) | Pricing rules, yield management, KPIs |

---

### 2. Core Service (Port 3000)

**Role:** The administrative backbone of the PMS. Manages tenants, users, properties, authentication, settings, reporting, and operational config. This is the largest service with **100+ REST endpoints**.

**Where it stands:** Core Service is the foundational layer that every other service depends on for tenant resolution, user authentication, and configuration data. It's the first service that must be running for the system to function.

#### How It Processes a Request

```mermaid
flowchart TB
    REQ[HTTP Request from Gateway] --> AUTH_PLUGIN[Tenant Auth Plugin]
    AUTH_PLUGIN --> EXTRACT[Extract JWT + Load Memberships]
    EXTRACT --> ROLE_CHECK{Role ≥ Required?}
    ROLE_CHECK -->|No| R403[403 Forbidden]
    ROLE_CHECK -->|Yes| MODULE_CHECK{Module Enabled?}
    MODULE_CHECK -->|No| R403
    MODULE_CHECK -->|Yes| ROUTE[Route Handler]

    ROUTE --> SERVICE[Service Layer<br/>Business Logic]
    SERVICE --> REPO[Repository Layer<br/>Parameterized SQL]
    REPO --> DB[(PostgreSQL)]
    DB --> TRANSFORM[Transform Response]
    TRANSFORM --> RESP[JSON Response]

    subgraph SettingsConsumer["Kafka Consumer"]
        KCMD[commands.primary] --> SETTINGS_CMD{Command Type?}
        SETTINGS_CMD -->|settings.value.set| SET_VAL[Set Setting Value]
        SETTINGS_CMD -->|settings.value.bulk_set| BULK_SET[Bulk Set Values]
        SETTINGS_CMD -->|settings.value.approve| APPROVE[Approve Value]
        SETTINGS_CMD -->|settings.value.revert| REVERT[Revert Value]
    end
```

#### Key Domains

| Domain | Endpoints | Description |
|--------|-----------|-------------|
| **Auth** | 7 | Login, JWT refresh, MFA (TOTP enroll/verify/rotate), password management |
| **System Admin** | 8 | Break-glass access, tenant bootstrap, system user management, impersonation |
| **Tenants & Users** | 8 | Tenant lifecycle, user CRUD, tenant-user associations, role assignment |
| **Properties** | 3 | Multi-property management per tenant |
| **Modules** | 3 | Feature module catalog + per-tenant module activation |
| **Dashboard** | 3 | KPI stats, activity feed, pending tasks |
| **Reports** | 17 | Occupancy, revenue, arrivals/departures, housekeeping, audit trail, flash reports |
| **Operations** | 12 | Cashier sessions, shift handovers, lost & found, BEOs, guest feedback, police reports |
| **Settings** | 20 | Settings catalog, per-tenant values, screen permissions, packages, amenities |
| **Booking Config** | 28 | Allotments, booking sources, market segments, channel mappings, companies, meeting rooms, events, waitlist, group bookings, promo codes, metasearch |
| **Night Audit** | 4 | Audit status, history, business calendar |
| **Compliance** | 4 | GDPR breach incident tracking + notification |
| **Service Registry** | 5 | In-memory service discovery (register, heartbeat, deregister, list) |
| **Direct Booking** | 3 | Availability search, rate quote, booking creation |

#### Kafka Commands

| Command | Description |
|---------|-------------|
| `settings.value.set` | Set a single setting value |
| `settings.value.bulk_set` | Bulk set multiple settings |
| `settings.value.approve` | Approve a pending setting change |
| `settings.value.revert` | Revert a setting to previous value |

---

### 3. Rooms Service (Port 3015)

**Role:** Manages the physical room inventory, room types, buildings, rate plans, availability, and a personalized recommendation engine. This is the inventory master of the PMS.

**Where it stands:** Rooms Service is the single source of truth for physical room data. The reservation system queries it for availability, the billing system references it for rates, and the housekeeping system references it for room status.

#### How It Processes a Request

```mermaid
flowchart TB
    subgraph ReadPath["Read Path (HTTP)"]
        GET_REQ[GET /v1/rooms/grid] --> AUTH[Tenant Auth]
        AUTH --> QUERY[Query Builder<br/>Filters + Pagination]
        QUERY --> DB[(PostgreSQL)]
        DB --> TRANSFORM[Transform + Paginate]
        TRANSFORM --> RESP[JSON Response]
    end

    subgraph WritePath["Write Path (Kafka)"]
        KAFKA[commands.primary] --> CONSUMER[Command Consumer]
        CONSUMER --> ROUTE_CMD{Command?}
        ROUTE_CMD -->|rooms.inventory.block| BLOCK[Block Room<br/>Date Range]
        ROUTE_CMD -->|rooms.status.update| STATUS[Update Room Status]
        ROUTE_CMD -->|rooms.housekeeping_status.update| HK_STATUS[Update HK Status]
        ROUTE_CMD -->|rooms.out_of_order| OOO[Mark Out of Order]
        ROUTE_CMD -->|rooms.out_of_service| OOS[Mark Out of Service]
        ROUTE_CMD -->|rooms.key.issue| KEY[Issue Digital Key]
        ROUTE_CMD -->|rooms.features.update| FEAT[Update Features]
        BLOCK & STATUS & HK_STATUS & OOO & OOS & KEY & FEAT --> DB2[(PostgreSQL)]
    end

    subgraph RecommendationEngine["Recommendation Pipeline"]
        RANK_REQ[POST /v1/recommendations/rank] --> PIPELINE[Pipeline]
        PIPELINE --> FILTER[Filter Stage<br/>Availability + Capacity]
        FILTER --> SCORE[Score Stage<br/>Guest Preferences<br/>Past Stays<br/>Room Features]
        SCORE --> HYDRATE[Hydrate Stage<br/>Enrich with Details]
        HYDRATE --> RANKED[Ranked Room List]
    end
```

#### REST Endpoints (30+)

| Category | Method | Path | Description |
|----------|--------|------|-------------|
| Rooms | GET | `/v1/rooms`, `/grid` | List / grid view with filtering |
| Rooms | POST | `/v1/rooms` | Create room |
| Rooms | GET/PUT/DELETE | `/v1/rooms/:roomId` | CRUD operations |
| Rooms | POST | `/v1/rooms/:roomId/activate` | Activate room |
| Room Types | GET | `/v1/room-types`, `/grid` | List / grid |
| Room Types | POST/PUT | `/v1/room-types` | Create / update |
| Buildings | GET/POST/PUT | `/v1/buildings` | Building management |
| Rates | GET/POST/PUT/DELETE | `/v1/rates` | Rate plan CRUD |
| Rate Calendar | GET/PUT | `/v1/rate-calendar` | Calendar entries / bulk upsert |
| Rate Calendar | POST | `/v1/rate-calendar/range-fill` | Fill date range |
| Availability | GET | `/v1/availability`, `/calendar`, `/room-types` | Availability queries |
| Recommendations | GET/POST | `/v1/recommendations`, `/rank` | Personalized room ranking |

#### Kafka Commands (10)

| Command | Description |
|---------|-------------|
| `rooms.inventory.block` | Block room inventory for date range |
| `rooms.inventory.release` | Release a manual block |
| `rooms.status.update` | Update room status (available/occupied/maintenance) |
| `rooms.housekeeping_status.update` | Update housekeeping status (clean/dirty/inspected) |
| `rooms.out_of_order` | Mark room out of order |
| `rooms.out_of_service` | Mark room out of service |
| `rooms.move` | Move/renumber a room |
| `rooms.features.update` | Update room features/amenities |
| `rooms.key.issue` | Issue digital/physical key |
| `rooms.key.revoke` | Revoke a key |

---

### 4. Guests Service (Port 3010)

**Role:** Guest profile management, GDPR/CCPA compliance, loyalty engine, and guest self-service flows (mobile check-in, direct booking, reward redemption).

**Where it stands:** Guests Service owns the guest identity. It is referenced by reservations (who is staying), billing (who to charge), and notifications (who to contact). It also powers the guest-facing self-service portal.

#### How It Processes a Request

```mermaid
flowchart TB
    subgraph ReadPath["Read Path"]
        GET[GET /v1/guests/:id] --> AUTH[Tenant Auth]
        AUTH --> SVC[Guest Service]
        SVC --> REPO[Guest Repository]
        REPO --> DB[(PostgreSQL)]
    end

    subgraph WritePath["Write Path (Kafka)"]
        KAFKA[commands.primary] --> CONSUMER[Command Consumer]
        CONSUMER --> CMD{Command?}
        CMD -->|guest.register| REG[Register Guest]
        CMD -->|guest.merge| MERGE[Merge Duplicates<br/>Canonical + Alias]
        CMD -->|guest.update_profile| PROF[Update Profile]
        CMD -->|guest.set_vip| VIP[Set VIP Level]
        CMD -->|guest.set_blacklist| BL[Set Blacklist]
        CMD -->|guest.gdpr.erase| ERASE[9-Step GDPR Erasure]
        CMD -->|loyalty.points.earn| EARN[Earn Points]
        CMD -->|loyalty.points.redeem| REDEEM[Redeem Points]
    end

    subgraph SelfService["Guest Self-Service"]
        MOBILE[POST /self-service/check-in/start] --> ID_VERIFY[Identity Verification]
        ID_VERIFY --> REG_CARD[Generate Reg Card]
        REG_CARD --> KEY_ISSUE[Issue Digital Key]

        BOOK[POST /self-service/book] --> AVAIL_CHECK[Check Availability]
        AVAIL_CHECK --> PAYMENT[Stripe Payment]
        PAYMENT --> CREATE_RES[Create Reservation]
    end

    subgraph GDPR["GDPR Compliance"]
        EXPORT[Art. 15 — Data Export]
        ERASURE[Art. 17 — Right to Erasure<br/>9-step process]
        RECTIFY[Art. 16 — Rectification]
        RESTRICT[Art. 18 — Restriction]
        CCPA[CCPA Opt-Out]
        CONSENT[Consent Ledger]
    end
```

#### Kafka Commands (15)

| Command | Description |
|---------|-------------|
| `guest.register` | Register a new guest profile |
| `guest.merge` | Merge duplicate guest profiles |
| `guest.update_profile` | Update guest profile details |
| `guest.update_contact` | Update contact information |
| `guest.set_loyalty` | Set loyalty tier/number |
| `guest.set_vip` | Set VIP status (1–5 levels) |
| `guest.set_blacklist` | Set blacklist status |
| `guest.gdpr.erase` | GDPR erasure (Art. 17) — 9-step process |
| `guest.gdpr.rectify` | GDPR rectification (Art. 16) |
| `guest.gdpr.restrict` | GDPR restriction (Art. 18) |
| `guest.consent.update` | Update consent ledger |
| `guest.preference.update` | Update guest preferences |
| `loyalty.points.earn` | Earn loyalty points |
| `loyalty.points.redeem` | Redeem loyalty points |
| `loyalty.points.expire_sweep` | Expire stale points |

---

### 5. Reservations Command Service (Port 3020)

**Role:** The heart of the PMS — manages the entire reservation lifecycle from creation through check-out, including group bookings, waitlist, OTA integration, and quote management. Primarily a **Kafka consumer** with only 1 domain REST endpoint.

**Where it stands:** Reservations is the most write-intensive service. It consumes commands from Kafka, coordinates with the Availability Guard via gRPC for inventory locks, and publishes reservation events that fan out to notification, revenue, and billing services.

#### How It Processes a Request

```mermaid
flowchart TB
    KAFKA[commands.primary<br/>Kafka Topic] --> CONSUMER[Command Consumer]
    CONSUMER --> IDEMP{Idempotency<br/>Check}
    IDEMP -->|Duplicate| SKIP[Skip — Already Processed]
    IDEMP -->|New| ROUTE{Route Command}

    ROUTE -->|reservation.create| CREATE[Create Reservation]
    ROUTE -->|reservation.check_in| CHECKIN[Check-In]
    ROUTE -->|reservation.check_out| CHECKOUT[Check-Out]
    ROUTE -->|reservation.cancel| CANCEL[Cancel]
    ROUTE -->|reservation.assign_room| ASSIGN[Assign Room]
    ROUTE -->|group.create| GROUP[Group Booking]

    CREATE --> RATE[Resolve Rate Plan]
    RATE --> GUARD_LOCK[gRPC: Lock Room<br/>Availability Guard :4400]
    GUARD_LOCK -->|Success| INSERT[INSERT reservation]
    GUARD_LOCK -->|Fail-Open| INSERT
    INSERT --> LIFECYCLE[Record Lifecycle Event]
    LIFECYCLE --> PUBLISH[Publish to<br/>reservations.events]

    CHECKIN --> VERIFY[Verify Reservation<br/>Status = CONFIRMED]
    VERIFY --> ROOM_STATUS[Update Room → Occupied]
    ROOM_STATUS --> LIFECYCLE

    CHECKOUT --> FOLIO_CHECK[Verify Folio Balance = 0]
    FOLIO_CHECK --> GUARD_RELEASE[gRPC: Release Lock]
    GUARD_RELEASE --> ROOM_CLEAN[Room → Dirty]
    ROOM_CLEAN --> LIFECYCLE

    PUBLISH --> EVENTS_TOPIC[reservations.events<br/>Kafka Topic]

    EVENTS_TOPIC --> NOTIFY_SVC[Notification Service<br/>Auto-send confirmations]
    EVENTS_TOPIC --> REVENUE_SVC[Revenue Service<br/>Update demand calendar]
    EVENTS_TOPIC --> BILLING_SVC[Billing Service<br/>Night audit roll]
```

#### Kafka Commands (38)

| Category | Commands |
|----------|----------|
| **Core Lifecycle** (13) | `reservation.create`, `.modify`, `.cancel`, `.check_in`, `.check_out`, `.assign_room`, `.unassign_room`, `.extend_stay`, `.rate_override`, `.add_deposit`, `.release_deposit`, `.no_show`, `.batch_no_show` |
| **Walk-in & Expire** (3) | `reservation.walkin_checkin`, `.expire`, `.walk_guest` |
| **Mobile Check-in** (3) | `reservation.mobile_checkin.start`, `.complete`, `.generate_registration_card` |
| **Quotes** (2) | `reservation.send_quote`, `.convert_quote` |
| **Waitlist** (4) | `reservation.waitlist_add`, `.waitlist_convert`, `.waitlist_offer`, `.waitlist_expire_sweep` |
| **Group Bookings** (6) | `group.create`, `.add_rooms`, `.upload_rooming_list`, `.cutoff_enforce`, `.billing.setup`, `.check_in` |
| **OTA Integration** (5) | `integration.ota.sync_request`, `.rate_push`, `.content_sync`, `integration.webhook.retry`, `.mapping.update` |
| **Metasearch** (3) | `metasearch.config.create`, `.config.update`, `.click.record` |

#### Availability Guard Integration (gRPC)

```mermaid
sequenceDiagram
    participant RES as Reservations Service
    participant GUARD as Availability Guard (:4400)
    participant DB as PostgreSQL

    RES->>GUARD: lockRoom(roomType, dates, ttl)
    GUARD->>DB: SELECT FOR UPDATE (conflict check)
    alt No Conflict
        GUARD->>DB: INSERT lock (with TTL)
        GUARD-->>RES: lockId + success
    else Conflict
        GUARD-->>RES: CONFLICT error
    end

    Note over RES: On check-out or cancel
    RES->>GUARD: releaseRoom(lockId)
    GUARD->>DB: UPDATE lock → RELEASED
    GUARD-->>RES: success
```

---

### 6. Billing Service (Port 3025)

**Role:** Financial engine for the PMS — handles folios, charges, payments, invoices, accounts receivable, night audit room charge posting, tax calculations, and folio routing.

**Where it stands:** Billing is triggered by reservation events (night audit posts room charges) and by direct commands (payment capture, invoice creation). It is the financial ledger of the system.

#### How It Processes a Request

```mermaid
flowchart TB
    subgraph ReadPath["Read Path (HTTP)"]
        GET[GET /v1/billing/payments] --> AUTH[Tenant Auth]
        AUTH --> SVC[Billing Service]
        SVC --> REPO[Repository<br/>Parameterized SQL]
        REPO --> DB[(PostgreSQL)]
    end

    subgraph WritePath["Write Path (Kafka)"]
        KAFKA[commands.primary] --> CONSUMER[Command Consumer]
        CONSUMER --> CMD{Command?}
        CMD -->|billing.charge.post| CHARGE[Post Charge to Folio]
        CMD -->|billing.payment.capture| CAPTURE[Capture Payment]
        CMD -->|billing.payment.refund| REFUND[Process Refund]
        CMD -->|billing.invoice.create| INVOICE[Create Invoice]
        CMD -->|billing.folio.transfer| TRANSFER[Transfer Between Folios]
        CMD -->|billing.folio.split| SPLIT[Split Folio]
        CMD -->|billing.credit_note.create| CREDIT[Issue Credit Note]
        CMD -->|night_audit.post_room_charges| NIGHT[Night Audit<br/>Post Room Charges]
        CMD -->|night_audit.no_show_sweep| NOSHOW[No-Show Sweep]
        CMD -->|night_audit.advance_business_date| ADVANCE[Advance Business Date]
    end

    CHARGE --> ROUTING{Folio Routing<br/>Rules?}
    ROUTING -->|Yes| ROUTE_FOLIO[Route to Target Folio]
    ROUTING -->|No| DEFAULT_FOLIO[Default Guest Folio]
    ROUTE_FOLIO & DEFAULT_FOLIO --> INSERT_POSTING[INSERT posting]
    INSERT_POSTING --> UPDATE_BALANCE[UPDATE folio balance]
```

#### Kafka Commands (25+)

| Category | Commands |
|----------|----------|
| **Charges** | `billing.charge.post`, `.void` |
| **Payments** | `billing.payment.capture`, `.refund`, `.apply`, `.void` |
| **Folios** | `billing.folio.create`, `.close`, `.transfer`, `.split`, `billing.folio_window.create` |
| **Invoices** | `billing.invoice.create`, `.adjust`, `.finalize`, `.void`, `billing.credit_note.create` |
| **Cashier** | `billing.cashier.open`, `.close`, `.handover` |
| **Night Audit** | `night_audit.post_room_charges`, `.no_show_sweep`, `.advance_business_date`, `.close_fiscal_period` |
| **AR** | `billing.ar.create_account`, `.post_payment` |
| **Tax** | `billing.tax_config.update` |
| **Folio Routing** | `billing.folio_routing.create`, `.update`, `.delete` |
| **Deposits** | `billing.deposit.capture`, `.release` |

---

### 7. Housekeeping Service (Port 3030)

**Role:** Manages housekeeping operations — task assignment, room inspection, deep cleaning schedules, incident reporting, lost & found, maintenance requests, staff scheduling, and cashier sessions.

**Where it stands:** Housekeeping operates in parallel with the front-desk workflow. When a guest checks out, the room status changes to "dirty," triggering housekeeping task creation. Once cleaned and inspected, the room is marked available for the next guest.

#### How It Processes a Request

```mermaid
flowchart TB
    KAFKA[commands.primary] --> CONSUMER[Command Consumer]
    CONSUMER --> CMD{Command?}

    CMD -->|housekeeping.task.create| CREATE[Create Task]
    CMD -->|housekeeping.task.assign| ASSIGN[Assign to Staff]
    CMD -->|housekeeping.task.complete| COMPLETE[Mark Complete]
    CMD -->|housekeeping.task.reassign| REASSIGN[Reassign]
    CMD -->|housekeeping.task.reopen| REOPEN[Reopen Task]
    CMD -->|housekeeping.task.bulk_status| BULK[Bulk Status Update]

    CMD -->|operations.maintenance.request| MR_CREATE[Create Maintenance<br/>Request]
    CMD -->|operations.maintenance.assign| MR_ASSIGN[Assign Technician]
    CMD -->|operations.maintenance.complete| MR_COMPLETE[Complete]
    CMD -->|operations.maintenance.escalate| MR_ESC[Escalate]

    CMD -->|operations.schedule.create| SCHED[Create Staff Schedule]
    CMD -->|billing.cashier.open| CASHIER_OPEN[Open Cashier Session]
    CMD -->|billing.cashier.close| CASHIER_CLOSE[Close Session]

    CREATE & ASSIGN & COMPLETE --> DB[(PostgreSQL)]

    subgraph ReadPath["Read Endpoints"]
        TASKS[GET /v1/housekeeping/tasks]
        INSPECT[Inspections]
        DEEP[Deep Cleans]
        INCIDENTS[Incidents]
        LNF[Lost & Found]
        MAINT[Maintenance]
        SCHED_R[Schedules]
    end
```

#### Kafka Commands (16)

| Command | Description |
|---------|-------------|
| `housekeeping.task.create` | Create a housekeeping task |
| `housekeeping.task.assign` | Assign task to staff member |
| `housekeeping.task.complete` | Mark task as completed |
| `housekeeping.task.reassign` | Reassign to different staff |
| `housekeeping.task.reopen` | Reopen a completed task |
| `housekeeping.task.add_note` | Add note to a task |
| `housekeeping.task.bulk_status` | Bulk update statuses |
| `operations.schedule.create` | Create staff schedule |
| `operations.schedule.update` | Update staff schedule |
| `operations.maintenance.request` | Create maintenance request |
| `operations.maintenance.assign` | Assign maintenance technician |
| `operations.maintenance.complete` | Complete maintenance |
| `operations.maintenance.escalate` | Escalate maintenance request |
| `billing.cashier.open` | Open cashier session |
| `billing.cashier.close` | Close cashier session |
| `billing.cashier.handover` | Cashier shift handover |

---

### 8. Availability Guard Service (Port 3045 / gRPC 4400)

**Role:** Distributed room inventory lock manager. Provides sub-millisecond lock acquisition and release via gRPC for the reservations pipeline. Prevents double-booking through pessimistic locking with TTL-based auto-expiry.

**Where it stands:** The Availability Guard sits between the reservations service and the database as a concurrency control layer. It uses `SELECT FOR UPDATE` with date-range overlap detection to prevent two reservations from booking the same room for the same dates.

#### How It Processes a Request

```mermaid
flowchart TB
    subgraph gRPC["gRPC Interface (:4400)"]
        LOCK_RPC[lockRoom RPC] --> BEARER{Bearer Token<br/>Valid?}
        BEARER -->|No| UNAUTHENTICATED[UNAUTHENTICATED]
        BEARER -->|Yes| CONFLICT_CHECK[SELECT FOR UPDATE<br/>Date Range Overlap]
        CONFLICT_CHECK -->|Conflict Found| CONFLICT_ERR[ALREADY_EXISTS]
        CONFLICT_CHECK -->|No Conflict| INSERT_LOCK[INSERT Lock<br/>with TTL]
        INSERT_LOCK --> SUCCESS[Return lockId]

        RELEASE_RPC[releaseRoom RPC] --> UPDATE_LOCK[UPDATE → RELEASED]
    end

    subgraph HTTP["HTTP Interface (:3045)"]
        POST_LOCK[POST /v1/locks] --> ADMIN_AUTH{Admin Token?}
        ADMIN_AUTH --> LOCK_SVC[Lock Service]
        DELETE_LOCK[DELETE /v1/locks/:id] --> RELEASE_SVC[Release Service]
        MANUAL_REL[POST /v1/locks/:id/manual-release] --> AUDIT[Audit Trail +<br/>Notification]
    end

    subgraph AutoExpiry["TTL Auto-Expiry"]
        TIMER[Lock TTL Expires] --> AUTO_RELEASE[Auto-release<br/>Stale Locks]
    end
```

#### Key Design Decisions

| Decision | Details |
|----------|---------|
| **Pessimistic locking** | `SELECT FOR UPDATE` prevents concurrent access to same room/date range |
| **TTL-based expiry** | Locks auto-expire via `expires_at` column, capped at `maxTtlSeconds` |
| **Idempotent re-lock** | `ON CONFLICT (id) DO UPDATE` for safe retries |
| **Fail-open mode** | Reservations proceed without locks if the guard is down (shadow mode) |
| **Manual release audit** | Transactional audit record + notification dispatch for manual overrides |

---

### 9. Notification Service (Port 3055)

**Role:** Handles all outbound communications — email, SMS, in-app notifications. It is both a **Kafka command consumer** (for explicit send commands) and a **reservation event consumer** (for automatic booking confirmations, cancellation notices, etc.).

**Where it stands:** Notification Service is a downstream consumer. It never initiates writes — it reacts to events from the reservations pipeline and commands from the gateway to send templated communications to guests and staff.

#### How It Processes a Request

```mermaid
flowchart TB
    subgraph CommandConsumer["Command Consumer (commands.primary)"]
        CMD_TOPIC[commands.primary] --> CMD{Command?}
        CMD -->|notification.send| SEND[Send Notification]
        CMD -->|notification.template.create| TPL_CREATE[Create Template]
        CMD -->|notification.template.update| TPL_UPDATE[Update Template]
        CMD -->|notification.automated.create| AUTO_CREATE[Create Auto Rule]
    end

    subgraph EventConsumer["Event Consumer (reservations.events)"]
        RES_EVENTS[reservations.events] --> CLASSIFY{Event Type?}
        CLASSIFY -->|reservation.created| CONFIRM[BOOKING_CONFIRMED]
        CLASSIFY -->|reservation.cancelled| CANCEL_NOTICE[BOOKING_CANCELLED]
        CLASSIFY -->|reservation.checked_in| CHECKIN_CONF[CHECK_IN_CONFIRMATION]
        CLASSIFY -->|reservation.checked_out| CHECKOUT_CONF[CHECK_OUT_CONFIRMATION]
        CLASSIFY -->|reservation.no_show| NOSHOW_NOTICE[NO_SHOW_NOTIFICATION]
        CLASSIFY -->|group.created| GROUP_CONF[GROUP_BOOKING_CONFIRMED]
    end

    CONFIRM & CANCEL_NOTICE & CHECKIN_CONF --> LOOKUP[Lookup Template<br/>by Code]
    LOOKUP --> RENDER[Render Template<br/>Variable Substitution]
    RENDER --> DISPATCH[Dispatch<br/>Email / SMS]
    DISPATCH --> LOG[Log to<br/>communication_log]
    DISPATCH --> IN_APP[Create In-App<br/>Notification]
    IN_APP --> SSE[SSE Push<br/>Real-time Update]

    SEND --> RENDER
```

#### Event-to-Template Mapping

| Reservation Event | Template Code |
|-------------------|---------------|
| `reservation.created` | `BOOKING_CONFIRMED` |
| `reservation.cancelled` | `BOOKING_CANCELLED` |
| `reservation.checked_in` | `CHECK_IN_CONFIRMATION` |
| `reservation.checked_out` | `CHECK_OUT_CONFIRMATION` |
| `reservation.no_show` | `NO_SHOW_NOTIFICATION` |
| `reservation.modified` | `BOOKING_MODIFIED` |
| `reservation.quoted` | `QUOTE_SENT` |
| `reservation.expired` | `RESERVATION_EXPIRED` |
| `reservation.created_from_ota` | `OTA_BOOKING_CONFIRMED` |
| `group.created` | `GROUP_BOOKING_CONFIRMED` |
| `group.rooming_list_uploaded` | `GROUP_ROOMING_LIST` |
| `group.cutoff_enforced` | `GROUP_CUTOFF_NOTICE` |

#### Kafka Commands (7)

| Command | Description |
|---------|-------------|
| `notification.send` | Send a notification using a template |
| `notification.template.create` | Create communication template |
| `notification.template.update` | Update template |
| `notification.template.delete` | Delete template |
| `notification.automated.create` | Create automated message rule |
| `notification.automated.update` | Update automated rule |
| `notification.automated.delete` | Delete automated rule |

---

### 10. Revenue Service (Port 3060)

**Role:** Revenue management system — dynamic pricing, demand forecasting, competitor rate intelligence, hurdle rates, booking pace analysis, and 30+ analytical commands. This is the most analytically intensive service.

**Where it stands:** Revenue Service is both a command consumer and a reservation event consumer. It maintains a real-time demand calendar updated by reservation events and provides pricing recommendations, competitive intelligence, and revenue KPIs to the front-desk and management.

#### How It Processes a Request

```mermaid
flowchart TB
    subgraph CommandConsumer["Command Consumer (commands.primary)"]
        CMD[commands.primary] --> ROUTE{Command Category?}
        ROUTE -->|revenue.pricing_rule.*| PRICING[Pricing Rules<br/>Create/Update/Activate]
        ROUTE -->|revenue.forecast.*| FORECAST[Revenue Forecasting<br/>Compute/Adjust/Evaluate]
        ROUTE -->|revenue.competitor.*| COMP[Competitor Intelligence<br/>Record/Import/Auto-collect]
        ROUTE -->|revenue.restriction.*| RESTRICT[Rate Restrictions<br/>CTA/CTD/LOS/Closed]
        ROUTE -->|revenue.hurdle_rate.*| HURDLE[Hurdle Rates<br/>Set/Calculate]
        ROUTE -->|revenue.recommendation.*| RECO[Recommendations<br/>Generate/Approve/Apply]
        ROUTE -->|revenue.goal.*| GOAL[Revenue Goals<br/>Create/Track]
        ROUTE -->|revenue.daily_close.*| CLOSE[Daily Close<br/>Process]
    end

    subgraph EventConsumer["Event Consumer (reservations.events)"]
        RES_EVENTS[reservations.events] --> DEMAND{Event?}
        DEMAND -->|reservation.created| INC[Increment OTB<br/>Rooms]
        DEMAND -->|reservation.cancelled| DEC[Decrement OTB<br/>Rooms]
        DEMAND -->|reservation.checked_out| ACTUAL[Update Actual<br/>Occupancy]
        INC & DEC & ACTUAL --> CALENDAR[Update Demand<br/>Calendar]
    end

    subgraph ReadPath["Read Endpoints (22)"]
        KPI[GET /v1/revenue/kpis]
        FCST[GET /v1/revenue/forecasts]
        DEMAND_CAL[GET /v1/revenue/demand-calendar]
        COMP_RATES[GET /v1/revenue/competitor-rates]
        PACE[GET /v1/revenue/booking-pace]
        SEGMENT[GET /v1/revenue/segment-analysis]
        CHANNEL[GET /v1/revenue/channel-profitability]
        DISPLACEMENT[GET /v1/revenue/displacement-analysis]
    end
```

#### Kafka Commands (32)

| Category | Commands |
|----------|----------|
| **Pricing Rules** (5) | `revenue.pricing_rule.create`, `.update`, `.activate`, `.deactivate`, `.delete` |
| **Forecasting** (3) | `revenue.forecast.compute`, `.adjust`, `.evaluate` |
| **Demand** (2) | `revenue.demand.update`, `.import_events` |
| **Competitor Intel** (4) | `revenue.competitor.record`, `.bulk_import`, `.configure_compset`, `.auto_collect` |
| **Competitive Response** (1) | `revenue.competitive_response.configure` |
| **Restrictions** (3) | `revenue.restriction.set`, `.remove`, `.bulk_set` |
| **Hurdle Rates** (2) | `revenue.hurdle_rate.set`, `.calculate` |
| **Goals** (4) | `revenue.goal.create`, `.update`, `.delete`, `.track_actual` |
| **Daily Close** (1) | `revenue.daily_close.process` |
| **Booking Pace** (1) | `revenue.booking_pace.snapshot` |
| **Group Evaluation** (1) | `revenue.group.evaluate` |
| **Recommendations** (5) | `revenue.recommendation.generate`, `.approve`, `.reject`, `.apply`, `.bulk_approve` |

#### Read Endpoints (22)

| Category | Endpoints |
|----------|-----------|
| **Pricing** | pricing-rules, rate-recommendations, competitor-rates, demand-calendar, rate-restrictions, hurdle-rates, rate-shopping, competitive-response-rules |
| **Reports** | forecasts, goals, kpis, compset-indices, displacement-analysis, budget-variance, booking-pace, managers-daily-report, channel-profitability, forecast-accuracy, segment-analysis |

---

## Shared Libraries

These packages contain no domain logic — they provide infrastructure, patterns, and utilities shared across all services.

| Package | Purpose | Used By |
|---------|---------|---------|
| **@tartware/fastify-server** | Standardized Fastify server builder with Helmet, CORS, RFC 9457 error responses, Prometheus `/metrics`, Swagger/OpenAPI auto-generation | All HTTP services |
| **@tartware/config** | Environment variable loading with Zod validation, DB pool creation, retry utilities, Kafka config resolution | All services |
| **@tartware/telemetry** | OpenTelemetry SDK (traces + logs), Pino structured logging with PII auto-redaction (credit cards via Luhn, emails, passports, IBANs) | All services |
| **@tartware/tenant-auth** | Fastify plugin for JWT auth + multi-tenant context extraction. Role hierarchy enforcement (`withTenantScope()` decorator), module-based access control | All HTTP services |
| **@tartware/outbox** | Transactional outbox pattern for exactly-once Kafka publishing. `SKIP LOCKED` dequeue, tenant throttling | api-gateway, reservations-cmd |
| **@tartware/command-center-shared** | Command dispatch SQL repositories, command registry, feature flag management, command validation + outbox insertion | api-gateway |
| **@tartware/command-consumer-utils** | Kafka consumer lifecycle management, DLQ payload builder, consumer metrics, `createKafkaProducer` | All Kafka consumers |
| **@tartware/openapi-utils** | Zod-to-JSON-Schema conversion for Fastify route schemas (OpenAPI 3.x compatible) | All HTTP services |

---

## Industry Standards

Tartware implements industry-standard hospitality patterns and protocols:

| Standard | Implementation |
|----------|----------------|
| **USALI (Uniform System of Accounts for the Lodging Industry)** | Chart of accounts structure, revenue categorization, department-based P&L reporting |
| **PCI DSS Compliance** | No raw card storage, tokenized payments, PII redaction in logs (Luhn detection), parameterized queries |
| **GDPR (EU General Data Protection Regulation)** | Art. 15 (data export), Art. 16 (rectification), Art. 17 (erasure — 9-step process), Art. 18 (restriction), consent ledger, retention sweep |
| **CCPA (California Consumer Privacy Act)** | Opt-out support, privacy settings per guest |
| **RFC 9457 (Problem Details for HTTP APIs)** | Structured error responses with `type`, `title`, `status`, `detail`, `instance` on all services |
| **OpenAPI 3.0.3** | Auto-generated Swagger specs on all 10+ services |
| **W3C Trace Context** | Distributed tracing with OpenTelemetry, trace ID propagation across all services |
| **STR (Smith Travel Research) Metrics** | Competitive set indices, RevPAR, ADR, occupancy benchmarking |
| **HTNG (Hotel Technology Next Generation)** | OTA integration patterns, channel mapping, rate push, content sync |
| **Night Audit Process** | Room charge posting, no-show sweep, business date advance, fiscal period close — standard hotel end-of-day workflow |
| **Folio Management** | 5 folio types (guest, master, company, group, house), windowed folios, routing rules, split/transfer |
| **Revenue Management** | Hurdle rates, CTA/CTD/LOS restrictions, dynamic pricing, demand forecasting, competitive response rules |
| **Guest Lifecycle** | 10 reservation statuses, VIP levels (1–5), loyalty tiers, preference tracking, merge/deduplicate |
| **CQRS + Event Sourcing** | Command-Query Responsibility Segregation with Kafka event bus and transactional outbox pattern |

---

## Best Practices

### Architecture & Scalability

| Practice | Implementation |
|----------|----------------|
| **CQRS** | Reads (HTTP proxy) and writes (Kafka commands) are completely separated |
| **Transactional Outbox** | All Kafka publishes go through a DB outbox table first, ensuring exactly-once semantics with `SKIP LOCKED` dequeue |
| **Circuit Breaker** | Per-service state machine (CLOSED → OPEN → HALF_OPEN) with configurable thresholds and Prometheus metrics |
| **Idempotency** | Every command supports deduplication via idempotency keys with fail-open/fail-closed modes |
| **Dead Letter Queue** | Failed commands routed to `commands.primary.dlq` with full context for replay |
| **Tenant Isolation** | Every DB query scoped by `tenant_id`; no cross-tenant data leakage |
| **Graceful Shutdown** | SIGTERM/SIGINT handlers drain Kafka consumers, close DB pools, use `Promise.allSettled` |

### Security

| Practice | Implementation |
|----------|----------------|
| **100% Parameterized Queries** | Zero string concatenation in SQL — all queries use `$1, $2, ...` placeholders |
| **Zod Input Validation** | Every route body, query param, and command payload validated with Zod schemas |
| **JWT Authentication** | RS256 with issuer/audience validation, grace window rotation |
| **RBAC** | 5-tier role hierarchy with module-level permissions and screen-permission UI |
| **PII Redaction** | Pino logger with 40+ redaction paths; auto-detects credit cards (Luhn), emails, passports, IBANs |
| **Rate Limiting** | Redis-backed distributed rate limiting with tiered limits per endpoint type |
| **Helmet + CORS** | Helmet security headers on all services, explicit CORS allow-list |
| **MFA** | TOTP enrollment, verification, and rotation |

### Data & Database

| Practice | Implementation |
|----------|----------------|
| **Schema-First Development** | SQL and Zod schemas kept in lockstep; `schema/` is single source of truth |
| **201 Tables** | Comprehensive normalized schema with proper 3NF and intentional JSONB for flexible structure |
| **Idempotent DDL** | All migrations use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING` |
| **Audit Trails** | `created_at`, `updated_at`, `created_by`, `updated_by` on all tables with soft-delete support |
| **CHECK Constraints** | Status enums, non-negative amounts, business invariants enforced at DB level |
| **Pagination** | All list endpoints paginated with `limit`/`offset` and sane caps |
| **No N+1 Queries** | JOINs/CTEs and batched `IN (...)` queries for list endpoints |

### Observability

| Practice | Implementation |
|----------|----------------|
| **Distributed Tracing** | OpenTelemetry SDK with W3C context propagation, Jaeger export |
| **Structured Logging** | Pino with JSON output, trace context injection, 40+ PII redaction paths |
| **Prometheus Metrics** | `/metrics` endpoint on all services with default Node.js metrics |
| **Health Checks** | `/health` (liveness) and `/ready` (readiness with DB + Kafka checks) on all services |

### Code Quality

| Practice | Implementation |
|----------|----------------|
| **Biome** | Fast linter + formatter across all packages |
| **Knip** | Dead code / unused export detection |
| **ESLint** | TypeScript-aware linting with strict rules |
| **Vitest** | 72 test files across services |
| **Per-Service CI** | Individual GitHub Actions workflows per service |

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose up -d postgres redis kafka

# Bootstrap Kafka topics
pnpm run kafka:topics

# Start all services
pnpm run dev
```

## Dev Ports

| Port | Service | Protocol |
|------|---------|----------|
| 8080 | API Gateway | HTTP |
| 3000 | Core Service | HTTP |
| 3005 | Settings Service | HTTP |
| 3010 | Guests Service | HTTP |
| 3015 | Rooms Service | HTTP |
| 3020 | Reservations Command Service | HTTP + Kafka |
| 3025 | Billing Service | HTTP + Kafka |
| 3030 | Housekeeping Service | HTTP + Kafka |
| 3035 | Command Center Service | Kafka |
| 3040 | Recommendation Service | HTTP |
| 3045 | Availability Guard Service | HTTP + gRPC (4400) |
| 3050 | Roll Service | Kafka (internal) |
| 3055 | Notification Service | HTTP + Kafka |
| 3060 | Revenue Service | HTTP + Kafka |
| 3065 | Guest Experience Service | Kafka |
| 3070 | Calculation Service | HTTP |
| 3075 | Service Registry | HTTP |

## License

UNLICENSED — Proprietary
