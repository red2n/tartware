# Duplo Duplicate Scan – 2025-12-24

## How to Run

```bash
./executables/run-duplo/run-duplo.sh
```

Environment flags (all optional):

- `DUPLO_MIN_LINES` (default `60`)
- `DUPLO_PERCENT_THRESHOLD`
- `DUPLO_MIN_CHARS` (default `3`)
- `DUPLO_THREADS`
- `DUPLO_EXTENSIONS` (default `ts,tsx,js,jsx,html`)
- `DUPLO_EXCLUDE_DIRS` (comma separated)
- `DUPLO_IGNORE_PREPROCESSOR=true|false`
- `DUPLO_IGNORE_SAME_NAME=true|false`
- `DUPLO_MAX_FILES`

Outputs land in `reports/duplo/`:

- `duplo-report-<timestamp>.log` – CLI output
- `duplo-report-<timestamp>.json` – full Duplo JSON
- `duplo-summary-<timestamp>.json` – condensed summary

## Latest Findings (2025-12-24 13:37:53)

Summary: `reports/duplo/duplo-summary-20251224-133753.json`

| File | Duplicate Blocks |
| --- | --- |
| `Apps/rooms-service/src/plugins/auth-context.ts` | 4 |
| `Apps/billing-service/src/plugins/auth-context.ts` | 4 |
| `Apps/housekeeping-service/src/plugins/auth-context.ts` | 4 |
| `Apps/command-center-service/src/plugins/auth-context.ts` | 4 |
| `Apps/guests-service/src/plugins/auth-context.ts` | 4 |
| `Apps/api-gateway/src/command-center/sql/command-dispatches.ts` | 1 |
| `Apps/command-center-service/src/sql/command-dispatches.ts` | 1 |
| `Apps/api-gateway/src/command-center/sql/command-registry.ts` | 1 |
| `Apps/command-center-service/src/sql/command-registry.ts` | 1 |
| `Apps/api-gateway/src/command-center/command-dispatch-service.ts` | 1 |
| `Apps/command-center-service/src/services/command-dispatch-service.ts` | 1 |

Full match details (line ranges payloads) are in `duplo-report-20251224-133753.json`.
