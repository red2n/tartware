# Reservations Command Dead-Letter Queue Runbook

The reservations pipeline stays healthy only when `reservations.events.dlq` remains empty. This runbook explains how to react when Prometheus raises `ReservationCommandDlqWarning` or `ReservationCommandDlqCritical` (dead-letter queue backlog alerts) or when `/health/reliability` reports degraded status.

## Signals

- **Alertmanager** fires `ReservationCommandDlqWarning` (warning) and `ReservationCommandDlqCritical` (critical) whenever `reservation_event_dlq_depth` exceeds the thresholds published via `reservation_event_dlq_threshold{level="warn|critical"}`.
- **Reliability endpoint** `GET /health/reliability` on reservations-command-service displays outbox backlog, consumer freshness, lifecycle stalls, and dead-letter queue depth. Treat any non-`healthy` status as an incident even if Alertmanager has not fired.
- **Grafana dashboard** “Command Pipeline” shows the same metrics for manual inspection, including the dead-letter queue backlog and retry counters.

## Immediate Actions

1. **Confirm service health**
   ```bash
   kubectl -n tartware-system port-forward svc/reservations-command-service 3101:80
   curl http://localhost:3101/health/reliability | jq
   ```
   If `dlq.depth` is `null`, Kafka or networking is unavailable and the incident is broader than application logic.
2. **Check consumer lag**
   ```bash
   kubectl logs deploy/reservations-command-service -n tartware-system | rg "consumer partition"
   ```
   Compare with the `reservation_event_consumer_lag` panel to determine whether the consumer itself is stalled.
3. **Inspect dead-letter queue samples**
   ```bash
   kcat -b $KAFKA_BROKERS -t reservations.events.dlq -C -o -10 -q
   ```
   (Or use Kafka UI.) Review `failureReason`, `failureCause`, and the embedded event metadata to isolate patterns.

## Investigation Checklist

- **Handler bugs** – look for repeated stack traces in service logs referencing the same command or reservation ID.
- **Dependency failures** – Availability Guard, Postgres, or downstream services may be unavailable, causing retries to exhaust. Check their `/health` endpoints and Kubernetes events.
- **Historical noise** – Compare `dlq.depth` against `reservation_command_lifecycle` entries with `current_state='DLQ'`. A flat line suggests backlogged remediation rather than active poisoning.

## Remediation Steps

1. **Fix the root cause** – roll back or patch the offending service, or restore the broken dependency before replaying messages.
2. **Replay events safely**
   - Export records from `reservations.events.dlq` (`kcat ... > dlq.jsonl`).
   - Sanitize payloads if necessary and increment `metadata.retryCount` if you mutate the body.
   - Re-publish to `reservations.events` using the same Kafka credentials or the `npm run requeue:outbox` helper if the events originated from the transactional outbox.
   - Track reservation IDs and correlation IDs in the incident ticket for audit.
3. **Verify lifecycle closure** – query `SELECT * FROM reservation_command_lifecycle WHERE reservation_id = '<id>'` to ensure states transition from `DLQ` back to `APPLIED`.

## Post-Incident Tasks

- Adjust `RELIABILITY_DLQ_WARN_THRESHOLD`, `RELIABILITY_DLQ_CRITICAL_THRESHOLD`, or `RESERVATION_DLQ_TOPIC` in `.env` / ConfigMaps if thresholds were obviously mis-tuned.
- Document the root cause in `TODO.md` or the incident retro, including follow-up stories (tests, validation, tooling).
- Automate the replay workflow (scripts or runbooks in PagerDuty) if the incident revealed manual toil.
