# E2E Coverage — what these suites assert, and what a PMS is expected to assert

**Reviewed 2026-08-20.** Written because the suites had drifted behind a fortnight of write paths,
and because "it passed" was not answering the question a hotel would ask: *can this system oversell a
room, lose money on a folio, or double-charge a card?*

## How to run

```bash
# everything: seeded scenarios, invariants, domain write suites, isolation
./executables/test-accounts-realdata/test-accounts-realdata.sh

# against an already-seeded database
./executables/test-accounts-realdata/test-accounts-realdata.sh --skip-seed

# without the domain write suites (faster inner loop)
SKIP_DOMAIN_SUITES=1 ./executables/test-accounts-realdata/test-accounts-realdata.sh --skip-seed

# tenant and property isolation
./executables/test-accounts-realdata/test-multi-tenant.sh
```

The domain write suites also run standalone while iterating on one area:

```bash
bash http_test/smoke-events.sh        # function space, BEOs, day sheet, event billing — 133 assertions
bash http_test/smoke-operations.sh    # operations write paths + room-block holds — 80 assertions
```

## The shape of the coverage

| Layer | Where | What it proves |
|---|---|---|
| Seeded accounting scenarios | Phase 1, 1B–1D | Real PMS flows: check-in → charges → tax → payment → night audit → invoice |
| **Operational invariants** | **Phase 1A** | The properties a hotel notices being broken within a day |
| Read surface | Phase 2 | ~50 endpoints answer, and their counts agree with the database |
| Compliance checks | Phase 2B | Invoice sequencing, audit-trail immutability, folio balance integrity |
| Multi-currency | Phase 2C (`--multi-currency`) | FX locking, minor units, per-property base currency |
| **Domain write paths** | **Phase 2D** | Events, BEOs, allotments, operations — run, not copied |
| Isolation | `test-multi-tenant.sh` | Two tenants × two properties, cross-tenant reads and commands refused |

## Phase 1A — the invariants, and why each one is there

Every one of these was absent until 2026-08-20, and two of them are regression guards for defects
that were live in this codebase last week.

| Invariant | Why it matters | The defect it guards |
|---|---|---|
| A contracted room block removes rooms from sale | Overbooking is the most expensive mistake a PMS makes: walked guests, relocation, attrition penalties | Availability was computed from `reservations` and `rooms` alone, so a 40-room block stayed fully sellable and the rooming-list upload overbooked the house. Fixed 2026-08-20 |
| Pickup, a lapsed cutoff and cancellation each release the hold | A block that never lets go is as wrong as one that never holds — it strands sellable rooms | — |
| A CREDIT posting *lowers* a folio balance | A refund that raises the bill is a customer-facing billing error | `billing.charge.post` added every posting to the balance regardless of direction. Fixed 2026-08-19 |
| Money in these assertions carries cents | A whole-number charge exercises none of the numeric handling | The fix above wrote `CASE WHEN … THEN 0 ELSE $2 END`, which made Postgres deduce the amount parameter as **integer**: 40 posted, 40.50 died with "invalid input syntax for type integer". Two smoke suites and two hand probes all used whole numbers and missed it; this suite's 24.50 minibar charge found it within an hour. Fixed 2026-08-20 |
| One `Idempotency-Key`, one posting | A retried card charge must not bill twice | The key was required on every write and never tested for what it is *for* |

## Measured against industry expectation

Scored against what a hotel-technology QA would expect of a PMS (HTNG interop, USALI reporting,
PCI-DSS handling, GDPR subject rights).

| Expectation | State | Where |
|---|---|---|
| Overbooking cannot occur through normal booking | ✅ **now covered** | Phase 1A.1 |
| Folio arithmetic is closed: charges − credits − payments = balance | ✅ covered | Phase 2B, 1A.2 |
| Idempotent financial writes | ✅ **now covered** | Phase 1A.3 |
| Night audit runs, rolls the business date, is repeatable | ✅ covered | Phase 1B |
| Tax computed and posted per configuration | ✅ covered | Phase 1, 2 |
| Invoice numbering gap-free and sequential | ⚠️ asserted, skips when no invoices exist | Phase 2B |
| Voided charges are reversed, never deleted | ⚠️ asserted, skips when nothing was voided | Phase 2B |
| Tenant and property isolation | ✅ covered | `test-multi-tenant.sh` |
| Multi-currency: FX locked at posting, minor units respected | ✅ covered | Phase 2C |
| GDPR export and erase | ⚠️ read path smoke-tested; erase not exercised end to end | — |
| PCI: no PAN at rest, tokenised payments | ❌ **not asserted** | — |
| Group block lifecycle: cutoff release, attrition billing | ⚠️ hold/release covered; attrition billing not | Phase 1A.1 |
| Rate parity / channel distribution correctness | ❌ **not asserted** | — |
| Deposit ledger: advance deposits held as liability until arrival | ❌ **not asserted** — the commands are unreachable ([ui-gaps/17](../../ui-gaps/17-command-reachability.md)) | — |
| Concurrency: two bookings racing for the last room | ❌ **not asserted** | `test-concurrent-50-tenants.sh` covers load, not this race |

The four ❌ rows are the honest backlog. PCI and the last-room race are the two I would do next: the
first because it is a compliance obligation rather than a preference, the second because the
availability fix above makes it newly testable and it is the natural companion to it.

## Ordering matters

Phase 1A runs *before* the accounting scenarios. Those check guests in, move rooms and take rooms out
of order, and by the end of a full run the property has no sellable rooms left — the inventory
invariant then has nothing to measure and skips. It needs a fresh house.

## Two suite defects found while reviewing

**The suite could not finish in `--skip-seed` mode.** Under `set -euo pipefail`, `[[ -n "$FOLIO1_ID" ]]`
aborts the whole run when the variable was never assigned — which is exactly what `--skip-seed` does.
Phase 2B died on it, so Phase 2C, 2D and 3 never ran and the mode documented in the script's own header
was unusable. 69 guards of that shape now use `${VAR:-}`.

**`api_smoke` scored `403 TENANT_MODULE_NOT_ENABLED` as a skip, unconditionally.** That is how lost &
found and the incident register were dark for a week with every run green: the seed granted the demo
tenant no modules at all. The suite enables every module for Tenant A in preflight and the seed now
carries the full `MODULE_IDS` list, so for that tenant a 403 is a lost entitlement and now **fails**.
It stays a skip for any other tenant, where a module genuinely may not be licensed.

## Standing rule

A write path is not shipped until one of its writes has run against a live gateway. Three separate
defects in the last fortnight — a response schema that 500ed after committing, a statement Postgres
would not prepare, and a mapper that answered `undefined` where the schema demanded `null` — were
invisible to the type checker, the build and every conformance test, and took seconds to find with a
stack running.
