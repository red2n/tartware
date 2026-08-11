# COV-03: AR Account Management — 13 Commands, 8 Read Endpoints, Zero UI

**Priority:** P0 | **Risk:** 🔴 HIGH | **Type:** UI | **Effort:** L

## Current State (Backend ✅ → UI ❌)

The `ar_accounts` surface is complete on the backend and unreachable from the product.

### Read endpoints — `Apps/billing-service/src/routes/ar.ts`, `dunning-rules.ts`

| Method | Path |
|---|---|
| GET | `/v1/billing/ar/accounts` |
| GET | `/v1/billing/ar/accounts/:accountId/statement` |
| GET | `/v1/billing/ar/accounts/:accountId/risk-score` |
| GET | `/v1/billing/ar/aging-report` |
| GET | `/v1/billing/ar/dso` |
| GET | `/v1/billing/ar/collection-rate` |
| GET | `/v1/billing/ar/dunning-effectiveness` |
| GET | `/v1/billing/ar/dunning-rules` |
| POST / PATCH / DELETE | `/v1/billing/ar/dunning-rules[/:id]` |

### Commands — `Apps/billing-service/src/commands/accounts-command-center-consumer.ts:117-153`

`ar.account.create`, `ar.account.update_terms`, `ar.city_ledger.transfer`,
`ar.city_ledger.write_off`, `ar.aging.compute`, `ar.dunning.trigger`, `ar.dunning.suppress`,
`ar.dunning.escalate`, `ar.payment.apply`, `ar.payment.unapply`, `ar.dispute.raise`,
`ar.dispute.resolve`, `ar.dispute.escalate` — **13 commands, none with a gateway REST wrapper and
none dispatched by the UI.**

`billing/ar/` does not occur in `UI/`.

### What *is* already automated

Four of the 13 are dispatched by the system, not a user, so they are exercised even without UI:

- `ar.aging.compute` and `ar.dunning.trigger` — `services/billing-commands/ara-night-audit-hook.ts`
- `ar.payment.apply` — `services/billing-commands/ara-payment-hook.ts`
- `ar.city_ledger.transfer` — `consumers/ar-event-consumer.ts:179` on checkout

The remaining **9 have no caller at all**.

## Why This Is P0 — it hid a real bug

City-ledger transfer at checkout resolves an AR account from `ar_accounts`. `ar.account.create` and
`ar.account.update_terms` have no UI trigger, so **no AR account can be created through the
product**. With no AR accounts and no direct-bill routing rules, the broken `findDirectBillRouting`
query was never exercised by a real user — only by the E2E suite, which is where it surfaced.
Direct bill / corporate billing is not usable end to end today.

## Work Required

### Prerequisite

Settle [04-duplicate-ar-surface.md](04-duplicate-ar-surface.md) first. Building a second AR screen
before deciding which table is canonical guarantees rework.

### UI — `UI/pms-ui/src/app/features/accounts/ar-accounts/`

1. **Account list** — account name, company, credit limit, current balance, terms, risk score,
   status. Filters: over-limit, past-due, on hold.
2. **Create / edit account** — `ar.account.create`, `ar.account.update_terms`. Fields from the
   command schemas in `schema/src/events/commands/billing-ar.ts` / `billing-ara.ts`.
   Link to a company record where one exists (`GET /v1/companies`).
3. **Account detail** — statement (`…/statement`), aging buckets, risk score, open disputes,
   dunning history.
4. **Aging report** — `GET /v1/billing/ar/aging-report`, bucketed, exportable.
5. **Collections dashboard** — DSO, collection rate, dunning effectiveness as KPI tiles.
6. **Dunning rules admin** — full CRUD is already available over HTTP; this is a plain settings table.
7. **Actions** — city-ledger transfer, write-off, payment apply/unapply, dispute raise/resolve/
   escalate, dunning suppress/escalate. Each needs a gateway REST wrapper **or** direct
   `POST /commands/<name>` dispatch; see COV-17 for which pattern to follow.

### Direct-bill loop

Once accounts can be created, verify the full path: create AR account → set credit terms → attach to
a reservation as direct bill → checkout routes the balance to city ledger → statement shows it →
payment applies against it. That is the regression the E2E suite should own.

## Acceptance

- An AR account can be created and its terms updated through the UI.
- A reservation can be set to direct bill and its balance lands on the right AR account at checkout.
- Aging report and DSO render from live data for a tenant with real AR rows.

## Cross-reference

- [04-duplicate-ar-surface.md](04-duplicate-ar-surface.md) — must be decided first.
- `accounts-gaps/17-group-master-billing.md` — group folio linkage; keep the boundary: COV-03 owns
  `ar_accounts` CRUD, ACCT-17 owns group master folios.
- [17-command-reachability.md](17-command-reachability.md) — 13 of the 108 unreachable commands are
  discharged by this spec.
