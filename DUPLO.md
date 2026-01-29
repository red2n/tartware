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

## Latest Findings (2025-12-26 06:40:13)

Summary: `reports/duplo/duplo-summary-20251226-064013.json`

✅ The latest scan is clean—no duplicate blocks were detected. The shared `@tartware/tenant-auth` plugin and `@tartware/command-center-shared` helpers eliminated the previously duplicated auth-context plugins and command-dispatch SQL/service logic. Full CLI output lives in `duplo-report-20251226-064013.log` for audit purposes.

## Developer Dashboard

Developers can review the Duplo summaries in a small HTML dashboard without opening the JSON files:

1. Start the API Gateway (`npm run dev:gateway`).
2. Run `./executables/run-duplo/run-duplo.sh` whenever you need a fresh report.
3. Visit [http://localhost:8080/developers/duplo](http://localhost:8080/developers/duplo) to browse the rendered summaries (the latest report loads by default, and you can switch to any historical summary via the dropdown).
