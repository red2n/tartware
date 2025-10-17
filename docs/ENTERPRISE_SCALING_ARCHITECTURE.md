# Enterprise Scaling Architecture Guide

**For High-Volume Multi-Property Management Systems (60K+ Properties)**

---

## Table of Contents

1. [Overview](#overview)
2. [The Challenge](#the-challenge)
3. [Current Design vs Enterprise Requirements](#current-design-vs-enterprise-requirements)
4. [Enterprise Architecture Components](#enterprise-architecture-components)
5. [Database Architecture Strategy](#database-architecture-strategy)
6. [Sharding Strategy](#sharding-strategy)
7. [Infrastructure Specifications](#infrastructure-specifications)
8. [Performance Targets](#performance-targets)
9. [Evolution Path: MVP to Enterprise](#evolution-path-mvp-to-enterprise)
10. [Cost Estimates](#cost-estimates)
11. [Recommendations](#recommendations)

---

## Overview

This document outlines the architectural requirements and recommendations for scaling a property management system from a small/medium deployment to **enterprise-scale** similar to major hospitality brands like Marriott (60,000+ properties worldwide).

### Key Metrics

- **Properties**: 60,000+
- **Total Rooms**: ~8 million
- **Daily Availability Checks**: Billions
- **Daily Reservations**: Millions
- **Peak Traffic**: 500K+ requests/second
- **Uptime SLA**: 99.99% (52 minutes downtime/year)

---

## The Challenge

### Marriott-Scale Requirements

| Metric | Value |
|--------|-------|
| Properties | 60,000+ worldwide |
| Total Rooms | ~8 million |
| Brands | 30+ (Marriott, Courtyard, Ritz-Carlton, etc.) |
| Regions | Americas, EMEA, APAC |
| Availability Checks | Billions/day |
| Reservations | Millions/day |
| Peak Traffic | 500K+ req/sec |
| Sustained Traffic | 100K+ req/sec |
| Uptime SLA | 99.99% |

### Why Single PostgreSQL Won't Work

A single PostgreSQL instance (current design) would:
- **Crash in seconds** at this scale
- Max capacity: 1K-10K req/sec
- Unable to handle global distribution
- Single point of failure
- No geographic redundancy

---

## Current Design vs Enterprise Requirements

### Current Design (Phase 1: MVP)

```
┌─────────────────────────────────┐
│  Single PostgreSQL Instance     │
├─────────────────────────────────┤
│  • public schema (40 tables)    │
│  • availability schema (1 table)│
│  • All data in one location     │
└─────────────────────────────────┘

Capacity: 1K-5K req/sec
Good for: 1-100 properties
Cost: $100-500/month
```

### Enterprise Requirements (Phase 4)

```
┌──────────────────────────────────────────────────┐
│          Global Multi-Region Architecture        │
├──────────────────────────────────────────────────┤
│  • 100+ PostgreSQL shards                        │
│  • 100+ Redis nodes                              │
│  • 30+ Elasticsearch nodes                       │
│  • 20+ ClickHouse nodes                          │
│  • 30+ Kafka brokers                             │
│  • Multi-region (Americas, EMEA, APAC)           │
└──────────────────────────────────────────────────┘

Capacity: 500K+ req/sec
Good for: 60,000+ properties
Cost: $500K-1M/month
```

---

## Enterprise Architecture Components

### 1. Global Architecture

```
                    ┌──────────────────┐
                    │  Global DNS/CDN  │
                    │  (CloudFlare)    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  AMERICAS  │ │   EMEA     │ │   APAC     │
       │   Region   │ │  Region    │ │  Region    │
       └────────────┘ └────────────┘ └────────────┘
              │              │              │
              └──────────────┴──────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Data Sync Layer │
                    │  (Kafka, CDC)    │
                    └──────────────────┘
```

### 2. Regional Architecture

Each region (Americas, EMEA, APAC) contains:

```
                  ┌──────────────────┐
                  │  Load Balancer   │
                  │  (AWS ALB/NLB)   │
                  └────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ API Gateway │ │ API Gateway │ │ API Gateway │
    │  Cluster 1  │ │  Cluster 2  │ │  Cluster 3  │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
    ┌────────────────┐          ┌────────────────┐
    │ Microservices  │          │  Cache Layer   │
    │   Cluster      │◄────────▶│  (Redis)       │
    └────────┬───────┘          └────────────────┘
             │
    ┌────────┴────────────────────────────────────┐
    │                                             │
    ▼                                             ▼
┌─────────────────────┐              ┌──────────────────────┐
│  DATABASE LAYER     │              │  SEARCH & ANALYTICS  │
└─────────────────────┘              └──────────────────────┘
```

---

## Database Architecture Strategy

### Component Breakdown

#### 1. Sharded PostgreSQL Clusters (Transactional Data)

**Purpose**: ACID-compliant transactional operations

**Sharding Strategy**: BRAND_ID + REGION_CODE

**Example Allocation**:
- Shard 001: Marriott Hotels - US Northeast (4,000 properties)
- Shard 002: Marriott Hotels - US Southeast (4,500 properties)
- Shard 003: Marriott Hotels - US Midwest (3,000 properties)
- Shard 004: Marriott Hotels - US West (4,000 properties)
- Shard 005: Marriott Hotels - Canada (800 properties)
- Shard 006-049: Other brands by region
- Shard 050: Ritz-Carlton - Global (100 properties)
- ...
- Shard 100: Residence Inn - US West (2,000 properties)

**Each Shard Contains**:
```
┌────────────────────────────────────────┐
│  PostgreSQL Shard N                    │
├────────────────────────────────────────┤
│  • Primary (Writes)                    │
│  • 3-5 Read Replicas                   │
│  • Hot Standby (Failover)              │
│  • Cross-region replica (DR)           │
│                                        │
│  Tables:                               │
│  ├─ tenants (brand-specific)           │
│  ├─ properties (subset)                │
│  ├─ reservations (shard-specific)      │
│  ├─ payments                           │
│  ├─ invoices                           │
│  ├─ folios                             │
│  ├─ guests (shard-specific)            │
│  └─ room_types, rates, rooms           │
│                                        │
│  Size: 500-5000 properties/shard       │
│  Load: 5K-20K req/sec per shard        │
└────────────────────────────────────────┘
```

**Connection Routing**:
- PgBouncer per shard (connection pooling)
- Vitess or Citus for automatic routing
- Application-level routing by brand/region

**Routing Logic**:
```
1. Extract brand_id from property
2. Extract region from property
3. Calculate: Hash(brand_id + region)
4. Lookup shard mapping table
5. Route to correct shard cluster
```

---

#### 2. Global Reference Tables (Replicated)

**Purpose**: Configuration and user data that needs global consistency

```
┌────────────────────────────────────────┐
│  Global PostgreSQL (Read-Only)        │
├────────────────────────────────────────┤
│  Tables:                               │
│  • users (global staff)                │
│  • rate_strategies                     │
│  • market_segments                     │
│  • booking_sources                     │
│  • Configuration tables                │
│                                        │
│  Replication:                          │
│  • Primary in US East                  │
│  • Replicas in all regions             │
│  • Eventual consistency OK             │
└────────────────────────────────────────┘
```

---

#### 3. Redis Clusters (Hot Data - CRITICAL)

**Availability Cache** (Primary Use Case):

```
┌────────────────────────────────────────┐
│  Redis Cluster (Availability)          │
├────────────────────────────────────────┤
│  Structure:                            │
│  Key: avail:{property_id}:{date}       │
│  Value: {                              │
│    "room_types": {                     │
│      "STD": {avail: 10, reserved: 5},  │
│      "DLX": {avail: 5, reserved: 8}    │
│    }                                   │
│  }                                     │
│                                        │
│  Sharding: By property_id (hash)       │
│  Nodes: 50-100 nodes per region        │
│  Replication: 3x per node              │
│  Memory: 2-5TB total                   │
│                                        │
│  Hot data: Next 90 days                │
│  TTL: Varies by date proximity         │
│  Updates: Real-time on every booking   │
│                                        │
│  Backup: PostgreSQL (async)            │
│  Recovery: Rebuild from PostgreSQL     │
└────────────────────────────────────────┘
```

**Calculation**:
- 60K properties × 10 room types × 90 days = 54 million keys
- ~500GB-1TB per region

**Session/Cache Cluster**:

```
┌────────────────────────────────────────┐
│  Redis Cluster (Sessions)              │
├────────────────────────────────────────┤
│  • User sessions                       │
│  • Rate limits (per user/IP)           │
│  • Distributed locks                   │
│  • Temporary data                      │
│  • API response cache                  │
│                                        │
│  Nodes: 20-30 per region               │
└────────────────────────────────────────┘
```

---

#### 4. Elasticsearch Clusters (Search)

**Purpose**: Full-text search, faceted search, geo-spatial queries

```
┌────────────────────────────────────────┐
│  Elasticsearch Cluster                 │
├────────────────────────────────────────┤
│  • Property search (60K properties)    │
│  • Guest search (millions)             │
│  • Reservation search                  │
│  • Full-text across multiple fields    │
│                                        │
│  Sharding: By brand/region             │
│  Nodes: 30-50 per region               │
│  Data: Synced from PostgreSQL (CDC)    │
│                                        │
│  Indices:                              │
│  ├─ properties (60K docs)              │
│  ├─ guests (millions)                  │
│  ├─ reservations (billions)            │
│  └─ Geo-spatial for location search    │
└────────────────────────────────────────┘
```

**Use Cases**:
- "Find all Marriott properties near Times Square"
- "Search guests by name/email/phone across all properties"
- "Find reservations with specific criteria"

---

#### 5. ClickHouse (Analytics & Reporting)

**Purpose**: Data warehouse for historical analysis and reporting

```
┌────────────────────────────────────────┐
│  ClickHouse Cluster                    │
├────────────────────────────────────────┤
│  • Historical reservations             │
│  • Financial transactions              │
│  • Analytics metrics                   │
│  • Audit logs                          │
│  • Business intelligence               │
│                                        │
│  Partitioning:                         │
│  • By date (monthly)                   │
│  • By brand                            │
│  • Compression enabled                 │
│                                        │
│  Data Source:                          │
│  • Kafka topics (CDC from PostgreSQL)  │
│  • Batch loads (nightly)               │
│  • Real-time streaming                 │
│                                        │
│  Nodes: 20-40 per region               │
│  Storage: Petabyte-scale               │
│  Query Speed: <1 second for TB data    │
└────────────────────────────────────────┘
```

**Tables**:
- `analytics_metrics` (all historical)
- `analytics_reports`
- `audit_logs` (all events)
- `reservation_history` (cold data: 2+ years)

---

#### 6. Cassandra/ScyllaDB (Time-Series Events)

**Purpose**: Write-optimized event store for high-throughput logging

```
┌────────────────────────────────────────┐
│  Cassandra/ScyllaDB Cluster            │
├────────────────────────────────────────┤
│  • Reservation events                  │
│  • Price changes                       │
│  • Inventory updates                   │
│  • User activity logs                  │
│  • Audit trail                         │
│                                        │
│  Write-optimized for high throughput   │
│  Partitioned by time + property_id     │
│                                        │
│  Nodes: 15-30 per region               │
│  Replication: 3x                       │
└────────────────────────────────────────┘
```

---

#### 7. Kafka (Event Streaming & Data Sync)

**Purpose**: Event streaming, CDC, cross-shard synchronization

```
┌────────────────────────────────────────┐
│  Kafka Cluster (Event Streaming)      │
├────────────────────────────────────────┤
│  Topics:                               │
│  ├─ reservation.created                │
│  ├─ reservation.modified               │
│  ├─ availability.updated               │
│  ├─ payment.processed                  │
│  ├─ guest.created                      │
│  └─ ... (100+ topics)                  │
│                                        │
│  Used for:                             │
│  • Cross-shard sync                    │
│  • Cache invalidation                  │
│  • Analytics streaming                 │
│  • Search index updates                │
│  • Audit logging                       │
│                                        │
│  Nodes: 20-30 brokers per region       │
│  Retention: 7-30 days                  │
└────────────────────────────────────────┘
```

---

## Sharding Strategy

### Shard Key Design

**Primary Shard Key**: `BRAND_ID + REGION_CODE`

**Why This Approach**:
1. **Natural data isolation**: Properties rarely move brands/regions
2. **Query efficiency**: Most queries are brand/region-specific
3. **Load balancing**: Distribute by brand size and region
4. **Geographic proximity**: Data close to users

### Shard Allocation Example

| Shard | Brand | Region | Properties | Capacity |
|-------|-------|--------|-----------|----------|
| 001 | Marriott Hotels | US Northeast | 4,000 | 20K req/sec |
| 002 | Marriott Hotels | US Southeast | 4,500 | 20K req/sec |
| 003 | Marriott Hotels | US Midwest | 3,000 | 15K req/sec |
| 004 | Marriott Hotels | US West | 4,000 | 20K req/sec |
| 005 | Marriott Hotels | Canada | 800 | 5K req/sec |
| 006 | Courtyard | US Northeast | 3,000 | 15K req/sec |
| 007 | Courtyard | US Southeast | 3,500 | 18K req/sec |
| ... | ... | ... | ... | ... |
| 050 | Ritz-Carlton | Global | 100 | 3K req/sec |
| ... | ... | ... | ... | ... |
| 100 | Residence Inn | US West | 2,000 | 10K req/sec |

### Cross-Shard Queries

**Challenge**: Some queries span multiple shards

**Solutions**:
1. **Scatter-Gather**: Query all relevant shards, merge results
2. **Denormalization**: Duplicate data where needed
3. **Eventual Consistency**: Accept slight delays for consistency
4. **Reference Cache**: Keep lookup tables in Redis

---

## Infrastructure Specifications

### Per-Region Deployment

| Component | Nodes | Purpose | Specs per Node |
|-----------|-------|---------|----------------|
| PostgreSQL Shards | 100 shards | Transactional data | Primary + 3-5 replicas |
| Redis (Availability) | 50-100 | Hot availability cache | 64-128GB RAM |
| Redis (Sessions) | 20-30 | Sessions, locks, cache | 32-64GB RAM |
| Elasticsearch | 30-50 | Search indices | 128GB RAM, 1TB SSD |
| ClickHouse | 20-40 | Analytics warehouse | 256GB RAM, 10TB SSD |
| Cassandra | 15-30 | Event logs | 128GB RAM, 2TB SSD |
| Kafka Brokers | 20-30 | Event streaming | 64GB RAM, 1TB SSD |

### Network Architecture

```
┌─────────────────────────────────────────────────┐
│  CDN Layer (CloudFlare/Akamai)                 │
│  • Static content delivery                      │
│  • DDoS protection                              │
│  • Geographic routing                           │
└────────────┬────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│  Load Balancers (AWS ALB/NLB)                   │
│  • SSL termination                              │
│  • Health checks                                │
│  • Auto-scaling triggers                        │
└────────────┬────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│  API Gateway Clusters                           │
│  • Authentication                               │
│  • Rate limiting                                │
│  • Request routing                              │
└────────────┬────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│  Microservices (Kubernetes)                     │
│  • Reservation Service                          │
│  • Availability Service                         │
│  • Payment Service                              │
│  • Guest Service                                │
│  • ...                                          │
└─────────────────────────────────────────────────┘
```

---

## Performance Targets

### Response Time SLAs

| Operation | Target | 95th Percentile | 99th Percentile |
|-----------|--------|-----------------|-----------------|
| Availability Check | <10ms | <15ms | <25ms |
| Search Property | <50ms | <75ms | <100ms |
| Create Reservation | <100ms | <150ms | <200ms |
| Process Payment | <200ms | <300ms | <400ms |
| Analytics Query | <1s | <2s | <5s |

### Throughput Targets

| Metric | Target |
|--------|--------|
| Peak Traffic | 500K req/sec |
| Sustained Traffic | 100K req/sec |
| Database Writes | 50K writes/sec |
| Cache Hits | 95%+ |
| Search QPS | 10K queries/sec |

### Availability Targets

| Metric | Target | Annual Downtime |
|--------|--------|-----------------|
| Overall System | 99.99% | 52 minutes |
| Database Cluster | 99.999% | 5 minutes |
| Cache Layer | 99.9% | 8.7 hours |
| Search | 99.9% | 8.7 hours |

---

## Evolution Path: MVP to Enterprise

### Phase 1: MVP (Current)

**Timeline**: 0-6 months
**Properties**: 1-100
**Capacity**: 1K-5K req/sec
**Cost**: $100-500/month
**Team**: 1-3 developers

**Infrastructure**:
- Single PostgreSQL instance
- 2 schemas (public + availability)
- All data in one location

**Development Focus**:
- Build application features
- Insert sample data
- Test with first customers
- Establish monitoring

---

### Phase 2: Growth

**Timeline**: 6-18 months
**Properties**: 100-1,000
**Capacity**: 10K-30K req/sec
**Cost**: $2,000-5,000/month
**Team**: 3-5 developers

**Add**:
- PostgreSQL read replicas (3-5 nodes)
- Redis for availability caching
- PgBouncer for connection pooling
- Basic monitoring (Prometheus/Grafana)

**Code Changes**:
- Add Redis SDK
- Implement cache-aside pattern
- Read from replicas, write to primary
- **NO database schema changes needed!**

**Architecture**:
```
┌─────────────┐
│  App Layer  │
└──────┬──────┘
       │
   ┌───┴────┐
   │ Redis  │ (Cache)
   └───┬────┘
       │
┌──────┴──────────┐
│ PostgreSQL      │
│  • Primary      │
│  • Replica 1    │
│  • Replica 2    │
│  • Replica 3    │
└─────────────────┘
```

---

### Phase 3: Regional

**Timeline**: 18-36 months
**Properties**: 1,000-10,000
**Capacity**: 50K-100K req/sec
**Cost**: $20,000-50,000/month
**Team**: 8-15 developers

**Add**:
- First sharding (3-5 shards by region)
- Elasticsearch for search
- ClickHouse for analytics
- Kafka for event streaming
- Multi-region deployment

**Code Changes**:
- Add shard routing middleware
- Implement distributed transactions
- Handle cross-shard queries carefully
- **Still same schema! Just distributed**

**Architecture**:
```
                ┌─────────────┐
                │  App Layer  │
                └──────┬──────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
   │ Shard 1 │    │ Shard 2 │    │ Shard 3 │
   │ US East │    │ US West │    │  Canada │
   └─────────┘    └─────────┘    └─────────┘
```

---

### Phase 4: Enterprise (Marriott-Level)

**Timeline**: 3-5 years
**Properties**: 60,000+
**Capacity**: 500K+ req/sec
**Cost**: $500,000-1,000,000/month
**Team**: 50+ engineers

**Scale to**:
- 50-100 PostgreSQL shards
- 100+ Redis nodes
- 30+ Elasticsearch nodes
- 20+ ClickHouse nodes
- 30+ Kafka brokers
- Global deployment (Americas, EMEA, APAC)

**Your Schema**: **STILL THE SAME! Just more copies.**

---

## Cost Estimates

### Phase 1: MVP

| Item | Monthly Cost |
|------|--------------|
| PostgreSQL (Single) | $50-200 |
| Monitoring | $20-50 |
| Backup Storage | $10-20 |
| Load Balancer | $20-50 |
| **Total** | **$100-500** |

---

### Phase 2: Growth

| Item | Monthly Cost |
|------|--------------|
| PostgreSQL Cluster (Primary + 3 Replicas) | $800-1,500 |
| Redis (3 nodes) | $300-600 |
| PgBouncer | $100-200 |
| Monitoring (Prometheus/Grafana) | $200-400 |
| Backup Storage | $100-200 |
| Load Balancers | $200-400 |
| CDN | $100-300 |
| **Total** | **$2,000-5,000** |

---

### Phase 3: Regional

| Item | Monthly Cost |
|------|--------------|
| PostgreSQL Clusters (5 shards) | $8,000-15,000 |
| Redis Clusters | $3,000-6,000 |
| Elasticsearch | $3,000-6,000 |
| ClickHouse | $2,000-4,000 |
| Kafka | $1,500-3,000 |
| Monitoring & Observability | $1,000-2,000 |
| Load Balancers & Networking | $1,000-2,000 |
| CDN & Edge | $500-1,000 |
| Storage (Backups, Archives) | $1,000-2,000 |
| **Total** | **$20,000-50,000** |

---

### Phase 4: Enterprise (Marriott-Level)

| Item | Nodes | Cost per Node | Monthly Total |
|------|-------|---------------|---------------|
| PostgreSQL Clusters | 100 shards | $2,000 | $200,000 |
| Redis (Availability) | 300 | $500 | $150,000 |
| ClickHouse | 60 | $1,500 | $90,000 |
| Elasticsearch | 90 | $800 | $72,000 |
| Cassandra | 60 | $1,000 | $60,000 |
| Kafka | 60 | $800 | $48,000 |
| Load Balancers, CDN, etc. | - | - | $50,000 |
| **Total** | **~700 nodes** | - | **$670,000** |

**Annual Cost**: ~$8,000,000

**Note**: For 60K properties generating billions in revenue, this is typically 0.5-1% of total revenue.

---

## Recommendations

### For Current Stage (MVP)

✅ **Keep your current single PostgreSQL design**

**Why**:
- You have `tenant_id` on 33 tables → Shard-ready
- You have `property_id` on 25 tables → Partition-ready
- Separate availability schema → Good isolation thinking
- All foreign keys in place → Data integrity ready
- Proper indexes → Query patterns defined

✅ **Focus on**:
- Build application features first
- Insert sample data and test
- Add monitoring (response times, query counts)
- Launch with first 10-50 properties
- Gather real usage metrics

---

### When to Scale

#### Add Read Replicas + Redis (Phase 2)
**Trigger**: When you hit **5K req/sec** or **100+ properties**

**Metrics to Watch**:
- Database CPU > 70% sustained
- Query response time > 100ms
- Connection pool exhaustion
- Cache miss rate > 50%

---

#### Implement Sharding (Phase 3)
**Trigger**: When you hit **30K req/sec** or **1,000+ properties**

**Metrics to Watch**:
- Read replicas maxed out
- Database size > 1TB
- Cross-property queries slow
- Regional latency issues

---

#### Full Enterprise Scale (Phase 4)
**Trigger**: When you hit **100K+ req/sec** or **10,000+ properties**

**Requirements**:
- Actual traffic demanding it
- Revenue to fund $500K+/month infrastructure
- Team of 50+ engineers
- Multi-region customer base
- Monitoring showing clear bottlenecks

---

### Don't Over-Engineer Now!

**Reasons to START SIMPLE**:

1. **Complexity**: Distributed systems are HARD to debug
2. **Cost**: $500K+/month vs $100-500/month
3. **Team**: Need 50+ engineers vs 1-3 developers
4. **Time**: 3-5 years to build vs 0-6 months
5. **Reality**: 90% of features work fine on single DB

**What Marriott Did**:
- Started with single DB (1980s-1990s)
- Added sharding around 2005-2010
- Full distributed system by 2015-2020
- **Took 30+ years to reach current scale!**

---

### Scale Up When You Have

✅ **Actual traffic** demanding it
✅ **Revenue** to fund it
✅ **Team** to build it
✅ **Monitoring** showing bottlenecks
✅ **Customer base** requiring global presence

---

## Table Distribution Strategy

### Sharded PostgreSQL (50-100 shards)

**Shard Key**: `BRAND_ID + REGION_CODE`

**Per Shard** (~1,000 properties):
- `tenants` (1-2 brands)
- `properties` (500-2,000)
- `room_types`
- `rooms`
- `rates`
- `reservations` (HOT: last 2 years)
- `guests` (local to shard)
- `payments`
- `invoices`
- `folios`

**Capacity**: Each shard handles 5K-20K req/sec

---

### Redis Cluster (100+ nodes per region)

**Hot Data** (next 90 days):
- `room_availability` cached
  - 60K properties × 10 room types × 90 days
  - = 54 million keys
  - ~500GB-1TB per region

**Other Data**:
- Session cache (millions of sessions)
- Rate limits (per user/IP)
- Distributed locks

---

### ClickHouse (20+ nodes per region)

**Cold Data**:
- `analytics_metrics` (ALL historical)
- `analytics_reports`
- `audit_logs` (ALL events)
- `reservation_history` (2+ years old)

**Features**:
- Compressed, columnar storage
- Query response: <1 second for TB-scale data

---

### Elasticsearch (30+ nodes per region)

**Searchable Data**:
- `properties` (with geo-spatial)
- `guests` (full-text)
- `reservations` (recent only)

---

### Cassandra (20+ nodes per region)

**Event Logs** (time-series):
- Event logs
- Availability history
- Price change history

---

## Summary

### Your Current Design

✅ **Excellent foundation**
✅ `tenant_id` everywhere = shard-ready
✅ `property_id` everywhere = partition-ready
✅ All FKs in place = data integrity
✅ Good for 1K-10K req/sec

### Path to Marriott-Scale

1. **Start simple** (now) - Single PostgreSQL
2. **Add Redis + replicas** (6-12 months) - 10K-30K req/sec
3. **Implement sharding** (18-24 months) - 50K-100K req/sec
4. **Full distributed** (3-5 years) - 500K+ req/sec

### Key Takeaway

**Don't redesign now. Your current database is perfect.**

Build features. Get customers. Scale when metrics demand it.

**Worry about Marriott-scale when you have Marriott's revenue.** 😉

---

## Appendix

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Database | PostgreSQL 16+ | Transactional ACID data |
| Cache | Redis 7+ | Hot data, sessions |
| Search | Elasticsearch 8+ | Full-text search |
| Analytics | ClickHouse 23+ | Data warehouse |
| Events | Cassandra/Scylla | Time-series logs |
| Streaming | Apache Kafka | Event streaming |
| Monitoring | Prometheus + Grafana | Metrics & dashboards |
| Tracing | Jaeger / Zipkin | Distributed tracing |
| Load Balancing | AWS ALB/NLB | Traffic distribution |
| CDN | CloudFlare / Akamai | Global content delivery |
| Container Orchestration | Kubernetes | Microservices management |

### Monitoring Metrics

**Key Metrics to Track**:
- Requests per second
- Response time (p50, p95, p99)
- Database CPU/Memory/Disk
- Cache hit rate
- Error rate
- Availability (uptime)
- Queue depth
- Connection pool usage

### Further Reading

- PostgreSQL Sharding: https://www.postgresql.org/docs/current/ddl-partitioning.html
- Vitess (MySQL sharding): https://vitess.io/
- Citus (PostgreSQL sharding): https://www.citusdata.com/
- Redis Cluster: https://redis.io/topics/cluster-tutorial
- Elasticsearch Scaling: https://www.elastic.co/guide/en/elasticsearch/reference/current/scalability.html
- ClickHouse Architecture: https://clickhouse.com/docs/en/development/architecture/
- Apache Kafka: https://kafka.apache.org/documentation/

---

**Document Version**: 1.0
**Last Updated**: October 16, 2025
**Author**: Tartware Architecture Team
