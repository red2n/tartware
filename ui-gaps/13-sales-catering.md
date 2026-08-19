# COV-13: Sales & Catering — Banquet Orders, Meeting Rooms, Event Bookings

**Priority:** P2 | **Risk:** 🟡 MEDIUM | **Type:** Backend + UI | **Effort:** L

> ## ✅ Decision 2026-08-17: **build**
>
> Tartware is selling function space. The retire option below is closed; the three surfaces and
> their tables stay. Work proceeds one domain at a time in the order this spec already recommends —
> meeting rooms → event bookings → banquet orders — because each is the previous one's prerequisite.
>
> **Slice 1 — meeting-room writes: shipped 2026-08-17.** `POST /v1/meeting-rooms`,
> `PUT /v1/meeting-rooms/:roomId`, `DELETE /v1/meeting-rooms/:roomId` on core-service, plain HTTP
> per COV-18's rule (meeting rooms are named explicitly in its reference-data row). Gateway
> re-registered: bare `POST` plus `app.all` on the wildcard, replacing the `app.get` that the
> 2026-08-13 sweep left behind.
>
> Details worth carrying into slices 2 and 3:
>
> - **Delete is soft.** `event_bookings` and `banquet_event_orders` both reference
>   `meeting_rooms(room_id)` `ON DELETE RESTRICT`, so a hard delete fails as soon as a room has any
>   history. Retiring sets `is_deleted` + `is_active = false`.
> - **`room_code` is editable**, unlike a booking source's `source_code` — both FKs point at
>   `room_id`, not the code. It is still `UNIQUE (tenant_id, property_id, room_code)`, so the service
>   maps `23505` to a 409 rather than letting it surface as a 500.
> - **Zod bounds mirror the table's CHECK constraints** (`max_capacity > 0`, `area_* > 0`,
>   `hourly_rate >= 0`, setup/teardown/turnover `>= 0`) so a bad payload is a 400, not a 23514.
> - **The enums were already aligned** — `MeetingRoomTypeEnum` and `MeetingRoomStatusEnum` match
>   `meeting_rooms_room_type_check` / `_room_status_check` exactly. No drift to fix here.
>
> **Smoke-tested live 2026-08-18** — `http_test/smoke-events.sh`, 31 assertions green through the
> gateway. Every meeting-room path behaved as specified first time: create, duplicate `room_code` →
> 409, list, detail, update, retire, retire-again → 404.
>
> **Still to do in slice 1:** no UI yet (item 4 of the UI list below — meeting room admin).
>
> ### ✅ §2 billing decision 2026-08-18: **the event's own folio, `event_bookings.folio_id`**
>
> The gate this spec set before slice 2. **The data model had already answered it** — both options
> exist as columns and they are not alternatives:
>
> | Column | Comment in DDL | Role |
> |---|---|---|
> | `folio_id` | *"Reference to folios for charges"* | where event revenue posts |
> | `group_booking_id` | *"If part of group block"* | links the event to a group, when there is one |
>
> Both are nullable and independent, so an event billed on its own folio and an event inside a group
> block are the same shape with a different field populated. Choosing the group master folio *instead*
> would have meant ignoring `folio_id`, and choosing a bespoke event-folio table would have meant
> ignoring both. Neither is a real option against this table.
>
> **Slice 2 does not post charges** — that is UI item 6. What it does is stop foreclosing the choice:
> `folio_id` and `group_booking_id` are both accepted on create and update, so the billing work in
> item 6 has its linkage already populated. `accounts-gaps/17-group-master-billing.md` owns the group
> folio itself; this spec owns only the pointer.
>
> ### ✅ Slice 2 — event booking writes: shipped 2026-08-18
>
> `POST /v1/event-bookings`, `PUT /v1/event-bookings/:eventId`, and
> `POST /v1/event-bookings/:eventId/status` on core-service, plain HTTP per COV-18's rule.
>
> **Gateway had the same swallowing bug slice 1 found**, one layer along: `/v1/event-bookings` and
> `/v1/event-bookings/*` were *both* registered `app.get`, so every write would have 404ed at the
> gateway. Now a bare `POST` plus `app.all` on the wildcard, matching meeting rooms.
>
> **Availability: checked the guard first, as this spec asked.** `availability-guard-service` touches
> only `inventory_locks_shadow` and `inventory_lock_audits` — guest-room inventory — and has no
> concept of meeting rooms. It is the wrong mechanism for function space, so double-booking is a
> half-open overlap query on `event_bookings` itself: a booking ending at 12:00 does not collide with
> one starting at 12:00, and setup/teardown windows are included via
> `COALESCE(setup_start_time, start_time)` / `COALESCE(teardown_end_time, end_time)` so a room being
> dressed is not sold to someone else. `CANCELLED` and `NO_SHOW` release the space.
>
> **Lifecycle is enforced in the service, not the table.** The CHECK constrains the *value*, not the
> movement, so `LEGAL_TRANSITIONS` holds the ordering: `COMPLETED`/`NO_SHOW` are terminal, `CANCELLED`
> is reachable from any live status, and an illegal move is a 409. The transition also stamps
> `confirmed_date` / `cancellation_date` so the read model's key dates stay truthful.
>
> Details worth carrying into slice 3:
>
> - **`EventBookingStatusEnum`, `EventTypeEnum` and `EventSetupTypeEnum` already matched their CHECK
>   constraints exactly** — no case drift to fix, unlike the domains in the 2026-08-13 sweep.
>   `booking_status` in `EventBookingListItemSchema` was still typed `z.string()`, the untyped shape
>   that made the drift invisible to the type checker; **tightened to `EventBookingStatusEnum`
>   2026-08-18** after checking the CHECK holds exactly those eight spellings.
> - **`teardown_end_time` is not in the read model**, so an update that did not restate it would have
>   checked availability against a shorter window than the row actually holds. The service reads the
>   stored hold window from the table rather than from `EventBookingListItem`.
> - **The two cancellation columns are `cancellation_date` (TIMESTAMP) and `cancellation_notes`** —
>   not `cancelled_date` / `cancellation_reason` as the obvious guess would have it. TypeScript cannot
>   catch a wrong column name in a SQL string; every column in the new statements was checked against
>   the DDL by hand.
> - **`event_number` has no unique constraint**, so unlike `room_code` there is no 409 path for it.
>
> ### ⚠️ Smoke test 2026-08-18: two bugs that only a running stack could find
>
> `http_test/smoke-events.sh` — 31 assertions through the gateway, added with this run. Slice 1 was
> clean. **Slice 2 was broken in both of its new code paths**, and neither the type checker nor the
> conformance suites could see it:
>
> **1. Every successful write returned 500.** The three write routes declared the bare
> `EventBookingListItem` as their success response while the handlers reply `{ data, message }` —
> so fast-json-stringify rejected the payload with `"event_id" is required!`. The insert had
> *already committed* by then, so the caller saw a 500 for a booking that existed. The fix is
> `EventBookingWriteResponseSchema` in `schema/src/api/events.ts` (the envelope, mirroring
> `AmenityResponseSchema`), not the local `z.object` the STOP GATE forbids. A sweep of every route
> block in `Apps/*/src` that declares a 2xx schema and sends an envelope found no other instance —
> `settings-catalog` uses a permissive `jsonObjectSchema` and `settings-amenities` already declares
> the envelope.
>
> Worth noting *why* the meeting-room routes escaped: they declare **no** success response at all,
> which is the house convention here (`distribution.ts`, `group-waitlist-promo.ts` do the same). The
> event routes were the ones that tried to be more precise and got it wrong.
>
> **2. Every lifecycle transition returned 500.** `UPDATE … SET booking_status = $3, confirmed_date =
> CASE WHEN $3 = 'CONFIRMED' …` makes Postgres deduce `character varying` from the assignment and
> `text` from the comparison, and it refuses the statement: `inconsistent types deduced for parameter
> $3`. Casting every use (`$3::text`) fixes it. This is invisible until the statement is actually
> prepared — the whole of `LEGAL_TRANSITIONS`, the terminal-status rules and the `confirmed_date` /
> `cancellation_date` stamping had never once executed. Swept for `CASE WHEN $n` without a cast
> across all services: no other occurrence.
>
> With both fixed, the behaviour the spec claims is now demonstrated rather than asserted: half-open
> overlap (a 12:00 start does not collide with a 12:00 end), setup and teardown windows holding the
> room, `CANCELLED` releasing the slot for a rebooking, an illegal transition returning 409, and a
> `PUT` that extends a booking into its neighbour returning 409.
>
> **Still to do in slice 2:** no UI yet.

> ### ✅ UI items 1 + 2 + 4 — shipped 2026-08-18
>
> `UI/pms-ui/src/app/features/events/`, the three the spec says to ship first. Reachable from a new
> **Events** nav section; screen keys `events` (the calendar and detail) and `meeting-rooms` (the
> admin), split that way because the backend already draws the same line — booking an event is
> `STAFF`, editing function space inventory is `MANAGER`.
>
> | Item | Screen | Route |
> |---|---|---|
> | 1 | Function space calendar — rooms × days, modelled on `features/rate-calendar` | `/events/calendar` |
> | 2 | Event booking detail — space, client, attendance, money, lifecycle | `/events/bookings/:eventId` |
> | 4 | Meeting room admin — settings-style CRUD | `/events/meeting-rooms` |
>
> **The read model had to grow first.** `EventBookingListItem` carries what a calendar cell needs;
> a detail screen needs the contact, what was promised, and where the money lands. The by-id query
> already *selected* most of it and the shared mapper threw it away — zod strips unknown keys. So
> `EventBookingDetailSchema` extends the list item with `teardown_end_time`, the three `contact_*`
> fields, `setup_details`, `special_requests`, `internal_notes`, the `billing_*` fields, the two
> cancellation columns, and the §2 linkage `folio_id` / `group_booking_id` — the last two being why
> the spec asks for a linked group booking on this screen at all. `folio_id`, `billing_*`,
> `cancellation_date` and `cancellation_notes` were added to the SQL; the rest were already selected.
>
> **`LEGAL_TRANSITIONS` moved into `@tartware/schemas`** as `EVENT_BOOKING_LEGAL_TRANSITIONS`. The
> detail screen offers exactly the moves the service will accept, so it can never show a button that
> 409s; a second copy in the UI would have drifted the first time the rule changed.
>
> **Driven end to end in a real browser, not just screenshotted:** create a booking from the calendar
> (chip count 9 → 10), collide with it deliberately (the 409's "already booked" message reaches the
> user as a toast), then move Tentative → Definite from the detail screen and watch the offered
> transitions become Confirmed / In Progress / Cancelled. Typecheck, biome, 97/97 contrast pairings,
> light and dark.
>
> Two things the screenshots caught that no test would have:
>
> - **`labelFor` did not lowercase first**, so every enum label rendered as the raw constant — the
>   lifecycle buttons shouted `DEFINITE` next to a badge reading "Definite", because the badge comes
>   from the server's own display label and the button did not.
> - **The day columns sized themselves to content**, so one long event name widened its column and
>   pushed the rest of the fortnight out of alignment. `table-layout: fixed` plus a two-line chip
>   (time above name) — a one-line chip left about six characters for the name at 118px.
>
> **Still open here:** item 6 (event billing). `folio_id` is displayed but nothing posts to it yet.
> Items 3 (BEO editor) and 5 (daily BEO print) are unblocked as of slice 3 below.

### ✅ Slice 3 — banquet order writes: shipped 2026-08-19

`POST /v1/banquet-orders`, `PUT …/:beoId`, `POST …/:beoId/publish` and `POST …/:beoId/revise` on
core-service, plain HTTP per COV-18's rule, matching slices 1 and 2. Banquet lives in
`routes/operations.ts` / `services/operations-service.ts` rather than `booking-config/event.ts`, so
it follows that file's conventions (flat registration, no success-response schema — see below).

**Gateway promoted in the same commit**, as this spec asked: `operations-routes.ts` was `GET` +
`GET /*`, now `GET` + bare `POST` + `app.all` on the wildcard. That is the third consecutive slice to
find the same hole. `Apps/api-gateway/tests/wildcard-write-conformance.test.ts` — the check added in
slice 2 precisely to stop this recurring — would have failed the build had the promotion been
forgotten, and it is the reason this one was caught before a live run rather than by one.

#### The design decisions this slice had to make

**Publish is what makes "frozen" mean something.** A BEO's authority comes from the kitchen and the
setup crew holding a copy of it. So publishing closes the document: `PUT` is accepted only while the
BEO is `DRAFT` or `PENDING_APPROVAL` (`BEO_EDITABLE_STATUSES`, exported from `@tartware/schemas` so
the editor can disable its own form rather than let a user type into a document the service will
refuse — the same reasoning as `EVENT_BOOKING_LEGAL_TRANSITIONS`). Editing a published BEO is a 409,
and so is publishing one twice: the caller believes it is releasing something the departments have
not seen, and it is not.

**A revision is a new row, not an edit.** Same `beo_number`, `beo_version + 1`, `previous_beo_id`
pointing at the row it replaces, back to `DRAFT` so it is edited and published in its own right.
The table's `UNIQUE (tenant_id, property_id, beo_number, beo_version)` is exactly what lets both
versions coexist under one number — the constraint was designed for this and nothing had used it.
Revising a version that has *already* been revised is a 409, or the chain forks.

**Supersession is derived, not stored.** `beo_status`'s CHECK has no `SUPERSEDED` value, and adding
one would have meant a migration to record something the revision chain already knows. `is_superseded`
is an `EXISTS` over rows whose `previous_beo_id` points back — so v1 keeps reading as `APPROVED`,
which is the truthful answer to "what did the kitchen receive", while still being visibly stale.

**What a revision does *not* carry forward:** approvals (the chef approved a different menu, so v2
starts unapproved), and the `last_sent_to_*` stamps (nobody has been sent this version). Execution
tracking — `setup_completed`, `event_started` — *does* carry forward: those describe the physical
event, which a paperwork revision does not undo.

**The revision copies the row via `to_jsonb` / `jsonb_populate_record`** rather than naming ~140
columns. A hand-written column list would silently stop copying any column added to the table later,
and "the v3 lost the field someone added last month" is a bug nobody would attribute to this code.

#### Two traps found by reading, before they could be found by running

Slices 1 and 2 each shipped a bug that only a live stack caught. This slice found its two at the
schema and driver level instead, which is why the smoke test passed first time rather than second:

**1. `BeoStatusEnum` had drifted from the CHECK constraint.** It read
`DRAFT, PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED`; the table says
`DRAFT, PENDING_APPROVAL, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED`. Two values wrong, and the
first write to reach for the enum would have been rejected by Postgres at runtime. It survived
because **nothing referenced it** — `beo_status` on the list item was the untyped `z.string()`, and
the GET route spelled its filter values out by hand, correctly. Same class as the 2026-08-13
case-drift sweep and the same fix as slice 2 applied to `booking_status`: correct the enum, then
type the read model against it so the type checker owns the question from here.

**2. `pg` encodes a JS array as a Postgres array literal, not JSON.** Passing `menu_items` — a
`JSONB` column — as an array would have written `{...}` array-literal syntax into a JSON document
column. The JSONB fields are `JSON.stringify`d explicitly; `distribution_list`, the one field here
that genuinely is `TEXT[]`, must *not* be. The smoke test asserts both directions round-trip, because
this is invisible to the type checker and the failure mode is a corrupt-looking document rather than
an error.

Details worth carrying forward:

- **The write path builds its statements from a column→value map, not a positional list.** A BEO has
  ~140 writable columns; as a positional `INSERT` a single misalignment writes the right value into
  the wrong column and still typechecks. The snake↔camel mapping between payload and service input
  was generated from the schema and diffed both ways rather than typed by hand — 120 body fields, all
  matched, `propertyId` correctly the only input key not settable from a payload.
- **Every column in the new SQL was diffed against the DDL programmatically**, per slice 2's note that
  TypeScript cannot catch a wrong column name in a SQL string. The by-id query selects 141 of the
  table's 146 columns; the five omitted are `created_by`, `updated_by`, `deleted_at`, `deleted_by`
  and `version`.
- **No success-response schema on these routes**, matching the other write routes in
  `operations.ts` and the house convention slice 2 identified. That is what kept slice 2's
  fast-json-stringify 500 from recurring here.
- **`room_setup` has no CHECK constraint** on `banquet_event_orders`, unlike `event_bookings.setup_type`.
  It is validated against `EventSetupTypeEnum` anyway, so the two tables tell the same story.
- **Only `beo_time_check` is enforced by the table** (`event_end_time > event_start_time`), and the
  write schema now mirrors that and nothing else. It briefly also required setup before the event and
  teardown after it — see the correction under UI item 3 below, which is where that turned out to be
  wrong.
- **Not covered by these four endpoints:** the `IN_PROGRESS` / `COMPLETED` end of the status enum and
  the execution flags (`setup_completed`, `event_started`, `event_ended`, `teardown_completed`) are
  settable on a draft but have no operational transition route. That belongs with UI item 5, the
  kitchen view, and is called out here rather than invented as a fifth endpoint.

#### ✅ Smoke test 2026-08-19

`http_test/smoke-events.sh` grew a slice 3 section — **70 assertions through the gateway, all green**,
39 of them new. Slices 1 and 2 still pass unchanged. It covers: create as DRAFT, the three payload
bounds rejecting at 400, an unknown event booking at 404, edit-while-draft, publish stamping
`last_sent_to_kitchen` / `last_sent_to_client`, edit-after-publish and double-publish both at 409,
revise producing v2 under the same number with content copied and approvals cleared, v1 flipping to
superseded while keeping `APPROVED`, re-revising a superseded version at 409, and both versions
listing under one `beo_number`.

BEOs have no delete or cancel route, so the rows the script creates are left in place under
run-unique BEO numbers rather than cleaned up.

**Still to do in slice 3:** no UI yet — items 3 (BEO editor) and 5 (daily BEO print), both now
unblocked.

### ✅ UI item 3 — BEO editor: shipped 2026-08-19

`UI/pms-ui/src/app/features/events/beo-editor/`, at `/events/beos/:beoId`. Screen key `events`, not a
new one: `POST /v1/banquet-orders` is STAFF like the booking routes, not MANAGER like meeting-room
inventory, so the existing key already draws the right line and the permission seed is untouched.

**Not in the nav.** A BEO only exists as the operational detail of one booking, so there is no useful
"all BEOs" entry point at nav level. It is reached from the booking, which is also where one gets
raised — a new **Banquet event orders** card on the event booking detail lists every version and
offers *Create BEO*.

**Creating a BEO does not ask for anything twice.** The room, date, window, layout and head count are
already on the booking, so the create carries them across and drops the operator into the editor for
the food and service detail. `setup_start_time` is NOT NULL on the BEO where it is optional on the
booking, so it falls back to the event start.

**The screen cannot offer an action the service will refuse.** `BEO_EDITABLE_STATUSES` and
`BEO_PUBLISHABLE_STATUSES` come from `@tartware/schemas` — the same values the service enforces — so
a published BEO shows no Edit button rather than showing one that 409s, and a superseded version
shows no actions at all. Same reasoning as `EVENT_BOOKING_LEGAL_TRANSITIONS` in item 2.

**The JSONB course lists are editable.** Appetizers through desserts, plus stations, beverages,
equipment and AV, each a name/quantity/note row list. Keys the screen does not edit (`price`,
`dietary_notes`, `presentation_style`) are read and written back untouched, so opening a BEO here
never silently drops detail entered elsewhere.

**One backend gap the UI exposed:** `GET /v1/banquet-orders` had no `event_booking_id` filter, so
there was no way to ask "does this booking have a BEO" or to build a revision history without walking
`previous_beo_id` one request at a time. Added, along with `beo_number, beo_version` in the ORDER BY
so a history reads in order.

#### ⚠️ A bug this slice put in, and the limitation it uncovered

**Slice 3's write schema rejected the most ordinary banquet there is.** It required
`teardown_end_time >= event_end_time` and `setup_start_time <= event_start_time`. Both read like safe
invariants. Both are wrong: these are bare `TIME` columns with no date, so a teardown at 01:00 after a
23:30 finish is the next morning, and a string comparison reads it as thirteen hours *early*. The
first realistic payload — a wedding running to 23:30 and cleared down by 01:00 — bounced with a 400.

Neither rule is backed by a CHECK on `banquet_event_orders`. The stated principle for slice 3 was
"bounds mirror the table's CHECK constraints"; these two were invention on top of it, and the
invention is what broke. Both removed; `event_end_time > event_start_time` stays because
`beo_time_check` really does say so. The smoke test now asserts a past-midnight teardown is
**accepted**, so this cannot come back.

Worth being precise about why item 2 was right to have the equivalent rule and item 3 was not:
`event_bookings` declares `event_bookings_setup_time_check`, so slice 2 was mirroring a real
constraint. `banquet_event_orders` declares no such thing.

**The limitation underneath, which is pre-existing and module-wide:** both
`event_bookings_time_check` and `beo_time_check` are `end > start` on bare `TIME` columns, so **an
event that ends after midnight cannot be stored at all** — a wedding running 18:00 → 01:00 is
rejected by the table itself, not by any code written here. Every function running into the small
hours has to be recorded as ending at 23:59. This predates all three slices and is not something a UI
slice should quietly work around: fixing it means a migration on two tables plus a change to slice
2's overlap query, which compares the same bare times. Recorded here as the next real correctness
item in this module.

#### Driven end to end in a real browser

Not just screenshotted — 14 assertions through Playwright against the running stack, on a wedding
seeded for the purpose: a superseded version offers no Edit, Publish or Revise; a draft edit (head
count plus a new entrée line) saves and comes back; publishing flips the status to Approved and
**withdraws Edit and Publish while leaving Revise**; revising creates v3, navigates to it rather than
leaving the operator on the version they just superseded, and the history lists all three with v3
marked "You are here". No console errors. Light and dark, 97/97 contrast pairings.

Two things the screenshots caught that no assertion would have:

- **`5.00% over-set`** — the money and percentage columns are cast `::TEXT` by the query, so they
  arrive carrying the column's scale. A 5% over-set read like a precision nobody entered. Trimmed for
  display.
- **A note placeholder reading `Served with jus`** on every empty row, including the salads, which
  scans as real data rather than as a hint.

**Styling follows UI/AGENTS.md line 38** — reusable patterns live in `src/styles/shared.scss`, not
copied into component files. The first cut of this screen broke that twice: it copy-pasted
`.status-strip` out of the event booking detail, and it wrote the same clickable-row list under two
names (`.version-*` here, `.beo-*` on the booking). Both are now one pattern in `shared.scss` —
`.status-strip` and `.record-row-list` / `.record-row` / `.record-row-btn` / `.record-row-label` —
and `event-booking-detail.scss` was deleted outright because nothing component-specific was left in
it. Only the BEO course-line editor (`.line-*`, `.course-*`) stays local, being genuinely single-use.
Verified by computed style rather than by eye, per the encapsulation gotcha in the run-tartware-ui
skill: the dividers, hover targets and trailing chevron all still resolve on both screens.

### ✅ The midnight limitation: closed 2026-08-19

The limitation recorded above — `end > start` on bare `TIME` columns, so an 18:00 → 01:00 wedding
could not be stored at all — is fixed, on both tables and through the whole stack.

**The fix is a convention, not a column type change.** `event_date DATE` + bare `TIME` is what the
calendar, the indexes, the list ordering and both screens are built on; moving to `TIMESTAMP` would
have rewritten all of that to express something the existing columns can already say. So the booking
is **anchored at `event_date + start_time`** and every other time on the row is read relative to it:

- `end_time` / `teardown_end_time` **at or before** `start_time` fall on the **next** day.
- `setup_start_time` **after** `start_time` falls on the **previous** day.

Under that rule every combination of times denotes exactly one instant, so there is no out-of-order
window left to forbid. `event_bookings_time_check` and `beo_time_check` are now `<>` rather than `>`,
and `event_bookings_setup_time_check` was **dropped outright** — a setup after the start is a gala
being dressed the evening before, which is legitimate, not invalid.

**The rule is written twice and only twice.** Postgres owns it for stored rows as two generated
columns on `event_bookings` (`occupancy_starts_at`, `occupancy_ends_at`); `@tartware/schemas` owns
the TypeScript half (`eventEndsNextDay`, `eventSetupStartsPreviousDay`,
`resolveEventOccupancyWindow`), which the service uses for the *proposed* booking and all three
screens use for their labels. No query re-derives it. `banquet_event_orders` got no generated
columns: a BEO never competes for space, so nothing needs its resolved instants.

#### The second bug, which the limitation was hiding

Slice 2's double-booking check filtered `event_date = $3` and compared bare times. Once events may
cross midnight that is wrong twice over, and the second fault is the worse one: **collisions between
neighbouring days were invisible**. A wedding running to 01:00 and a breakfast setting up at 00:30
the next morning never met, because they are anchored on different dates. The check now compares
resolved instants and prunes on `event_date BETWEEN $3 - 1 AND $3 + 1`, which keeps
`idx_event_bookings_meeting_room` usable.

#### The cost, paid back in the UI

A mistyped time is now silently a different day rather than a 400. So every screen that shows or
takes these times says which day it inferred: `Next day` / `Previous evening` hints under the time
inputs on all three forms, `(ends next day)` and `(from the previous evening)` on the booking
detail's read rows, and a `+1` marker on the calendar chip — the grid cell shows only the start time,
so without it the crossing is invisible where it matters most. One `.daybreak-marker` class in
`shared.scss` serves the calendar and the BEO header; the first cut had it twice under two names,
which is the same UI/AGENTS.md line 38 slip slice 3 recorded.

**Verified live: `http_test/smoke-events.sh`, 78 assertions green**, including six new ones — the
past-midnight event is accepted, a zero-length one is still a 400, a next-morning booking inside the
overnight window is a 409, one starting exactly as it ends is allowed (half-open holds), a setup on
the previous evening is accepted, and a booking inside that setup window is a 409. The BEO assertion
that used to read "end before start → 400" now reads "overnight banquet accepted", with zero-length
taking over the 400 case.

**Not verified in a browser.** `UI/pms-ui/e2e/midnight.spec.ts` is written but has never run: neither
Playwright browser starts on this box (`libnspr4.so`, `libnss3.so`, `libasound.so.2` missing, no sudo
for `npx playwright install-deps`). `ng build` and the 97 contrast pairings are clean.

**What is still not representable:** an event lasting 24 hours or more, since `end_time = start_time`
is the one window the convention cannot disambiguate and remains a 400.

**Still open in this module:** item 5 (daily BEO print / kitchen view) and item 6 (event billing).


## Current State (Backend ⚠️ read-only → UI ❌)

> **This section is the original audit snapshot, as written. It is no longer true** — all three
> domains gained write paths in slices 1–3 above (2026-08-17 → 2026-08-19) and items 1, 2 and 4 of
> the UI list shipped 2026-08-18. It is kept unedited as the record of what the audit found; the
> decision blocks above are the current state.

Three related read-only surfaces with no UI, forming one absent product area.

| Method | Path | Route file |
|---|---|---|
| GET | `/v1/banquet-orders` | `Apps/core-service/src/routes/operations.ts:434` |
| GET | `/v1/banquet-orders/:beoId` | `…/operations.ts:503` |
| GET | `/v1/meeting-rooms` | `…/booking-config/event.ts` |
| GET | `/v1/meeting-rooms/:roomId` | `…/booking-config/event.ts` |
| GET | `/v1/event-bookings` | `…/booking-config/event.ts` |
| GET | `/v1/event-bookings/:eventId` | `…/booking-config/event.ts` |

Gateway: `operations-routes.ts:113` (banquet) and `booking-config-routes.ts:170, 196`
(meeting rooms, event bookings), each as `GET` + `ALL /*`.

Schemas exist — `schema/src/schemas/02-inventory/banquet-event-orders.ts`,
`meeting-rooms.ts`, `event-bookings.ts` — so the data model is designed. **No POST/PUT/PATCH/DELETE
anywhere and no commands.** None of `banquet`, `meeting-room`, `event-booking` occurs in `UI/`.

> The audit counted 2 + 1 + 1 = 4 endpoints. The real read surface is 6; writes are 0.

## Assessment

This is a **product-scope question, not a bug**. Sales & catering (function space booking, BEOs,
event billing) is a substantial PMS module — typically its own product alongside rooms. What exists
today is the read half of a data model, with no way to put anything into it.

Before building, answer: **is Tartware selling function space?** If not, the honest move is to retire
these three surfaces along with their tables and schemas, exactly as
[05-revenue-module-status.md](05-revenue-module-status.md) asks about revenue-service. Half a module
is worse than none: it appears in the OpenAPI document as capability the product does not have.

## If Building — Work Required

### 1. Backend write paths (per COV-18)

**Meeting rooms** (reference data, smallest first): ✅ **shipped 2026-08-17**
`POST/PUT/DELETE /v1/meeting-rooms` — capacity, layouts, area, features, rate basis.

**Event bookings** (the booking itself): ✅ **shipped 2026-08-18**
`POST /v1/event-bookings`, `PUT …/:eventId`, `POST …/:eventId/status` for the lifecycle —
tentative → definite → cancelled. The guard was checked first as instructed and found to be the wrong
mechanism (guest-room inventory only, no concept of meeting rooms), so availability is an overlap
query on `event_bookings` itself.

**Banquet orders** (BEO — the operational document): ✅ **shipped 2026-08-19**
`POST /v1/banquet-orders`, `PUT …/:beoId`, `POST …/:beoId/publish` (freeze for kitchen/ops),
`POST …/:beoId/revise` (versioned, since BEO revisions are the whole point). Publish freezes the
document against in-place edits; revise is a new row carrying `beo_version + 1` and `previous_beo_id`.

Derive every payload from the existing schema files, not from scratch.

### 2. Billing integration — decide early

Event revenue must land somewhere. Options: charges posted to a group master folio
(`accounts-gaps/17-group-master-billing.md`), or a dedicated event folio. This decision shapes the
whole module and must be made **before** the UI, not after. Also confirm F&B revenue mapping against
`accounts-gaps/16-usali-gl-code-mapping.md` — USALI treats banquet F&B separately from rooms.

### 3. UI — `UI/pms-ui/src/app/features/events/`

1. **Function space calendar** — meeting rooms × time, the primary working view. Model it on the
   existing `features/rate-calendar` grid rather than a new calendar component.
2. **Event booking detail** — client, contact, dates, spaces held, attendee counts, status, linked
   group booking, linked rooms block (`/v1/allotments`, see COV-16).
3. **BEO editor** — timeline of the event: setup, F&B courses and timings, AV, layout, staffing,
   special instructions. Revision history with a published/draft distinction.
   ✅ **shipped 2026-08-19** — `/events/beos/:beoId`, reached from the booking.
4. **Meeting room admin** — settings-style CRUD.
5. **Daily BEO print / kitchen view** — what the operation actually uses each morning.
6. **Event billing** — charges to the folio chosen in step 2.

Ship 1 + 2 + 4 first; a BEO editor without bookings to attach to is unusable.

## Acceptance

- Decision recorded here: build or retire, with a date.
- If retiring: routes, gateway proxies, schemas and tables removed in one PR.
- If building: function space can be booked and a BEO produced end to end, with event revenue landing
  on a folio.

## Cross-reference

- [18-write-path-gap.md](18-write-path-gap.md) — blocking if building.
- [16-booking-reference-data.md](16-booking-reference-data.md) — `/v1/allotments`, `/v1/group-bookings`
  and `/v1/companies` are the same read-only pattern and are needed for the rooms side of an event.
- `accounts-gaps/17-group-master-billing.md`, `accounts-gaps/16-usali-gl-code-mapping.md`.
