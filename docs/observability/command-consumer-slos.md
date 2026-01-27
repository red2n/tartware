# Command Consumer Observability + SLOs

This guide defines the default dashboard panels and SLO targets for command consumers (rooms, housekeeping, billing, guests, settings). Metrics are emitted per service with a service prefix.

## Metrics (per service)

- `<service>_command_outcomes_total{command,status}`
- `<service>_command_processing_duration_seconds_bucket{command}`
- `<service>_command_consumer_lag{topic,partition}`

## Dashboard Panels (template)

| Panel | Purpose | PromQL (replace `<service>`) |
| --- | --- | --- |
| Throughput | Commands processed per second by outcome. | ```sum(rate(<service>_command_outcomes_total[5m])) by (status)``` |
| Success Rate | Success vs. error share. | ```sum(rate(<service>_command_outcomes_total{status="success"}[5m])) / sum(rate(<service>_command_outcomes_total[5m]))``` |
| Latency P95 | P95 processing duration by command. | ```histogram_quantile(0.95, sum(rate(<service>_command_processing_duration_seconds_bucket[5m])) by (le,command))``` |
| Latency P99 | P99 processing duration by command. | ```histogram_quantile(0.99, sum(rate(<service>_command_processing_duration_seconds_bucket[5m])) by (le,command))``` |
| Backlog | Max consumer lag across partitions. | ```max(<service>_command_consumer_lag)``` |

## SLO Targets (default)

- **Throughput:** No sustained stalls while backlog exists.
  - Alert: `max(<service>_command_consumer_lag) > 0` AND `sum(rate(<service>_command_outcomes_total[5m])) == 0` for 5m.
- **Latency:** P95 < 1s, P99 < 2s for each command over 30d.
  - Alert: `histogram_quantile(0.95, sum(rate(<service>_command_processing_duration_seconds_bucket[10m])) by (le,command)) > 1`.
- **Backlog:** Consumer lag < 500 for 99% of 10m windows (warn); < 2000 for critical.
  - Warn: `max(<service>_command_consumer_lag) > 500` for 10m.
  - Critical: `max(<service>_command_consumer_lag) > 2000` for 5m.

## Implementation Notes

- Replace `<service>` with `rooms`, `housekeeping`, `billing`, `guests`, or `settings`.
- Tune latency and lag thresholds per environment once baselines are captured.
- Alert rules belong in service Helm charts or shared alert configs under `platform/` when ready.
