# Domain 15 — Payments & Fiscal Compliance

> **Benchmark:** 18 capabilities · **Built** 1 · **Partial** 9 · **Missing** 8
> **Gap items in this file:** 17
> **Fix specs:** [WORKSTREAMS.md](WORKSTREAMS.md) · **Ledger:** [TRACKER.md](TRACKER.md)

## Already built — do not rebuild

Refund controls

---

## Gap items

| ID | Capability | Status | Tier | Pri | Effort | Workstream |
|---|---|---|---|---|---|---|
| [PMS-15-01](#pms-15-01) | PCI DSS v4.0 alignment | PARTIAL | Table stakes | P0 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-02](#pms-15-02) | Payment gateway integration | PARTIAL | Table stakes | P0 | XL | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-03](#pms-15-03) | Card tokenization | PARTIAL | Table stakes | P0 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-04](#pms-15-04) | Encryption in transit and at rest | PARTIAL | Table stakes | P0 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-05](#pms-15-05) | EMV / P2PE terminal integration | MISSING | Competitive | P1 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-06](#pms-15-06) | 3-D Secure and SCA | MISSING | Competitive | P1 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-07](#pms-15-07) | Alternative payment methods | MISSING | Competitive | P1 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-08](#pms-15-08) | Pre-authorization strategy | PARTIAL | Competitive | P1 | S | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-09](#pms-15-09) | Chargeback evidence packaging | PARTIAL | Competitive | P1 | S | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-10](#pms-15-10) | Surcharge and convenience fees | MISSING | Competitive | P1 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-11](#pms-15-11) | Legal invoice numbering | PARTIAL | Competitive | P1 | S | [WS-08](WORKSTREAMS.md#ws-08) |
| [PMS-15-12](#pms-15-12) | Multi-acquirer / gateway abstraction | PARTIAL | Enterprise | P2 | M | [WS-07](WORKSTREAMS.md#ws-07) |
| [PMS-15-13](#pms-15-13) | Fiscalization integration | MISSING | Enterprise | P1 | XL | [WS-08](WORKSTREAMS.md#ws-08) |
| [PMS-15-14](#pms-15-14) | e-Invoicing submission | MISSING | Enterprise | P1 | L | [WS-08](WORKSTREAMS.md#ws-08) |
| [PMS-15-15](#pms-15-15) | Fiscal audit file export | MISSING | Enterprise | P1 | L | [WS-08](WORKSTREAMS.md#ws-08) |
| [PMS-15-16](#pms-15-16) | Failed fiscal payload replay | MISSING | Enterprise | P1 | L | [WS-08](WORKSTREAMS.md#ws-08) |
| [PMS-15-17](#pms-15-17) | Tax registration IDs on documents | PARTIAL | Enterprise | P1 | M | [WS-06](WORKSTREAMS.md#ws-06) |

---

### PMS-15-01

**PCI DSS v4.0 alignment** — PARTIAL · Table stakes · P0 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** Compliance policy code and documentation; no attested scope boundary.

**Fix:** Once the PSP path exists, document and enforce the scope boundary: no PAN in Tartware, tokens only, and a test that asserts it.

### PMS-15-02

**Payment gateway integration** — PARTIAL · Table stakes · P0 · Effort XL · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** A real Stripe adapter exists in guests-service for the self-service booking path only. billing-service stores gateway_name / gateway_reference passed in by the caller and never calls a PSP.

**Fix:** Move the `PaymentGateway` interface into `schema/src/api/payment-gateway.ts`, keep the Stripe adapter as the first implementation, and make `billing-service` call it for authorize / capture / refund / void instead of storing caller-supplied references.

### PMS-15-03

**Card tokenization** — PARTIAL · Table stakes · P0 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** payment_tokens table; tokens come from the caller.

**Fix:** Tokens must come from the PSP through the adapter and land in `payment_tokens`; never accept a token from a caller.

### PMS-15-04

**Encryption in transit and at rest** — PARTIAL · Table stakes · P0 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** mTLS and zero-trust are documented; no key management to back it.

**Fix:** Pairs with WS-24 key management.

### PMS-15-05

**EMV / P2PE terminal integration** — MISSING · Competitive · P1 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Terminal adapter behind the same interface; the desk needs card-present.

### PMS-15-06

**3-D Secure and SCA** — MISSING · Competitive · P1 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Challenge flow through the adapter; mandatory for EEA card-not-present.

### PMS-15-07

**Alternative payment methods** — MISSING · Competitive · P1 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Wallets and local methods as adapter capabilities, not new code paths.

### PMS-15-08

**Pre-authorization strategy** — PARTIAL · Competitive · P1 · Effort S · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** Authorize, increment and void are implemented as ledger operations, not gateway operations.

**Fix:** Policy for initial hold, top-up thresholds and release timing, driven off the folio balance.

### PMS-15-09

**Chargeback evidence packaging** — PARTIAL · Competitive · P1 · Effort S · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** Chargeback status tracking only; no evidence bundle.

**Fix:** Assemble folio, registration card and comms into an evidence bundle — depends on WS-06.

### PMS-15-10

**Surcharge and convenience fees** — MISSING · Competitive · P1 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** No schema, no route, no screen, no reference anywhere in the repo.

**Fix:** Fee rules per payment method, posted as their own charge code.

### PMS-15-11

**Legal invoice numbering** — PARTIAL · Competitive · P1 · Effort S · [WS-08](WORKSTREAMS.md#ws-08)

**Today:** Invoice numbers are generated; no gapless legal sequence per fiscal jurisdiction.

**Fix:** Gapless legal sequence per property per jurisdiction, allocated before the document renders (WS-06). Already specced in `accounts-gaps/11-invoice-sequential-numbering.md`.

### PMS-15-12

**Multi-acquirer / gateway abstraction** — PARTIAL · Enterprise · P2 · Effort M · [WS-07](WORKSTREAMS.md#ws-07)

**Today:** A PaymentGateway interface exists with exactly one implementation.

**Fix:** Adapter registry keyed by `payment_gateway_configurations` so a property can switch acquirer.

### PMS-15-13

**Fiscalization integration** — MISSING · Enterprise · P1 · Effort XL · [WS-08](WORKSTREAMS.md#ws-08)

**Today:** Nothing. 'Fiscal' in this codebase means accounting periods only — no TSE, KassenSichV, SdI, NF-e or GST e-invoicing anywhere.

**Fix:** A `FiscalDevice` provider interface in schema plus per-jurisdiction adapters (KassenSichV/TSE, SdI, NF-e, India GST). Every settlement submits and stores the signature.

### PMS-15-14

**e-Invoicing submission** — MISSING · Enterprise · P1 · Effort L · [WS-08](WORKSTREAMS.md#ws-08)

**Today:** Not modelled.

**Fix:** Submission queue with retry and status per invoice.

### PMS-15-15

**Fiscal audit file export** — MISSING · Enterprise · P1 · Effort L · [WS-08](WORKSTREAMS.md#ws-08)

**Today:** Not modelled.

**Fix:** Per-jurisdiction audit file writer over the GL and invoice tables.

### PMS-15-16

**Failed fiscal payload replay** — MISSING · Enterprise · P1 · Effort L · [WS-08](WORKSTREAMS.md#ws-08)

**Today:** Not modelled.

**Fix:** DLQ + replay tooling — the same pattern the outbox already uses.

### PMS-15-17

**Tax registration IDs on documents** — PARTIAL · Enterprise · P1 · Effort M · [WS-06](WORKSTREAMS.md#ws-06)

**Today:** Tax config carries jurisdictions; documents do not carry registration IDs.

**Fix:** Property + tax jurisdiction registration IDs onto every rendered financial document. Legal requirement in most EU jurisdictions.

