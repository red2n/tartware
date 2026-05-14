# PMS Gap Report — Apps/ (summary)

Date: 2026-05-13

This document captures the primary functional gaps discovered in the `Apps/` workspace vs. standard Property Management System (PMS) expectations, the specific files that should be changed or added, and a concise implementation approach for each gap.

---

## High priority gaps

1) Channel Manager / OTA connectors
- Description: OTA/channel interactions are currently stubbed (simulated pushes). Production integrations (SiteMinder, Cloudbeds, Booking/Expedia, GDS) are missing.
- Impact: revenue leakage, rate/availability sync failures, manual work for channel management.
- Files to modify / add:
  - `Apps/reservations-command-service/src/services/reservation-commands/ota-integration.ts` — replace stubbed push with pluggable adapter usage.
  - `Apps/reservations-command-service/src/services/reservation-commands/index.ts` / `processOtaReservationQueue` — ensure queue uses the adapter and robust retry/backoff.
  - `Apps/core-service/src/data/catalog/integration-channel-management.ts` — surface configuration options for channel credentials and sandbox endpoints.
  - Add new package: `Apps/integrations/channel-manager/` with adapters: `adapters/siteminder.ts`, `adapters/cloudbeds.ts`, plus a `ChannelClient` interface.
- Approach:
  1. Define a `ChannelClient` interface: `pushRates()`, `pushInventory()`, `pushReservations()`, `cancelReservation()`.
  2. Implement a thin adapter wrapper that uses configured credentials and exposes a sandbox mode for testing.
  3. Replace direct stubs in `ota-integration.ts` with an injected adapter factory; continue to use Outbox for durable delivery.
  4. Acceptance: successful end-to-end rate push to a channel sandbox, automated test covering happy + transient error + retry.

2) Bank-feed ingestion & automated reconciliation
- Description: No bank-feed ingestion connector (Plaid/MT940/Yodlee) or automated bank reconciliation flow was found; reconciliation appears manual.
- Impact: manual GL reconciliation, slower close, increased accounting errors.
- Files to modify / add:
  - `Apps/billing-service/src/lib/gl-posting.ts` — add reconciliation hooks / mapping points for bank statements.
  - `Apps/billing-service/src/services/bank-feed-service.ts` (new) — service to ingest statements, parse, and create matching candidates against `general_ledger_entries` and folios.
  - Update module registry: `Apps/core-service/src/modules/module-registry.ts` to enable a "Bank feed reconciliation" module with config.
- Approach:
  1. Implement a pluggable importer (MT940, CSV) and optional Plaid connector for modern banks.
  2. Build fuzzy-matching logic: amount / date / reference → candidate transactions; create `reconciliation` table (or use existing ledger hooks) and a reconciliation job that proposes matches and optionally auto-applies when confidence is high.
  3. Add nightly job to ingest and reconcile statements; expose manual review endpoints in the billing UI.

3) Multi-gateway payment abstraction & token vault
- Description: Stripe adapter exists, but there is no clear pluggable multi-gateway abstraction and no dedicated token vault service for processor-agnostic tokenization.
- Impact: vendor lock-in risk, hard to onboard alternative processors, and unclear central token handling for PCI compliance.
- Files to modify / add:
  - `Apps/guests-service/src/services/stripe-payment-gateway.ts` — refactor into `PaymentProcessor` adapter implementing a common interface.
  - `Apps/billing-service/src/services/webhook-dispatcher.ts` — ensure generic webhook mapping is routed through the new abstraction.
  - Add new package: `Apps/payment-gateway/` (core interface + implementations: `stripe/`, `adyen/` skeleton).
  - Add new service: `Apps/payment-vault/` (if central vault is desired) or integrate token vault into `payment-gateway` as a secure token store.
- Approach:
  1. Define `PaymentProcessor` interface: `tokenize()`, `charge()`, `authorize()`, `capture()`, `refund()`, `webhookHandler()`.
  2. Move Stripe implementation behind that interface; wire provider selection by tenant configuration; migrate `payment_tokens` usage to the new vault API.
  3. Acceptance: ability to add a second processor stub and process a charge using configuration switch without code changes.

4) Reporting / Data‑Warehouse ETL & scheduled report runner
- Description: Reporting artifacts and night-audit catalog exist, but there is no dedicated ETL/worker for exporting events / roll ledger to a DW (S3/BigQuery/Redshift/Snowflake) nor a general scheduled-report runner.
- Impact: limited BI, manual exports, poor long-term analytics reliability.
- Files to modify / add:
  - `Apps/core-service/src/data/catalog/reporting-analytics-night-audit.ts` — add references to schedule + target sinks.
  - Add new service: `Apps/reporting-worker/` with `src/jobs/report-scheduler.ts` and `src/sinks/s3.ts` (or a `kafka-connect` sink implementation).
  - Consider small changes to `Apps/outbox/dispatcher.ts` to optionally forward specific event types to ETL sinks.
- Approach:
  1. Use Outbox events as primary source; implement a worker that drains specific topics/events and writes partitioned NDJSON/Parquet to S3.
  2. Provide an optional connector for BigQuery/Redshift load (cloud provider CLIs or managed connectors).
  3. Add scheduled-runner that reads scheduled report definitions, generates reports, stores them to S3, and triggers distribution via `notification-service`.

5) POS adapters and POS reconciliation
- Description: POS reconciliation helpers exist but production adapters to major POS vendors are missing.
- Impact: manual reconciliation for POS settlements; integration gaps for restaurant/front‑desk POS channels.
- Files to modify / add:
  - `Apps/billing-service/src/services/pos-charge-service.ts` — define an adapter interface and extraction points.
  - Add `Apps/integrations/pos/` with one adapter skeleton (e.g., `micros.ts` or `toast.ts`).
- Approach:
  1. Define `POSAdapter` interface and implement a per-tenant configuration to select adapter.
  2. Implement one adapter skeleton and end-to-end test to ingest POS batch transactions and reconcile to folios/GL.


## Medium / low priority

- PCI automation: catalog and flags exist; add scheduled scans and evidence collection automation. Files: `Apps/core-service/src/data/catalog/security-compliance-backup.ts` → add runbook + jobs, or create `Apps/compliance-service/`.
- SSO / IdP connectors: `OKTA` is referenced in the catalog; no full IdP onboarding; add `Apps/integrations/idp/okta.ts` and update `Apps/tenant-auth` to support OIDC back‑channel flows.


## Implementation checklist (recommended order)

1. Channel manager adapters (high) — create `Apps/integrations/channel-manager/` and refactor `ota-integration.ts`. (3–5 days)
2. Bank feed ingestion + reconciliation (high) — add `bank-feed-service.ts`, reconciliation job, and mapping to `gl-posting.ts`. (3–5 days)
3. Payment abstraction + token vault (high) — create `Apps/payment-gateway/` and `Apps/payment-vault/`; refactor Stripe adapter. (4–6 days)
4. Reporting worker + DW sinks (high) — `Apps/reporting-worker/` with S3 sink and scheduled-runner. (3–5 days)
5. POS adapters (medium) — create `Apps/integrations/pos/` and adapter skeletons. (2–4 days)
6. PCI automation / SSO connectors (low–medium) — add `Apps/compliance-service/`, `Apps/integrations/idp/okta.ts`. (2–4 days)

## Quick acceptance criteria (examples)

- OTA: push rate to a channel sandbox endpoint and observe channel log + outbox event success path.
- Bank feed: ingest a sample MT940/CSV and auto-match >80% of transactions or create manual-review candidates.
- Payment-vault: switch a charge from Stripe to a second stub processor by changing tenant config only.
- Reporting: daily ETL writes partitioned NDJSON to S3 and a sample BigQuery load succeeds.

## Next actions I can take (choose one)

- Scaffold `Apps/integrations/channel-manager/` + a SiteMinder adapter skeleton and update `ota-integration.ts` wiring.
- Scaffold `Apps/billing-service/src/services/bank-feed-service.ts` with a CSV/MT940 parser and a reconciliation job harness.
- Scaffold `Apps/reporting-worker/` with a basic S3 sink and a scheduled-runner.

---

Files referenced while auditing (evidence)
- `Apps/reservations-command-service/src/services/reservation-commands/ota-integration.ts`
- `Apps/guests-service/src/services/stripe-payment-gateway.ts`
- `Apps/billing-service/src/lib/gl-posting.ts`
- `Apps/core-service/src/data/catalog/reporting-analytics-night-audit.ts`
- `Apps/core-service/src/data/catalog/integration-channel-management.ts`
- `Apps/core-service/src/modules/module-registry.ts`

If you want, I can scaffold one of the recommended implementations now — pick a gap to start and I will create the initial files, interfaces and a minimal test harness.
