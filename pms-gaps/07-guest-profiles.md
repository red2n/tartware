# Domain 07 — Guest Profiles & CRM

> **Benchmark:** 26 capabilities · **Built** 12 · **Partial** 9 · **Missing** 5
> **Gap items in this file:** 14
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Contact details, Identification documents, Guest notes, GDPR consent and privacy options, Right of access and erasure, Profile merge, Preferences, VIP codes and levels, Revenue and stay statistics, Blacklist / do-not-rent, Attachments, Data retention and purge policy

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-07-01](#pms-07-01) | Profile types | PARTIAL | Table stakes | P0 | XL | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-02](#pms-07-02) | Stay history | PARTIAL | Table stakes | P0 | M | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-03](#pms-07-03) | Profile search and duplicate detection | PARTIAL | Table stakes | P0 | M | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-04](#pms-07-04) | Profile relationships | MISSING | Competitive | P1 | M | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-05](#pms-07-05) | Negotiated rates on the profile | PARTIAL | Competitive | P1 | S | [WS-03](WORKSTREAMS.md#ws-03) |
| [PMS-07-06](#pms-07-06) | Default routing on the profile | PARTIAL | Competitive | P1 | S | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-07](#pms-07-07) | Profile change log | PARTIAL | Competitive | P1 | S | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-08](#pms-07-08) | Batch profile update | MISSING | Competitive | P1 | M | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-09](#pms-07-09) | Profile anonymization / de-identification | PARTIAL | Enterprise | P2 | M | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-10](#pms-07-10) | External CRM lookup and download | MISSING | Enterprise | P2 | L | [WS-11](WORKSTREAMS.md#ws-11) |
| [PMS-07-11](#pms-07-11) | Commission setup on the profile | PARTIAL | Enterprise | P2 | M | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-12](#pms-07-12) | AR account linked to the profile | PARTIAL | Enterprise | P2 | M | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-13](#pms-07-13) | Guest photo | MISSING | Enterprise | P2 | L | [WS-13](WORKSTREAMS.md#ws-13) |
| [PMS-07-14](#pms-07-14) | Sales account management | MISSING | Enterprise | P2 | L | [WS-13](WORKSTREAMS.md#ws-13) |

---

### PMS-07-01

**Profile types** — PARTIAL · Table stakes · P0 · Effort XL · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** Guests, companies and travel agents are separate tables, not one profile model with types.

**Fix:** Guests, companies and travel agents are three tables. Introduce one profile model with a type discriminator, or a shared `profiles` spine the three specialise — every later item in this domain depends on the choice.

### PMS-07-02

**Stay history** — PARTIAL · Table stakes · P0 · Effort M · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** Reachable from reservations; no consolidated history view on the profile.

**Fix:** Consolidated history on the profile — reservations, revenue, preferences honoured, complaints.

### PMS-07-03

**Profile search and duplicate detection** — PARTIAL · Table stakes · P0 · Effort M · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** Search and merge work; nothing surfaces likely duplicates.

**Fix:** Merge works; add a similarity pass (name + email + phone + document) that surfaces likely duplicates before they multiply.

### PMS-07-04

**Profile relationships** — MISSING · Competitive · P1 · Effort M · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** No family, employer or referral links.

**Fix:** `profile_relationships` (family, employer, referral).

### PMS-07-05

**Negotiated rates on the profile** — PARTIAL · Competitive · P1 · Effort S · [WS-03](WORKSTREAMS.md#ws-03)

**Today:** Commission and contract data exist; no rate attached to the profile.

**Fix:** Same table, resolved from the profile attached to the booking.

### PMS-07-06

**Default routing on the profile** — PARTIAL · Competitive · P1 · Effort S · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** Routing templates exist at folio level, not on the profile.

**Fix:** Routing template attached to a profile, applied at booking.

### PMS-07-07

**Profile change log** — PARTIAL · Competitive · P1 · Effort S · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** Covered by the generic audit log; no per-profile timeline.

**Fix:** Per-profile timeline view over `audit_logs`.

### PMS-07-08

**Batch profile update** — MISSING · Competitive · P1 · Effort M · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** No bulk editor.

**Fix:** Bulk editor over a filtered profile set.

### PMS-07-09

**Profile anonymization / de-identification** — PARTIAL · Enterprise · P2 · Effort M · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** GDPR erase is a hard delete path, not de-identification that preserves statistics.

**Fix:** GDPR erase is a hard delete; add de-identification that keeps the statistics and drops the identity.

### PMS-07-10

**External CRM lookup and download** — MISSING · Enterprise · P2 · Effort L · [WS-11](WORKSTREAMS.md#ws-11)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Depends on WS-10's CRM connector.

### PMS-07-11

**Commission setup on the profile** — PARTIAL · Enterprise · P2 · Effort M · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** commission_rules are global, not per travel agent profile.

**Fix:** Move `commission_rules` onto the travel-agent profile.

### PMS-07-12

**AR account linked to the profile** — PARTIAL · Enterprise · P2 · Effort M · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** AR accounts stand alone; no profile link.

**Fix:** Foreign key from `accounts_receivable` to the profile.

### PMS-07-13

**Guest photo** — MISSING · Enterprise · P2 · Effort L · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Photo on the profile; feeds arrival recognition.

### PMS-07-14

**Sales account management** — MISSING · Enterprise · P2 · Effort L · [WS-13](WORKSTREAMS.md#ws-13)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Account owner, activities and pipeline on company profiles.

