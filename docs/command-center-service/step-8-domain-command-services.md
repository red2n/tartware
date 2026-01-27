# Step 8: Domain Command Service Decision Notes

## Goal
Decide whether integrations, analytics, and operations domains need dedicated
command services (high-volume, fan-out) or remain CRUD/low-velocity services.

## Decision Criteria
- Sustained write throughput exceeds 500 ops/sec per domain or spikes require buffering.
- Fan-out to 2+ downstream targets or side effects (billing, notifications, inventory).
- External rate limits/backpressure require async retries and pacing.
- Commands must be replayable with strict idempotency/deduplication.
- Latency tolerance allows async processing and eventual consistency.
- Per-tenant throttling or routing policies are required.

## Current Inventory
No dedicated integrations/analytics/operations services exist in Apps/.
Command catalog includes:
- Integrations: `integration.ota.sync_request`, `integration.ota.rate_push`,
  `integration.webhook.retry`, `integration.mapping.update`.
- Analytics: `analytics.metric.ingest`, `analytics.report.schedule`.
- Operations: `operations.maintenance.request`, `operations.incident.report`,
  `operations.asset.update`, `operations.inventory.adjust`.

## Recommendation (Now)
- Do not create new command services yet. Keep these commands in the catalog,
  but treat them as disabled or routed to placeholder targets until domain
  services are ready.
- Integrations: likely needs a command service once OTA sync/rate pushes are
  frequent (rate-limited external calls + retries).
- Analytics: metric ingest should go to a dedicated pipeline (streaming or
  warehouse ingestion) once volume is high; report scheduling can stay low-velocity.
- Operations: maintenance/incidents are typically low volume; CRUD in a future
  operations service is sufficient until volume grows.

## Triggers to Revisit
- Any domain exceeds 500 ops/sec sustained or 2K ops/sec peak for >5 minutes.
- Fan-out to 2+ services becomes mandatory for correctness.
- External API quotas require centralized throttling and retry queues.
- Need for DLQ replay tooling in that domain becomes operationally critical.
