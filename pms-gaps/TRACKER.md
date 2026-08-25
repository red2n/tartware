# Tracker

> One line per gap item. Tick the box when the item is shipped **and**
> `pnpm run build` is green. Put the commit SHA in the Notes column.
> Order below is domain order, not work order — see [00-CONSOLIDATED.md](00-CONSOLIDATED.md#phase-plan) for the sequence.

## P0 — 39 items

| ✓ | ID | Capability | Status | WS | Effort | Notes |
|---|---|---|---|---|---|---|
| [ ] | PMS-01-01 | Availability search | PARTIAL | WS-01 | M | |
| [ ] | PMS-01-02 | Multi-room reservation | MISSING | WS-01 | XL | |
| [ ] | PMS-01-03 | Multi-segment / split-rate stay | MISSING | WS-01 | XL | |
| [ ] | PMS-01-04 | Extend and shorten stay | PARTIAL | WS-01 | M | |
| [ ] | PMS-01-05 | Guarantee and payment instructions | PARTIAL | WS-05 | M | |
| [ ] | PMS-01-06 | Cancellation policy engine | PARTIAL | WS-05 | M | |
| [ ] | PMS-01-07 | Deposit request and schedule | PARTIAL | WS-05 | M | |
| [ ] | PMS-01-08 | Preferences | PARTIAL | WS-05 | M | |
| [ ] | PMS-01-09 | Confirmation letters | PARTIAL | WS-05 | M | |
| [ ] | PMS-02-01 | Check-in reversal | MISSING | WS-04 | M | |
| [ ] | PMS-02-02 | Room move for in-house guest | PARTIAL | WS-04 | M | |
| [ ] | PMS-02-03 | Credit card pre-authorization | PARTIAL | WS-07 | M | |
| [ ] | PMS-03-01 | Physical vs sellable inventory | PARTIAL | WS-02 | M | |
| [ ] | PMS-03-02 | Restrictions engine | PARTIAL | WS-02 | L | |
| [ ] | PMS-05-01 | Day-of-week pricing | PARTIAL | WS-03 | M | |
| [ ] | PMS-05-02 | Rate change log | PARTIAL | WS-03 | M | |
| [ ] | PMS-07-01 | Profile types | PARTIAL | WS-13 | XL | |
| [ ] | PMS-07-02 | Stay history | PARTIAL | WS-13 | M | |
| [ ] | PMS-07-03 | Profile search and duplicate detection | PARTIAL | WS-13 | M | |
| [ ] | PMS-09-01 | Cut-off date and auto-release | PARTIAL | WS-15 | M | |
| [ ] | PMS-11-01 | Folio generation and printing | PARTIAL | WS-06 | L | |
| [ ] | PMS-13-01 | Audit report pack | PARTIAL | WS-06 | M | |
| [ ] | PMS-14-01 | Channel manager connectivity | PARTIAL | WS-09 | XL | |
| [ ] | PMS-14-02 | Reservation delivery with retry | PARTIAL | WS-09 | M | |
| [ ] | PMS-14-03 | Modification and cancellation handling | PARTIAL | WS-09 | M | |
| [ ] | PMS-15-01 | PCI DSS v4.0 alignment | PARTIAL | WS-07 | M | |
| [ ] | PMS-15-02 | Payment gateway integration | PARTIAL | WS-07 | XL | |
| [ ] | PMS-15-03 | Card tokenization | PARTIAL | WS-07 | M | |
| [ ] | PMS-15-04 | Encryption in transit and at rest | PARTIAL | WS-07 | M | |
| [ ] | PMS-16-01 | Housekeeping status and discrepancy reports | PARTIAL | WS-12 | M | |
| [ ] | PMS-16-02 | Export formats | PARTIAL | WS-06 | M | |
| [ ] | PMS-17-01 | Door lock system | MISSING | WS-10 | L | |
| [ ] | PMS-17-02 | Point of sale | PARTIAL | WS-10 | M | |
| [ ] | PMS-17-03 | Payment gateway | PARTIAL | WS-07 | M | |
| [ ] | PMS-18-01 | Booking modification and cancellation self-service | PARTIAL | WS-09 | M | |
| [ ] | PMS-19-01 | Password and session policy | PARTIAL | WS-22 | M | |
| [ ] | PMS-21-01 | Optimistic concurrency | PARTIAL | WS-24 | M | |
| [ ] | PMS-21-02 | Backup and tested restore | PARTIAL | WS-24 | M | |
| [ ] | PMS-21-03 | Timezone correctness | PARTIAL | WS-24 | M | |

## P1 — 147 items

| ✓ | ID | Capability | Status | WS | Effort | Notes |
|---|---|---|---|---|---|---|
| [ ] | PMS-01-10 | Rate shopping / look-to-book screen | MISSING | WS-05 | M | |
| [ ] | PMS-01-11 | Share reservations | MISSING | WS-01 | M | |
| [ ] | PMS-01-12 | Linked / connected reservations | MISSING | WS-05 | M | |
| [ ] | PMS-01-13 | Accompanying guests | MISSING | WS-01 | M | |
| [ ] | PMS-01-14 | Reservation alerts | MISSING | WS-05 | M | |
| [ ] | PMS-01-15 | Fixed charges | MISSING | WS-05 | M | |
| [ ] | PMS-01-16 | Packages on the reservation | PARTIAL | WS-05 | S | |
| [ ] | PMS-01-17 | Item / inventory rentals | MISSING | WS-05 | M | |
| [ ] | PMS-01-18 | Upsell and upgrade offers | PARTIAL | WS-05 | S | |
| [ ] | PMS-01-19 | Copy and duplicate reservation | MISSING | WS-04 | M | |
| [ ] | PMS-01-20 | Reinstate cancelled reservation | MISSING | WS-04 | M | |
| [ ] | PMS-01-21 | Mass update | MISSING | WS-04 | M | |
| [ ] | PMS-01-22 | Mass cancellation | MISSING | WS-04 | M | |
| [ ] | PMS-01-23 | Early departure with penalty | MISSING | WS-04 | M | |
| [ ] | PMS-01-24 | Do-not-move flag | MISSING | WS-04 | M | |
| [ ] | PMS-01-25 | Turnaway / denial capture | PARTIAL | WS-04 | S | |
| [ ] | PMS-02-04 | Advance check-in | MISSING | WS-04 | M | |
| [ ] | PMS-02-05 | Mass check-in | MISSING | WS-04 | M | |
| [ ] | PMS-02-06 | ID and passport scanning | MISSING | WS-10 | M | |
| [ ] | PMS-02-07 | eSignature registration card | PARTIAL | WS-06 | S | |
| [ ] | PMS-02-08 | Batch registration card printing | MISSING | WS-06 | M | |
| [ ] | PMS-02-09 | Room key encoding | PARTIAL | WS-10 | S | |
| [ ] | PMS-02-10 | Queue rooms | MISSING | WS-04 | M | |
| [ ] | PMS-02-11 | Rooms on hold | PARTIAL | WS-04 | S | |
| [ ] | PMS-02-12 | Room swap / shift | MISSING | WS-04 | M | |
| [ ] | PMS-02-13 | Early check-out | PARTIAL | WS-04 | S | |
| [ ] | PMS-02-14 | Reinstate checked-out reservation | MISSING | WS-04 | M | |
| [ ] | PMS-02-15 | Guest messages | MISSING | WS-11 | M | |
| [ ] | PMS-02-16 | Service requests and complaint log | PARTIAL | WS-11 | S | |
| [ ] | PMS-02-17 | Currency exchange at the desk | PARTIAL | WS-17 | S | |
| [ ] | PMS-02-18 | Do-not-disturb and privacy flags | PARTIAL | WS-04 | S | |
| [ ] | PMS-03-03 | Building, wing, floor, section structure | PARTIAL | WS-02 | S | |
| [ ] | PMS-03-04 | Restriction scoping | MISSING | WS-02 | M | |
| [ ] | PMS-03-05 | Sell limits | MISSING | WS-02 | M | |
| [ ] | PMS-03-06 | Room condition codes | PARTIAL | WS-12 | S | |
| [ ] | PMS-03-07 | Room discrepancy detection | PARTIAL | WS-02 | S | |
| [ ] | PMS-03-08 | Item inventory availability | MISSING | WS-05 | M | |
| [ ] | PMS-03-09 | Availability rebuild job | MISSING | WS-02 | M | |
| [ ] | PMS-04-01 | Task sheets | MISSING | WS-12 | M | |
| [ ] | PMS-04-02 | Attendant console | PARTIAL | WS-12 | S | |
| [ ] | PMS-04-03 | Mobile attendant app | MISSING | WS-12 | M | |
| [ ] | PMS-04-04 | Auto-priority | PARTIAL | WS-12 | S | |
| [ ] | PMS-04-05 | Housekeeping forecast | MISSING | WS-12 | M | |
| [ ] | PMS-04-06 | Turndown scheduling | PARTIAL | WS-12 | S | |
| [ ] | PMS-04-07 | Minibar posting | PARTIAL | WS-10 | S | |
| [ ] | PMS-05-03 | Rate categories and groups | PARTIAL | WS-03 | S | |
| [ ] | PMS-05-04 | Derived and dynamic rates | PARTIAL | WS-03 | S | |
| [ ] | PMS-05-05 | Rate strategies / BAR tiers | MISSING | WS-03 | M | |
| [ ] | PMS-05-06 | Negotiated rates | PARTIAL | WS-03 | S | |
| [ ] | PMS-05-07 | Rate eligibility rules | MISSING | WS-03 | M | |
| [ ] | PMS-05-08 | Rate availability by channel | MISSING | WS-03 | M | |
| [ ] | PMS-05-09 | Yieldable vs non-yieldable flags | MISSING | WS-03 | M | |
| [ ] | PMS-05-10 | Rounding and minor-unit rules | PARTIAL | WS-03 | S | |
| [ ] | PMS-06-01 | Budget entry and variance | PARTIAL | WS-21 | S | |
| [ ] | PMS-06-02 | RMS integration | MISSING | WS-21 | M | |
| [ ] | PMS-06-03 | TRevPAR and RevPAG | PARTIAL | WS-21 | S | |
| [ ] | PMS-07-04 | Profile relationships | MISSING | WS-13 | M | |
| [ ] | PMS-07-05 | Negotiated rates on the profile | PARTIAL | WS-03 | S | |
| [ ] | PMS-07-06 | Default routing on the profile | PARTIAL | WS-13 | S | |
| [ ] | PMS-07-07 | Profile change log | PARTIAL | WS-13 | S | |
| [ ] | PMS-07-08 | Batch profile update | MISSING | WS-13 | M | |
| [ ] | PMS-08-01 | Point earn rules | PARTIAL | WS-14 | L | |
| [ ] | PMS-08-02 | Point expiry and extension | MISSING | WS-14 | M | |
| [ ] | PMS-08-03 | Enrollment at booking and check-in | MISSING | WS-14 | M | |
| [ ] | PMS-08-04 | Recognition at arrival | PARTIAL | WS-14 | S | |
| [ ] | PMS-08-05 | Member-only rates | MISSING | WS-03 | M | |
| [ ] | PMS-09-02 | Elastic vs non-elastic blocks | MISSING | WS-15 | M | |
| [ ] | PMS-09-03 | Sell limits and shoulder dates | MISSING | WS-15 | M | |
| [ ] | PMS-09-04 | Wash schedule | PARTIAL | WS-15 | S | |
| [ ] | PMS-09-05 | Block deposit and cancellation schedule | PARTIAL | WS-15 | S | |
| [ ] | PMS-09-06 | Group bulk actions | MISSING | WS-15 | M | |
| [ ] | PMS-09-07 | Booking code / access exclusion | PARTIAL | WS-15 | S | |
| [ ] | PMS-09-08 | Block notes, traces, and attachments | PARTIAL | WS-15 | S | |
| [ ] | PMS-09-09 | Block change log and production changes | PARTIAL | WS-15 | S | |
| [ ] | PMS-11-02 | Folio styles | MISSING | WS-06 | M | |
| [ ] | PMS-11-03 | Multi-language and multi-currency folios | PARTIAL | WS-06 | S | |
| [ ] | PMS-11-04 | POS interface postings | PARTIAL | WS-10 | S | |
| [ ] | PMS-11-05 | Rebates, allowances, and service recovery | PARTIAL | WS-17 | S | |
| [ ] | PMS-11-06 | Folio history and archive | PARTIAL | WS-17 | S | |
| [ ] | PMS-11-07 | Deposit ledger | PARTIAL | WS-17 | S | |
| [ ] | PMS-11-08 | Auto folio settlement | MISSING | WS-17 | M | |
| [ ] | PMS-11-09 | Currency exchange and rate management | PARTIAL | WS-17 | S | |
| [ ] | PMS-11-10 | Receipt history | PARTIAL | WS-06 | S | |
| [ ] | PMS-11-11 | Batch charges | MISSING | WS-17 | M | |
| [ ] | PMS-12-01 | Payment reversal and unapply | PARTIAL | WS-07 | S | |
| [ ] | PMS-12-02 | Credit hold | PARTIAL | WS-18 | S | |
| [ ] | PMS-12-03 | AR traces and follow-up | MISSING | WS-18 | M | |
| [ ] | PMS-12-04 | Commission holds and payment run | PARTIAL | WS-18 | S | |
| [ ] | PMS-12-05 | Accounting / ERP integration | PARTIAL | WS-10 | S | |
| [ ] | PMS-13-02 | Fixed charge and package posting | PARTIAL | WS-19 | S | |
| [ ] | PMS-13-03 | Automatic scheduled EOD | PARTIAL | WS-19 | S | |
| [ ] | PMS-13-04 | Report distribution | MISSING | WS-19 | M | |
| [ ] | PMS-14-04 | OTA connectivity | PARTIAL | WS-09 | S | |
| [ ] | PMS-14-05 | Channel-specific restrictions and sell limits | MISSING | WS-02 | M | |
| [ ] | PMS-14-06 | Duplicate detection | MISSING | WS-09 | M | |
| [ ] | PMS-14-07 | OTA virtual credit card handling | MISSING | WS-09 | M | |
| [ ] | PMS-14-08 | Channel production reporting | PARTIAL | WS-09 | S | |
| [ ] | PMS-14-09 | Content distribution | PARTIAL | WS-09 | S | |
| [ ] | PMS-14-10 | Stop-sell propagation SLA | MISSING | WS-02 | M | |
| [ ] | PMS-14-11 | Commission reconciliation per channel | PARTIAL | WS-09 | S | |
| [ ] | PMS-14-12 | Cancellation and no-show policy sync | MISSING | WS-08 | M | |
| [ ] | PMS-15-05 | EMV / P2PE terminal integration | MISSING | WS-07 | M | |
| [ ] | PMS-15-06 | 3-D Secure and SCA | MISSING | WS-07 | M | |
| [ ] | PMS-15-07 | Alternative payment methods | MISSING | WS-07 | M | |
| [ ] | PMS-15-08 | Pre-authorization strategy | PARTIAL | WS-07 | S | |
| [ ] | PMS-15-09 | Chargeback evidence packaging | PARTIAL | WS-07 | S | |
| [ ] | PMS-15-10 | Surcharge and convenience fees | MISSING | WS-07 | M | |
| [ ] | PMS-15-11 | Legal invoice numbering | PARTIAL | WS-08 | S | |
| [ ] | PMS-15-13 | Fiscalization integration | MISSING | WS-08 | XL | |
| [ ] | PMS-15-14 | e-Invoicing submission | MISSING | WS-08 | L | |
| [ ] | PMS-15-15 | Fiscal audit file export | MISSING | WS-08 | L | |
| [ ] | PMS-15-16 | Failed fiscal payload replay | MISSING | WS-08 | L | |
| [ ] | PMS-15-17 | Tax registration IDs on documents | PARTIAL | WS-06 | M | |
| [ ] | PMS-16-03 | Statistics by month and year | PARTIAL | WS-20 | S | |
| [ ] | PMS-16-04 | Scheduled report distribution | MISSING | WS-20 | M | |
| [ ] | PMS-16-05 | Custom report builder | MISSING | WS-20 | M | |
| [ ] | PMS-17-04 | Channel manager and CRS | PARTIAL | WS-09 | S | |
| [ ] | PMS-17-05 | Revenue management system | MISSING | WS-10 | M | |
| [ ] | PMS-17-06 | CRM and marketing automation | PARTIAL | WS-10 | S | |
| [ ] | PMS-17-07 | Guest messaging platforms | MISSING | WS-11 | M | |
| [ ] | PMS-17-08 | Guest Wi-Fi / captive portal | MISSING | WS-10 | M | |
| [ ] | PMS-17-09 | Reputation management | PARTIAL | WS-10 | S | |
| [ ] | PMS-17-10 | Accounting / ERP | PARTIAL | WS-10 | S | |
| [ ] | PMS-17-11 | Identity verification | MISSING | WS-10 | M | |
| [ ] | PMS-17-12 | Sandbox environment | MISSING | WS-10 | M | |
| [ ] | PMS-17-13 | Interface health monitoring | PARTIAL | WS-10 | S | |
| [ ] | PMS-18-02 | Contactless check-out and emailed folio | PARTIAL | WS-06 | S | |
| [ ] | PMS-18-03 | In-stay messaging | MISSING | WS-11 | M | |
| [ ] | PMS-18-04 | Service request tracking | PARTIAL | WS-11 | S | |
| [ ] | PMS-18-05 | Pre-arrival upsell | PARTIAL | WS-05 | S | |
| [ ] | PMS-18-06 | Multi-language guest communications | PARTIAL | WS-11 | S | |
| [ ] | PMS-18-07 | Accessibility to WCAG 2.2 AA | PARTIAL | WS-24 | S | |
| [ ] | PMS-19-02 | Screen and field-level permissions | PARTIAL | WS-22 | S | |
| [ ] | PMS-19-03 | Data-level restrictions | PARTIAL | WS-22 | S | |
| [ ] | PMS-19-04 | Single sign-on | PARTIAL | WS-22 | S | |
| [ ] | PMS-19-05 | Template and stationery editor | PARTIAL | WS-22 | S | |
| [ ] | PMS-19-06 | Multi-language content management | PARTIAL | WS-22 | S | |
| [ ] | PMS-19-07 | Report and export scheduling | MISSING | WS-22 | M | |
| [ ] | PMS-20-01 | Cross-property availability | MISSING | WS-23 | XL | |
| [ ] | PMS-20-02 | Enterprise reporting rollups | MISSING | WS-23 | M | |
| [ ] | PMS-20-03 | Property onboarding workflow | PARTIAL | WS-23 | S | |
| [ ] | PMS-21-04 | Zero-downtime deployment | PARTIAL | WS-24 | S | |
| [ ] | PMS-21-05 | Performance targets | PARTIAL | WS-24 | S | |
| [ ] | PMS-21-06 | Horizontal scalability | PARTIAL | WS-24 | S | |
| [ ] | PMS-21-07 | Staff UI accessibility | PARTIAL | WS-24 | S | |
| [ ] | PMS-21-08 | Rate limiting and abuse protection | PARTIAL | WS-24 | S | |
| [ ] | PMS-21-12 | Encryption key management and rotation | MISSING | WS-24 | L | |

## P2 — 112 items

| ✓ | ID | Capability | Status | WS | Effort | Notes |
|---|---|---|---|---|---|---|
| [ ] | PMS-01-26 | Scheduled room moves | MISSING | WS-04 | L | |
| [ ] | PMS-01-27 | Move reservation to another property | MISSING | WS-04 | L | |
| [ ] | PMS-01-28 | Loyalty award redemption at booking | PARTIAL | WS-05 | M | |
| [ ] | PMS-01-29 | e-Certificate / voucher redemption | MISSING | WS-05 | L | |
| [ ] | PMS-01-30 | Pro-forma folio | MISSING | WS-05 | L | |
| [ ] | PMS-01-31 | Trip composer | MISSING | WS-05 | L | |
| [ ] | PMS-01-32 | Call history and caller information | PARTIAL | WS-05 | M | |
| [ ] | PMS-02-19 | Wake-up calls | PARTIAL | WS-10 | M | |
| [ ] | PMS-02-20 | Telephone operator console | PARTIAL | WS-10 | M | |
| [ ] | PMS-02-21 | Safe deposit box tracking | MISSING | WS-04 | L | |
| [ ] | PMS-02-22 | Guest locator | MISSING | WS-11 | L | |
| [ ] | PMS-02-23 | Transportation requests | PARTIAL | WS-11 | M | |
| [ ] | PMS-02-24 | Welcome offers and amenity delivery | MISSING | WS-11 | L | |
| [ ] | PMS-02-25 | Vouchers | PARTIAL | WS-05 | M | |
| [ ] | PMS-03-10 | Floor plans and site maps | PARTIAL | WS-12 | M | |
| [ ] | PMS-03-11 | Suite component rooms | MISSING | WS-01 | L | |
| [ ] | PMS-03-12 | Room rotation | MISSING | WS-12 | L | |
| [ ] | PMS-03-13 | Room ownership | MISSING | WS-23 | L | |
| [ ] | PMS-03-14 | Alternate property availability | MISSING | WS-23 | L | |
| [ ] | PMS-03-15 | Sellable availability by channel | MISSING | WS-02 | L | |
| [ ] | PMS-04-08 | Preventative maintenance schedules | PARTIAL | WS-12 | M | |
| [ ] | PMS-04-09 | Linen, amenity, and consumable par levels | MISSING | WS-12 | L | |
| [ ] | PMS-05-11 | Rate hierarchy and inheritance | MISSING | WS-03 | L | |
| [ ] | PMS-05-12 | Rate parity monitoring | PARTIAL | WS-03 | M | |
| [ ] | PMS-06-04 | Unconstrained demand | PARTIAL | WS-21 | M | |
| [ ] | PMS-06-05 | Length-of-stay optimization | MISSING | WS-21 | L | |
| [ ] | PMS-06-06 | Automated yield triggers | PARTIAL | WS-21 | M | |
| [ ] | PMS-06-07 | GOPPAR and departmental profitability | PARTIAL | WS-21 | M | |
| [ ] | PMS-06-08 | What-if pricing simulation | PARTIAL | WS-21 | M | |
| [ ] | PMS-07-09 | Profile anonymization / de-identification | PARTIAL | WS-13 | M | |
| [ ] | PMS-07-10 | External CRM lookup and download | MISSING | WS-11 | L | |
| [ ] | PMS-07-11 | Commission setup on the profile | PARTIAL | WS-13 | M | |
| [ ] | PMS-07-12 | AR account linked to the profile | PARTIAL | WS-13 | M | |
| [ ] | PMS-07-13 | Guest photo | MISSING | WS-13 | L | |
| [ ] | PMS-07-14 | Sales account management | MISSING | WS-13 | L | |
| [ ] | PMS-08-06 | Certificates and vouchers | PARTIAL | WS-14 | M | |
| [ ] | PMS-08-07 | Automatic member discounting | MISSING | WS-14 | L | |
| [ ] | PMS-08-08 | Missing-stay claims | MISSING | WS-14 | L | |
| [ ] | PMS-08-09 | Suspended and unmatched stays | MISSING | WS-14 | L | |
| [ ] | PMS-08-10 | External loyalty integration | MISSING | WS-14 | L | |
| [ ] | PMS-08-11 | Partner earn and exchange rates | MISSING | WS-14 | L | |
| [ ] | PMS-08-12 | Points liability reporting | PARTIAL | WS-14 | M | |
| [ ] | PMS-09-10 | Master and sub blocks | MISSING | WS-15 | L | |
| [ ] | PMS-09-11 | Master and sub allocations | PARTIAL | WS-15 | M | |
| [ ] | PMS-09-12 | Tour series | MISSING | WS-15 | L | |
| [ ] | PMS-09-13 | Group rooms control | MISSING | WS-15 | L | |
| [ ] | PMS-09-14 | Block date shift and exchange | MISSING | WS-15 | L | |
| [ ] | PMS-09-15 | Opportunities and leads | MISSING | WS-15 | L | |
| [ ] | PMS-10-01 | Alternate space events | MISSING | WS-16 | L | |
| [ ] | PMS-10-02 | Sub events | MISSING | WS-16 | L | |
| [ ] | PMS-10-03 | Event templates and quick events | MISSING | WS-16 | L | |
| [ ] | PMS-10-04 | Menus and menu items | PARTIAL | WS-16 | M | |
| [ ] | PMS-10-05 | Beverage and catering packages | PARTIAL | WS-16 | M | |
| [ ] | PMS-10-06 | Event resources | MISSING | WS-16 | L | |
| [ ] | PMS-10-07 | Event revenue forecast and actuals | PARTIAL | WS-16 | M | |
| [ ] | PMS-10-08 | Copy and move events | MISSING | WS-16 | L | |
| [ ] | PMS-10-09 | Sales allowances | MISSING | WS-16 | L | |
| [ ] | PMS-10-10 | Event waitlist | MISSING | WS-16 | L | |
| [ ] | PMS-10-11 | Catering revenue recalculation | MISSING | WS-16 | L | |
| [ ] | PMS-11-12 | Gift and prepaid cards | MISSING | WS-17 | L | |
| [ ] | PMS-11-13 | Internal charge numbers | MISSING | WS-17 | L | |
| [ ] | PMS-11-14 | Pro-forma and advance billing | MISSING | WS-06 | L | |
| [ ] | PMS-11-15 | Daily covers adjustment | MISSING | WS-01 | L | |
| [ ] | PMS-12-06 | Invoice compression and decompression | MISSING | WS-06 | L | |
| [ ] | PMS-12-07 | AR credit card transfer | MISSING | WS-18 | L | |
| [ ] | PMS-12-08 | Owner statements and rental pool | MISSING | WS-18 | L | |
| [ ] | PMS-13-05 | Income audit | MISSING | WS-19 | L | |
| [ ] | PMS-13-06 | Multi-property staged rollover | MISSING | WS-19 | L | |
| [ ] | PMS-14-13 | GDS connectivity | PARTIAL | WS-09 | M | |
| [ ] | PMS-14-14 | Metasearch | PARTIAL | WS-09 | M | |
| [ ] | PMS-14-15 | Wholesale and bedbank contracts | MISSING | WS-09 | L | |
| [ ] | PMS-14-16 | Corporate booking tools / TMC | MISSING | WS-09 | L | |
| [ ] | PMS-14-17 | Central reservation system | MISSING | WS-23 | L | |
| [ ] | PMS-15-12 | Multi-acquirer / gateway abstraction | PARTIAL | WS-07 | M | |
| [ ] | PMS-16-06 | USALI-aligned statements | PARTIAL | WS-20 | M | |
| [ ] | PMS-16-07 | Data warehouse / BI feed | MISSING | WS-20 | L | |
| [ ] | PMS-16-08 | Ad-hoc query and custom views | MISSING | WS-20 | L | |
| [ ] | PMS-16-09 | Benchmarking feed | MISSING | WS-20 | L | |
| [ ] | PMS-16-10 | Embedded analytics | MISSING | WS-20 | L | |
| [ ] | PMS-17-14 | PBX and call accounting | PARTIAL | WS-10 | M | |
| [ ] | PMS-17-15 | Spa, golf, and activity systems | PARTIAL | WS-10 | M | |
| [ ] | PMS-17-16 | In-room technology | PARTIAL | WS-10 | M | |
| [ ] | PMS-17-17 | Minibar systems | PARTIAL | WS-10 | M | |
| [ ] | PMS-17-18 | Parking and valet | MISSING | WS-10 | L | |
| [ ] | PMS-17-19 | Procurement and materials control | MISSING | WS-10 | L | |
| [ ] | PMS-17-20 | Labour management and payroll | MISSING | WS-10 | L | |
| [ ] | PMS-17-21 | HTNG / OTA XML message support | MISSING | WS-09 | L | |
| [ ] | PMS-17-22 | Partner certification programme | MISSING | WS-10 | L | |
| [ ] | PMS-18-08 | Mobile key | PARTIAL | WS-10 | M | |
| [ ] | PMS-18-09 | Kiosk check-in | MISSING | WS-06 | L | |
| [ ] | PMS-18-10 | Attribute-based selling | MISSING | WS-03 | L | |
| [ ] | PMS-18-11 | Digital compendium | MISSING | WS-11 | L | |
| [ ] | PMS-18-12 | In-room and F&B ordering | MISSING | WS-11 | L | |
| [ ] | PMS-18-13 | Digital tipping | MISSING | WS-11 | L | |
| [ ] | PMS-19-08 | Configuration migration | MISSING | WS-22 | L | |
| [ ] | PMS-19-09 | Training / sandbox property | MISSING | WS-22 | L | |
| [ ] | PMS-20-04 | Central reservation office | MISSING | WS-23 | L | |
| [ ] | PMS-20-05 | Central profiles | MISSING | WS-23 | L | |
| [ ] | PMS-20-06 | Central rate management | MISSING | WS-23 | L | |
| [ ] | PMS-20-07 | Central loyalty | MISSING | WS-23 | L | |
| [ ] | PMS-20-08 | Central sales and lead sending | MISSING | WS-23 | L | |
| [ ] | PMS-20-09 | Cross-property posting and routing | MISSING | WS-23 | L | |
| [ ] | PMS-20-10 | Cross-property itinerary | MISSING | WS-23 | L | |
| [ ] | PMS-20-11 | Brand standards governance | MISSING | WS-23 | L | |
| [ ] | PMS-20-12 | Franchise and management fee calculation | MISSING | WS-23 | L | |
| [ ] | PMS-20-13 | Mixed-use support | MISSING | WS-23 | L | |
| [ ] | PMS-20-14 | Vacation ownership | MISSING | WS-23 | L | |
| [ ] | PMS-20-15 | Data residency per region | MISSING | WS-23 | L | |
| [ ] | PMS-21-09 | Degraded-mode front desk operation | MISSING | WS-24 | L | |
| [ ] | PMS-21-10 | Availability SLA and DR | PARTIAL | WS-24 | M | |
| [ ] | PMS-21-11 | Regional deployment topology | MISSING | WS-24 | L | |
| [ ] | PMS-21-13 | API SDKs and developer portal | PARTIAL | WS-24 | M | |

