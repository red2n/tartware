# Domain 19 — Administration, Configuration & Security

> **Benchmark:** 21 capabilities · **Built** 12 · **Partial** 6 · **Missing** 3
> **Gap items in this file:** 9
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Property configuration, Code and reference data management, Role-based access control, User management, Audit log, Reason code catalogues, Multi-factor authentication, Feature flags per property, Approval workflows, Data retention and purge policy, Module entitlement and licensing, Break-glass and privileged access review

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-19-01](#pms-19-01) | Password and session policy | PARTIAL | Table stakes | P0 | M | [WS-22](WORKSTREAMS.md#ws-22) |
| [PMS-19-02](#pms-19-02) | Screen and field-level permissions | PARTIAL | Competitive | P1 | S | [WS-22](WORKSTREAMS.md#ws-22) |
| [PMS-19-03](#pms-19-03) | Data-level restrictions | PARTIAL | Competitive | P1 | S | [WS-22](WORKSTREAMS.md#ws-22) |
| [PMS-19-04](#pms-19-04) | Single sign-on | PARTIAL | Competitive | P1 | S | [WS-22](WORKSTREAMS.md#ws-22) |
| [PMS-19-05](#pms-19-05) | Template and stationery editor | PARTIAL | Competitive | P1 | S | [WS-22](WORKSTREAMS.md#ws-22) |
| [PMS-19-06](#pms-19-06) | Multi-language content management | PARTIAL | Competitive | P1 | S | [WS-22](WORKSTREAMS.md#ws-22) |
| [PMS-19-07](#pms-19-07) | Report and export scheduling | MISSING | Competitive | P1 | M | [WS-22](WORKSTREAMS.md#ws-22) |
| [PMS-19-08](#pms-19-08) | Configuration migration | MISSING | Enterprise | P2 | L | [WS-22](WORKSTREAMS.md#ws-22) |
| [PMS-19-09](#pms-19-09) | Training / sandbox property | MISSING | Enterprise | P2 | L | [WS-22](WORKSTREAMS.md#ws-22) |

---

### PMS-19-01

**Password and session policy** — PARTIAL · Table stakes · P0 · Effort M · [WS-22](WORKSTREAMS.md#ws-22)

**Today:** Password rules and session expiry are enforced in code; not configurable per tenant.

**Fix:** Enforced in code, not configurable — move to per-tenant policy with the existing settings catalogue.

### PMS-19-02

**Screen and field-level permissions** — PARTIAL · Competitive · P1 · Effort S · [WS-22](WORKSTREAMS.md#ws-22)

**Today:** Screen permissions are complete; field_configurations is a table with no enforcement.

**Fix:** Screen permissions are complete; `field_configurations` has no enforcement path.

### PMS-19-03

**Data-level restrictions** — PARTIAL · Competitive · P1 · Effort S · [WS-22](WORKSTREAMS.md#ws-22)

**Today:** Tenant and property scoping is strong; no row-level restriction by department or market.

**Fix:** Row-level restriction by department, market segment or block on top of tenant/property scoping.

### PMS-19-04

**Single sign-on** — PARTIAL · Competitive · P1 · Effort S · [WS-22](WORKSTREAMS.md#ws-22)

**Today:** OIDC references exist; no configured IdP flow.

**Fix:** OIDC references exist; needs a configured IdP flow and provisioning.

### PMS-19-05

**Template and stationery editor** — PARTIAL · Competitive · P1 · Effort S · [WS-22](WORKSTREAMS.md#ws-22)

**Today:** Template CRUD exists; no editor.

**Fix:** Editor over `communication_templates` with variable insertion and preview through WS-06.

### PMS-19-06

**Multi-language content management** — PARTIAL · Competitive · P1 · Effort S · [WS-22](WORKSTREAMS.md#ws-22)

**Today:** UI strings are localized; content (rates, room types, policies) is single-language.

**Fix:** UI strings are localised; content (rate names, room types, policies) is single-language. Add a translation table keyed by entity + locale.

### PMS-19-07

**Report and export scheduling** — MISSING · Competitive · P1 · Effort M · [WS-22](WORKSTREAMS.md#ws-22)

**Today:** Table only.

**Fix:** See WS-20.

### PMS-19-08

**Configuration migration** — MISSING · Enterprise · P2 · Effort L · [WS-22](WORKSTREAMS.md#ws-22)

**Today:** No config export or promote between environments.

**Fix:** Export and promote configuration between environments.

### PMS-19-09

**Training / sandbox property** — MISSING · Enterprise · P2 · Effort L · [WS-22](WORKSTREAMS.md#ws-22)

**Today:** No demo or training mode.

**Fix:** A property flagged as training, with resettable data.

