# Command Center DLQ Runbook

## Scope
This runbook covers DLQ handling for command-center outbox publishing
(`commands.primary.dlq`).

## Symptoms
- DLQ topic backlog grows (`commands.primary.dlq`).
- Command dispatches show `FAILED`/`DLQ` status.

## Immediate Actions
1. Identify failing commands in `command_dispatches` (filter by `status`).
2. Fix the underlying issue (downstream outage, schema validation errors,
   or transient Kafka errors).
3. Requeue outbox rows once the issue is resolved.

## Requeue Tool
Use the CLI to requeue failed or DLQ outbox rows:

```bash
pnpm --filter @tartware/command-center-service run requeue:outbox -- --status=DLQ --limit=25 --tenant-id=<uuid> --command-name=billing.payment.capture
```

Options:
- `--status=DLQ|FAILED` (default `FAILED`)
- `--limit=<n>` (default 50)
- `--tenant-id=<uuid>`
- `--command-name=<name>` (e.g. `reservation.create`)
- `--event-id=<uuid>`
- `--actor=<string>`

## Verification
- Confirm the rows return to `PENDING` in `transactional_outbox`.
- Watch `command_dispatches` transition from `FAILED`/`DLQ` to `PUBLISHED`.
