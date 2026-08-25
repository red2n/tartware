# COV-04: Two Accounts-Receivable Surfaces on Two Tables

**Priority:** P0 (decision) | **Risk:** 🟠 MEDIUM-HIGH | **Type:** Decision + Backend | **Effort:** M

> ## ✅ Decided 2026-08-11 — `ar_accounts` is canonical (Option A)
>
> Decided by the repo owner on the evidence below: `ar_accounts` is empty (0 rows), so migration is
> free today, and checkout already resolves city-ledger transfers against it.
>
> **Done in this pass:** the three `/v1/billing/accounts-receivable` routes are annotated as
> deprecated in `Apps/billing-service/src/routes/accounts.ts` — kept as a read view so the existing
> *Accounts → Receivable* screen keeps working, with `/v1/billing/ar/*` named as the replacement and
> `aging-report` named as the replacement for `aging-summary`.
>
> **Still to do, as part of [03-ar-account-management.md](03-ar-account-management.md):** collapse the
> duplicate aging computation onto `ar.aging.compute`, collapse the `billing.ar.*` / `ar.*` command
> namespaces, and decide whether `accounts_receivable` becomes a line table under `ar_accounts` or is
> migrated into it. COV-03 is now unblocked.

## Current State

The backend carries two independent AR APIs over two different tables. The UI uses one and ignores
the other.

| Surface | Route file | Table | UI | Contents |
|---|---|---|---|---|
| `/v1/billing/accounts-receivable` | `Apps/billing-service/src/routes/accounts.ts` | `accounts_receivable` | ✅ wired | Transaction-level AR — the *Accounts → Receivable* screen. 3 endpoints incl. `aging-summary`. |
| `/v1/billing/ar/*` | `Apps/billing-service/src/routes/ar.ts`, `dunning-rules.ts` | `ar_accounts` | ❌ none | Account master, aging report, DSO, collection rate, dunning rules/effectiveness, risk score, statements. 12 endpoints. |

Both compute aging. `GET /v1/billing/accounts-receivable/aging-summary` and
`GET /v1/billing/ar/aging-report` answer the same business question from different tables, and
nothing keeps them consistent.

Command namespaces are split the same way: `billing.ar.post`, `billing.ar.apply_payment`,
`billing.ar.age`, `billing.ar.write_off` (4, in `command-center-consumer.ts`, three of them
UI-dispatched) versus the 13 `ar.*` commands in `accounts-command-center-consumer.ts` (none
UI-reachable). **Two write paths into two ledgers for one concept.**

## Why This Needs Deciding Before Any UI Work

[03-ar-account-management.md](03-ar-account-management.md) builds screens over `ar_accounts`. If
`accounts_receivable` is meant to be canonical instead, that work is wasted. If both stay, the
product will show two different aging numbers to the same user, and finance will not know which to
trust.

## The Decision

**Option A — `ar_accounts` is canonical (recommended).**
It is the richer model: account master with credit terms, dunning, disputes, risk scoring, statements.
`accounts_receivable` becomes a transaction/line table hanging off it, or is migrated into it.

- Migration: map existing `accounts_receivable` rows to an `ar_accounts` parent (by company / guest).
- Keep `/v1/billing/accounts-receivable` as a thin read view during transition so the existing screen
  does not break; mark it deprecated in the OpenAPI tag.
- Consolidate aging on `ar.aging.compute`; make `billing.ar.age` delegate or remove it.

**Option B — `accounts_receivable` is canonical.**
Then `ar.ts`, `dunning-rules.ts`, the 13 `ar.*` commands, the ARA hooks
(`ara-night-audit-hook.ts`, `ara-payment-hook.ts`) and `ar-event-consumer.ts` are dead weight and
should be deleted — a smaller change, but it discards dunning, disputes and risk scoring, and it
breaks city-ledger transfer at checkout, which reads `ar_accounts`.

**Option C — keep both, formally separated.** Only defensible if one is a sub-ledger of the other
with a documented reconciliation. Requires naming the invariant and testing it.

Note that checkout already depends on `ar_accounts` (`ar-event-consumer.ts:179` dispatches
`ar.city_ledger.transfer`), which is evidence for Option A.

## Evidence gathered 2026-08-11

Row counts from the running dev database:

| Table | Rows |
|---|---|
| `ar_accounts` | **0** |
| `ar_dunning_rules` | **0** |
| `accounts_receivable` | 3 |

`ar_accounts` is empty exactly as predicted — nothing can create a row, because `ar.account.create`
has no UI or REST trigger. **This is the cheapest moment Option A will ever have:** there is no data to
migrate today, and every AR account created between now and the decision makes it more expensive.

Combined with the fact that checkout already resolves city-ledger transfers against `ar_accounts`
(`Apps/billing-service/src/consumers/ar-event-consumer.ts:179`), the evidence points one way:
**adopt `ar_accounts` as canonical (Option A)**, keep `/v1/billing/accounts-receivable` as a
deprecated read view so the existing screen keeps working, and build COV-03 on top of it.

## Work Required

1. Read both tables in `schema/src/schemas/04-financial/` and write down what each row means.
2. ~~Check row counts in a real tenant DB.~~ ✅ done — see above.
3. Record the decision in this file, then:
   - deprecate the losing routes in the OpenAPI tags,
   - collapse the duplicate aging computation,
   - collapse the `billing.ar.*` / `ar.*` command namespaces,
   - update `accounts-gaps/00-CONSOLIDATED.md` if it assumes the other surface.

## Acceptance

- One aging number, one write path, one documented table for AR.
- Deprecated surface either deleted or annotated with the reason and the replacement.
- `executables/test-accounts-realdata/` asserts aging from the canonical source only.

## Cross-reference

[03-ar-account-management.md](03-ar-account-management.md) is blocked on this.
