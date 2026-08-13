# UI screen seeders

One file per screen. Each defines a single `seed_<screen>()` function and nothing else —
no top-level side effects, because `test-multi-tenant.sh` sources every file in this
directory before Phase 6c runs.

## Adding a screen

1. Create `seeds/<screen>.sh` defining `seed_<screen>() { ... }`.
2. Call it from Phase 6c in `test-multi-tenant.sh`, once per property.
3. Add a `ui_get` line to the 6c.9 roll-up so an empty screen fails the run.

That is the whole contract. Files never source each other, so adding or editing one
cannot break the others.

## What a seeder may use

Sourcing happens after the main script defines its helpers, so these are all in scope:

| Helper | Purpose |
|---|---|
| `post <url> <json>` / `get <url>` / `put <url> <json>` | Rate-limit-aware transport; echo the HTTP code |
| `send_command <label> <name> <payload>` | Dispatch a command through the gateway |
| `pass` / `fail` / `skip` | Result recording — these drive the run's exit code |
| `resp_count` / `resp_first` / `resp_ffirst` / `resp_field` | Read the last response body |
| `poll_count <url> <want> [max_wait]` | Wait for async writes to land |
| `gen_uuid` | Idempotency keys and synthetic ids |

Globals: `$GW`, `$TOKEN` (set it before calling `post`/`get`), `$RESP_FILE`, `$RUN_TAG`,
`$TODAY`, `$IN3DAYS`, `$IN5DAYS`.

## Conventions

- **Suffix every natural key with `$RUN_TAG`.** Re-runs share a database; an unsuffixed
  code collides with the previous run and the write comes back 409.
- **Enum values must match the API's allowed list, and casing is not forgiven —
  it is not consistent between domains.** `incident_reports`, `lost_and_found`,
  `shift_handovers` and `promotional_codes` use lowercase; `waitlist_entries` and
  `guest_feedback.feedback_source` use uppercase. Read the value list from the
  owning service's `/docs/json` rather than guessing from a neighbouring screen.
- **Seed to a target, not a fixed count.** Check what already exists and top up, so a
  second run against the same database does not double the rows.
- **Never `fail` for a missing prerequisite** (no guest, no room). Use `skip` — a seeder
  that hard-fails on absent upstream data turns one gap into a cascade of red.
