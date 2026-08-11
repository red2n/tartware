# COV-09: Guest Feedback — Read-Only, No UI

**Priority:** P1 | **Risk:** 🟡 MEDIUM | **Type:** Backend + UI | **Effort:** M

## Current State (Backend ⚠️ read-only → UI ❌)

`Apps/core-service/src/routes/operations.ts`:

| Method | Path | Line |
|---|---|---|
| GET | `/v1/guest-feedback` | 557 |
| GET | `/v1/guest-feedback/:feedbackId` | 619 |

Gateway proxies at `Apps/api-gateway/src/routes/operations-routes.ts:140` (`GET` + `ALL /*`).
`guest-feedback` does not occur in `UI/`. No write path and no command handler.

## Why It Matters

Feedback with no intake and no response workflow is a table that stays empty. Two halves are missing:

- **Intake** — nothing can create a feedback record: not the guest portal, not staff on a phone
  complaint, not a post-stay survey.
- **Response loop** — no way to acknowledge, categorise, assign or resolve. Complaint handling is
  where feedback earns its keep.

## Work Required

### 1. Backend write path

Per COV-18, on core-service alongside the existing reads:

- `POST /v1/guest-feedback` — create, with a `source` discriminator: `GUEST_PORTAL`, `STAFF_ENTERED`,
  `SURVEY`, `OTA_REVIEW`, `EMAIL`
- `PUT /v1/guest-feedback/:feedbackId` — categorise, set sentiment/score, assign an owner
- `POST /v1/guest-feedback/:feedbackId/respond` — record the response sent to the guest
- `POST /v1/guest-feedback/:feedbackId/resolve` — close with a resolution and optional service-recovery
  reference

Read the two `GET` response shapes and the backing table first; extend that model rather than
introducing a parallel one.

### 2. Guest-facing intake (guest-portal)

The guest portal (`UI/guest-portal`) has pages for search, booking, confirmation, lookup and check-in
and talks only to `/v1/self-service` via `services/guest-api.service.ts`. A post-stay or in-stay
feedback form needs a `self-service` endpoint that fans out to the same store — otherwise feedback is
staff-entered only. Decide whether to expose
`POST /v1/self-service/feedback` or to let the portal call `/v1/guest-feedback` directly (it should
not — the portal is unauthenticated guest context).

### 3. UI — `UI/pms-ui/src/app/features/guests/feedback/`

1. **Inbox** — date, guest, reservation, source, category, sentiment/score, status, owner. Filters:
   unresolved, source, category, score band, date range.
2. **Detail** — full text, linked guest and stay, response history.
3. **Actions** — assign, categorise, respond, resolve.
4. **Service recovery** — link a resolution to a comp posting (`billing.comp.post` is live and
   already has budget tracking and authorisation) so a goodwill gesture is recorded against the
   complaint that caused it.
5. **KPI tiles** — response rate, median time to first response, score trend, top categories.
6. **Guest-detail integration** — feedback history on the guest profile, next to the existing
   communications tab.

### 4. Overlap check before building

`notification.*` (7 commands, all handled in notification-service, none UI-reachable — see COV-17)
covers templates and automated messages. A post-stay survey trigger likely belongs there rather than
as new machinery here. Check `notification.automated.create` before writing a scheduler.

## Acceptance

- Staff can log a complaint from a phone call and carry it to resolution in the product.
- A guest can submit feedback through the portal, and it lands in the same inbox.
- Feedback appears on the guest profile.

## Cross-reference

- [18-write-path-gap.md](18-write-path-gap.md) — blocking.
- [11-self-service-coverage.md](11-self-service-coverage.md) — the portal-side intake endpoint.
- [17-command-reachability.md](17-command-reachability.md) — `notification.*` reachability.
