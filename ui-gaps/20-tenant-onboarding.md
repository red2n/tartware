# COV-20: Tenant Onboarding Has No UI — and the Audit Could Not See It

**Priority:** P2 (record) / P1 (the guard) | **Risk:** 🟡 LOW as a gap, 🟠 MEDIUM-HIGH as a guard | **Type:** Decision + Method correction | **Effort:** S

> ## ✅ Decided 2026-08-24 — record as a deliberate non-build
>
> This is a multi-tenant product with **no tenant onboarding screen**. That is intentional, not an
> oversight, and is recorded here so it is not rediscovered as a bug. The API half is complete, and
> the system-admin route is exercised constantly by the realdata harness — neither has a consumer in
> `pms-ui`, and neither needs one.
>
> **Two things were worth doing, and neither was the screen:** close the bootstrap auth guard
> (**✅ fixed 2026-08-24**, below) and fix the audit method that hid this domain (below).

## Current State

Tenant provisioning exists as five endpoints across two route files. None is reachable from either
front-end, and only one is proxied by the gateway at all.

| Endpoint | Registered | Gateway proxy | UI |
|---|---|---|---|
| `GET /v1/tenants` | `Apps/core-service/src/routes/tenants.ts:83` | ✅ `core-proxy-routes.ts:52` | ❌ unused |
| `POST /v1/tenants/bootstrap` | `Apps/core-service/src/routes/tenants.ts:109` | ❌ not proxied | ❌ none |
| `POST /v1/system/tenants/bootstrap` | `Apps/core-service/src/routes/system-tenants.ts:49` | ❌ not proxied | ❌ none |
| `POST /v1/system/tenants` | `Apps/core-service/src/routes/system-tenants.ts:229` | ❌ not proxied | ❌ none |
| `GET /v1/system/tenants` | `Apps/core-service/src/routes/system-tenants.ts:295` | ❌ not proxied | ❌ none |

`GET /v1/tenants` is proxied but still unused: `pms-ui` reads the tenant list from the **login
response**, not from the endpoint — `auth.service.ts:88` stores `response.memberships` and
`topbar.ts:123` switches between them. The UI can therefore switch between tenants a user already
belongs to, and can never create one.

The bootstrap flow itself is complete and transactional: tenant + primary property + owner user in
one `BEGIN`, slug and property code auto-derived when omitted, owner password held to strict PCI
defaults (`assertPasswordMeetsPolicy(null, …)` — there is no tenant yet whose policy could be read),
`409 TENANT_SLUG_EXISTS` on collision.

**Two bootstrap routes, and only one of them is exercised — this distinction matters.**

- `POST /v1/system/tenants/bootstrap` is guarded by `app.withSystemAdminScope({ minRole: "SYSTEM_ADMIN" })`
  (`system-tenants.ts:50`) and **is** the workhorse of the realdata harness: `test-multi-tenant.sh:512`,
  `test-concurrent-50-tenants.sh:270` and `test-multi-currency-locations.sh:564` all call it, and
  `system-admin.test.ts:264` covers it. This route was never the problem.
- `POST /v1/tenants/bootstrap` — the self-serve one — had **no passing test coverage and no callers**.
  Its entire test block is `describe.skip`'d (`tenants.test.ts:127`), and its only other caller is one
  `.http` fixture. One of those skipped tests was titled *"creates a tenant, property, and owner
  **without authentication**"* — the old contract, asserted out loud.

## The Guard Was a No-Op (fixed 2026-08-24)

**Fixed** — the route now fails closed; details at the end of this section. What follows is the
original finding, kept because the failure mode is worth recognising elsewhere.

`tenants.ts` read the onboarding token conditionally:

```ts
const requiredToken = process.env.TENANT_BOOTSTRAP_TOKEN;
if (requiredToken) { /* compare x-onboarding-token */ }
```

**`TENANT_BOOTSTRAP_TOKEN` was set in neither `.env` nor `.env.example`.** Unset ⇒ falsy ⇒ the block
was skipped ⇒ `POST /v1/tenants/bootstrap` was **unauthenticated**. Anyone who could reach
core-service could create a tenant, a property and an owner user with credentials of their choosing.

The only remaining control was `checkBootstrapRateLimit` (`tenants.ts:54`) — 10 requests per 60s per
IP, held in a **process-local `Map`**. It resets on restart and does not hold across replicas.

This is the failure mode worth carrying elsewhere: **the config that switched the check on was the
same config that switched it off.** A guard that reads `if (secret)` is disabled by exactly the
mistake it exists to defend against — a forgotten environment variable.

**Why this is not already an incident:** the gateway does not proxy the route, so today the blast
radius is whoever can reach core-service directly. `docker-compose.yml` publishes infrastructure
only (postgres, kafka, redis, observability) — the services run from `src/index.ts`, and `nginx.conf`
forwards to the gateway on `:8080`. So exposure is dev-local right now.

**It stops being dev-local the moment either happens:** core-service gets a published port, or
someone proxies the route through the gateway. Note that *building the onboarding UI is exactly the
change that would proxy the route* — which is why the guard had to be closed before, not after, any
screen is considered.

### The fix (2026-08-24)

`Apps/core-service/src/routes/tenants.ts`:

- **Fails closed.** An unset or blank `TENANT_BOOTSTRAP_TOKEN` now returns **503** with
  `problem+json` ("Self-serve onboarding is not enabled.") and logs at error level, instead of
  skipping the check. Absent configuration disables the *feature*, not its *guard*. `503` is declared
  on the route schema alongside the existing codes.
- **Constant-time token comparison.** The old `providedToken !== requiredToken` leaked the secret to
  a timing oracle. Now `matchesBootstrapToken` uses `timingSafeEqual` with a length pre-check, the
  same shape as `billing-service/src/services/webhook-dispatcher.ts:120`. Array-valued headers are
  handled rather than coerced.
- **`TENANT_BOOTSTRAP_TOKEN` documented** in `.env.example` (commented out — disabled is the correct
  default) and set to a clearly-marked dev-only value in `.env`, which is committed and must not
  carry a real secret.
- **Two regression tests now run in CI** — `tenants.test.ts` → *"POST /v1/tenants/bootstrap -
  onboarding guard"*: missing token → 401, wrong token → 401, correct token → 201, and no token
  configured → 503. They sit in their own live `describe` because the older self-serve suite stays
  skipped for an unrelated reason (see below).
- `http_test/tenantandproperty.http` sends the header and documents both failure codes.

**Verified:** core-service `typecheck`, `biome` and `lint` clean (lint's 16 warnings are pre-existing
and in other files); full suite **184 passed, 0 failed, 31 skipped**.

**Incidental finding — the skip reason is stale.** `tenants.test.ts:124` blames "a pre-existing email
validation issue in Fastify/AJV". Running the block un-skipped shows that is no longer what fails:
the two remaining failures are **db-mock gaps** — the mock returns the tenant *name* where a *slug* is
expected, so `slug` round-trips wrong and duplicate-slug detection never triggers (`expected 201 to be
409`). Worth fixing, but it is mock work, not route work, and it is not what the comment says.

## Why the Audit Missed This

Three independent mechanisms, all traceable to the method section of
[00-CONSOLIDATED.md](00-CONSOLIDATED.md):

**1. The fallback check was a whole-word domain search, and `tenant` is the most common word in the
front-end.** The method states: *"Every gap in this backlog was re-verified by whole-word search for
the domain name… Where a spec says 'zero UI presence', the word itself does not occur."* In
`UI/pms-ui/src/app` the token `tenant` (incl. `tenants`/`tenantId`/`tenant_id`) occurs **1,586 times
across 79 files**. The domain read as maximally covered.

The flaw is structural, not accidental: the search cannot distinguish **tenant-as-scoping-key** from
**tenant-as-managed-entity**. Every screen is tenant-*scoped*, so the noun is everywhere; nothing
*provisions* a tenant, so the capability is nowhere. Any domain whose name is also a scoping
parameter is invisible to this check.

**2. `/v1/system/*` was excluded by an explicit scope rule.** The method's closing line puts
`/v1/registry`, `/v1/locks`, `/v1/system` and health out of scope as "infrastructure… not expected to
have UI". Three of the five endpoints above sit under `/v1/system/tenants`. But tenant provisioning
is a **business capability wearing an infrastructure prefix** — the rule mis-filed it. Path prefix is
not a reliable proxy for "infrastructure".

**3. The audit's instrument was gateway-mediated reachability, and bootstrap is not proxied.** The
COV-05/17/19 work inventoried the 127 proxied routes and asked which the UI could reach.
`POST /v1/tenants/bootstrap` never entered that inventory, because it is not proxied at all. A route
with **no** gateway entry is invisible to a gateway-diffing method — the opposite failure from COV-19,
where proxies pointed at nothing.

There is also a framing limit worth stating plainly: the audit scoped itself to *"API ↔ UI coverage
for the running product."* Tenant creation sits **before** that boundary — it is what brings the
product into existence for a customer. Nothing in the frame was looking there.

## The Decision: Do Not Build the Screen

**Frequency does not justify it.** Tenant creation is a sales event — a handful per year, performed
by the repo owner, who is comfortable with `curl` and already has `.http` fixtures for it. Compare
the reasoning in [03-ar-account-management.md](03-ar-account-management.md), where a UI *was*
justified because "onboarding a new corporate client is one flow rather than a DB insert" — that is
frequent and done by front-desk staff. Both terms of `frequency × distance-from-terminal` are small
here.

**The build is larger than one screen.** It needs a gateway proxy route, a decision on the auth model
(public unauthenticated signup vs. system-admin-only provisioning), and a route outside the app
shell — `app.routes.ts` puts only `login` and `select-property` there. Genuine self-serve signup
additionally drags in billing, email verification, slug squatting and abuse controls stronger than a
per-IP in-memory counter. That is a product line, not a screen.

**This was already the plan.** `TODO.md:169` files it as *"Optional next: add self-serve onboarding
(invite code or billing signup) that calls the same bootstrap flow"* — deliberately optional, with
the API half marked done.

### When to revisit

When self-serve trials become a commercial goal. At that point the screen is not a convenience, it is
the top of the funnel, and it should be built together with billing and email verification rather
than retrofitted onto the current endpoint.

## Work Required

1. ~~**Close the guard.**~~ ✅ done 2026-08-24 — see *The fix* above.
2. ~~**Fix the method.**~~ ✅ done 2026-08-24 — [00-CONSOLIDATED.md](00-CONSOLIDATED.md) now records
   both failure modes: whole-word search is not valid verification for a domain whose name is also a
   scoping key, and `/v1/system/*` needs per-route triage rather than blanket exclusion.
3. **Reconsider the rate limiter** *if the route is ever proxied* — a process-local `Map` is not a
   control once there is more than one instance. Left as-is deliberately: unproxied and token-gated,
   it is not currently load-bearing.
4. **Fix the db mock** so the self-serve suite can be un-skipped, and correct the stale skip comment.
   Small, and unrelated to the guard.
5. **Do not** build the onboarding screen.

## Acceptance

- ✅ `POST /v1/tenants/bootstrap` cannot be called without a token in any environment — unset config
  disables the route rather than its guard, asserted by a CI test.
- The method section records the scoping-key weakness, so the next audit re-derives this class of
  gap instead of re-hiding it.
- This file is the standing answer to "why is there no tenant onboarding screen?"

## Cross-reference

- [00-CONSOLIDATED.md](00-CONSOLIDATED.md) — Method & Known Weakness gains a third failure mode.
- [19-gateway-proxy-mismatches.md](19-gateway-proxy-mismatches.md) — the mirror image: proxies to
  nothing, versus this file's routes with no proxy.
- `TODO.md:165-174` — items 9 and 10, where the bootstrap API was specced and marked done.
