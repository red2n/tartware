# Shadow-Mode Observability Dashboards

Shadow deployments of the roll-service and availability-guard-service only emit telemetry; they do not mutate production data. This guide defines the Grafana dashboards and Alertmanager rules that must stay enabled while the “availability-roll-shadow” feature flag is active.

## Roll Service Shadow Dashboard

| Panel | Purpose | PromQL |
| --- | --- | --- |
| Lifecycle Throughput | Ensure we keep up with reservation lifecycle volume. | ```sum(rate(roll_service_lifecycle_events_total[5m])) by (result)``` |
| Processing Lag | Compare consumer lag vs. wall clock per partition. | ```max(roll_service_processing_lag_seconds)``` |
| Event Timestamp Drift | Surface partitions that trail production by >5m. | ```max(roll_service_consumer_timestamp_drift_seconds)``` |
| Event Duration (P95) | Detect slow handlers before offsets stall. | ```histogram_quantile(0.95, sum(rate(roll_service_lifecycle_event_duration_seconds_bucket[5m])) by (le))``` |
| Backfill Progress | Verify catch-up jobs continue to advance. | ```roll_service_backfill_checkpoint_timestamp``` |
| Backfill Rows/sec | Highlight spikes when backfill replays large tenants. | ```rate(roll_service_backfill_rows_total[5m])``` |
| Backfill Failures | Count batches that exited early. | ```increase(roll_service_backfill_errors_total[1h])``` |
| Replay Drift Breakdown | Track how often shadow ledgers differ. | ```sum(increase(roll_service_replay_mismatches_total[6h])) (plus matches/missing panels)``` |

### Alert Rules

- **RollServiceConsumerStalled**: `max(roll_service_processing_lag_seconds) > 30` for 5m.
- **RollServiceTimestampDriftHigh**: `max(roll_service_consumer_timestamp_drift_seconds) > 120` for 10m.
- **RollServiceBackfillStuck**: `time() - max(roll_service_backfill_checkpoint_timestamp) > 900` for 15m.
- **RollServiceReplayDeltaSpike**: `increase(roll_service_shadow_replay_delta_total[30m]) > 50`.
- **RollServiceBatchFailures**: `increase(roll_service_lifecycle_batch_failures_total[15m]) > 0`.

Each alert inherits standard shadow notification labels: `service="roll-service"`, `mode="shadow"`, `severity="warning"` (bump to `critical` once we exit shadow).

## Availability Guard Shadow Dashboard

| Panel | Purpose | PromQL |
| --- | --- | --- |
| Lock Decisions | Success vs. conflicts vs. errors for lock requests. | ```sum(rate(availability_guard_requests_total{operation="lockRoom"}[5m])) by (result)``` |
| Release Outcomes | Release/bulk-release throughput. | ```sum(rate(availability_guard_requests_total{operation=~"releaseLock|bulkRelease"}[5m])) by (operation,result)``` |
| Conflict Hot Tenants | Highlight tenants causing repeated overlaps. | ```topk(5, increase(availability_guard_lock_conflicts_total[15m]))``` |
| Request Latency | 50/95/99th percentile lock latency. | ```histogram_quantile(0.95, sum(rate(availability_guard_request_duration_seconds_bucket{operation="lockRoom"}[5m])) by (le))``` |
| Manual Release Notifications | Delivery health by channel. | ```sum(rate(availability_guard_notification_channel_deliveries_total[5m])) by (channel,status)``` |
| Notification Lag | Lag from manual release event to notification fan-out. | ```histogram_quantile(0.95, sum(rate(availability_guard_notification_delivery_lag_seconds_bucket[5m])) by (le))``` |

### Alert Rules

- **AvailabilityGuardConflictSpike**: `topk(1, increase(availability_guard_lock_conflicts_total[10m])) > 10`.
- **AvailabilityGuardLatencyHigh**: `histogram_quantile(0.99, sum(rate(availability_guard_request_duration_seconds_bucket{operation="lockRoom"}[5m])) by (le)) > 0.5`.
- **AvailabilityGuardNotificationLag**: `histogram_quantile(0.95, sum(rate(availability_guard_notification_delivery_lag_seconds_bucket[5m])) by (le)) > 120`.
- **AvailabilityGuardNotificationFailures**: `increase(availability_guard_notification_channel_deliveries_total{status="failed"}[15m]) > 0`.

Alerts include labels `service="availability-guard-service"` and route to the same shadow-duty Slack channel configured for roll-service.

## Implementation Notes

- Store rendered dashboards (“Shadow Roll Service”, “Shadow Availability Guard”) in Grafana folder `Shadow Mode / Availability Guard & Roll`. The JSON models live in Grafana; this document is the canonical definition for operators and reviewers.
- Helm values should template alert expressions above under `platform/helm/charts/roll-service` and `availability-guard-service` once we flip the shadow mode flag to true in staging.
- Update `docs/roll-service-availability-guard.md` whenever metrics or panels change so onboarding engineers always start here.
