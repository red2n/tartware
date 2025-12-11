# Workflow Ideas

1. **Reservation lifecycle notifications**  
   - Subscribe to the Kafka topic `reservations.events` (see `Apps/reservations-command-service/src/config.ts`).  
   - Use an n8n Kafka Trigger to pull `reservation.created` events (`schema/src/events/reservations.ts`).  
   - Enrich context via `GET /v1/reservations?tenant_id=...` from the core service (`Apps/core-service/src/routes/reservations.ts`).  
   - Fan out to Email, SMS, Slack, or CRM nodes and persist the returned `eventId` in n8n to avoid duplicates.

2. **Housekeeping auto-dispatch**  
   - Schedule an n8n Cron node that calls `/v1/housekeeping/tasks` with `status=pending` (`Apps/core-service/src/routes/housekeeping.ts`).  
   - Split tasks by property or priority and push tickets into Jira/Asana or send WhatsApp messages to attendants.  
   - Optional: update the task status via a follow-up HTTP node once an external system acknowledges the work.

3. **Finance reminders and reconciliation**  
   - Poll `/v1/billing/payments` for `status=pending` or `payment_method=card` (`Apps/core-service/src/routes/billing.ts`).  
   - Automatically send payment links through Stripe/Checkout nodes, log reminders in Slack, and upload nightly CSV exports to S3/Drive.  
   - When a payment clears, post back to Tartware or fire a Kafka message for downstream accounting.

4. **OTA intake triage**  
   - Watch `ota_reservations_queue` in Postgres (`scripts/tables/06-integrations/40_ota_reservations_queue.sql`).  
   - Parse the `raw_payload`, enrich with property metadata, and call `POST /v1/tenants/:tenantId/reservations` to create an internal booking (`Apps/reservations-command-service/src/routes/reservation-commands.ts`).  
   - On failures, use n8n’s Email or ServiceNow nodes to alert channel managers with diagnostics.

5. **Scheduled BI exports**  
   - Drive `/v1/reports/performance` on a cadence (`Apps/core-service/src/routes/reports.ts`).  
   - Serialize the dataset into CSV/Parquet and upload to S3, Google Sheets, or send via email to stakeholders.  
   - Optionally push a summary metric to a dashboard service when the workflow completes.

# Implementation Notes

1. **Add n8n to docker-compose**  
   - Extend `docker-compose.yml` with an `n8n` service that depends on Postgres/Kafka/Redis and joins `tartware_network`.  
   - Configure env vars like `DB_POSTGRES_HOST=postgres`, `KAFKA_BROKERS=kafka:9092`, and point `N8N_HOST`/`N8N_PORT` at your preferred entrypoint.

2. **Authentication & tenant scoping**  
   - Core routes enforce `withTenantScope` plus module checks (`Apps/core-service/src/routes/*` and `modules/module-registry.ts`).  
   - Have n8n obtain JWTs from the core auth flow (`Apps/core-service/src/config.ts`) and include `Authorization: Bearer …` plus the appropriate `tenant_id` in every request.

3. **Schema reuse & validation**  
   - Mirror the Zod schemas shipped via `@tartware/schemas` (e.g., `schema/src/events/reservations.ts`) inside n8n Code nodes or by referencing the published package so payloads stay in sync.  
   - Store shared constants (topics, enums) in n8n credentials or data stores to keep workflows declarative.

4. **Idempotency & observability**  
   - Leverage the `eventId`/`correlationId` returned by reservation commands to de-dupe downstream work.  
   - Emit logs/metrics from n8n back into the existing OTEL stack (collector defined in `docker-compose.yml`) via HTTP or OTLP exporters so automation health shows up beside core services.

5. **Security & secrets**  
   - Use n8n credential vaults for JWT secrets, DB passwords, and API keys; never hard-code them in workflow JSON.  
   - Limit n8n’s service account to the modules/endpoints it truly needs by issuing scoped API keys or JWTs with restricted claims.
