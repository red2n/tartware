# Offers in a Property Management System (PMS)

### Industry Reference — Offer Types Valid in the United States and Canada, and Their Implementation Logic

> **Scope:** Hotel, resort, and casino-hotel lodging operations in the US and Canada.
> **Audience:** PMS product managers, solution architects, revenue managers, and engineers implementing offer/promotion/comp functionality.
> **Nature:** Vendor-neutral industry reference. Terminology follows common usage across Oracle OPERA, Amadeus, Sabre SynXis, HTNG and OTA/OpenTravel specifications.
> **Date:** 2026-09-01

---

## Table of Contents

1. [Definition and Scope of "Offer"](#1-definition-and-scope-of-offer)
2. [Glossary](#2-glossary)
3. [Master List of Valid Offer Types (US & Canada)](#3-master-list-of-valid-offer-types-us--canada)
   - 3.1 [Category A — Rate-Reducing Offers](#31-category-a--rate-reducing-offers)
   - 3.2 [Category B — Value-Add / Inclusion Offers](#32-category-b--value-add--inclusion-offers)
   - 3.3 [Category C — Loyalty, Membership & Affinity Offers](#33-category-c--loyalty-membership--affinity-offers)
   - 3.4 [Category D — Casino / Gaming Comp Offers](#34-category-d--casino--gaming-comp-offers)
   - 3.5 [Category E — Contracted & Group Offers](#35-category-e--contracted--group-offers)
   - 3.6 [Category F — Distribution & Channel Offers](#36-category-f--distribution--channel-offers)
   - 3.7 [Category G — Operational & Service-Recovery Offers](#37-category-g--operational--service-recovery-offers)
4. [Standard Offer Attribute Model](#4-standard-offer-attribute-model)
5. [Standard Qualification and Restriction Rules](#5-standard-qualification-and-restriction-rules)
6. [How an Offer Applies to a PMS Reservation](#6-how-an-offer-applies-to-a-pms-reservation)
7. [Implementation Logic — Core Algorithms](#7-implementation-logic--core-algorithms)
8. [Implementation Logic — Folio, Ledger and Posting](#8-implementation-logic--folio-ledger-and-posting)
9. [Tax Treatment — United States](#9-tax-treatment--united-states)
10. [Tax Treatment — Canada](#10-tax-treatment--canada)
11. [Price-Display and Advertising Rules](#11-price-display-and-advertising-rules)
12. [Gaming, Privacy and Marketing Compliance](#12-gaming-privacy-and-marketing-compliance)
13. [Reference Data Model](#13-reference-data-model)
14. [Reporting and Audit Requirements](#14-reporting-and-audit-requirements)
15. [Implementation Checklist](#15-implementation-checklist)
16. [Standards and Sources](#16-standards-and-sources)

---

## 1. Definition and Scope of "Offer"

An **Offer** is any configured construct that alters what a guest pays, or what a guest receives, relative to the standard published rate for a room-night.

An offer is *not* a rate. A rate answers "what does this room cost on this date". An offer answers "under what conditions, and by how much, does that cost or entitlement change".

Every offer in a PMS resolves to exactly one of four economic behaviours:

| Behaviour | Effect on room revenue | Effect on entitlement | Who funds it |
|---|---|---|---|
| **Discount** | Reduces net accommodation revenue | None | Property marketing budget |
| **Inclusion (package)** | Neutral — revenue is redistributed across transaction codes | Adds goods/services | Guest, pre-paid inside the rate |
| **Allowance** | Neutral — caps consumption, settled through a package ledger | Adds a spending credit | Property, via package ledger |
| **Comp** | Charge is routed away from the guest ledger | May add entitlement | Casino/marketing department, or the property |

**All four behaviours are legal and standard in both the United States and Canada.** Jurisdictional differences apply almost entirely to *tax treatment*, *price display*, and *reporting* — not to whether the offer type is permitted.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Rate code / rate plan** | The named pricing structure a reservation is booked on |
| **Promotion code** | A tracked marketing campaign identifier linked to one or more rate codes |
| **Coupon code** | A single-use or limited-use token generated from a promotion |
| **Package element / package code** | A good or service attached to a rate or reservation with its own price, posting rhythm and transaction code |
| **Allowance** | A per-night or per-stay consumption limit backed by a package ledger |
| **Comp** | A complimentary or discounted charge routed off the guest ledger, common in casino-hotels |
| **Comp authorizer** | The person or role permitted to grant comps, with configured dollar limits |
| **Routing instruction** | Configuration that moves a charge from the guest billing window to another window or account |
| **Billing window / folio window** | A sub-account of a reservation folio; typically windows 1–8 for guest, 101+ for comp |
| **Package ledger** | A balancing ledger that absorbs allowance credits, profit and loss |
| **Package wrapper** | A non-revenue transaction code used to post a package rate to the guest ledger before decomposition |
| **Posting rhythm** | The schedule on which a package element posts (every night, arrival night, last night, every Nth night, etc.) |
| **LOS** | Length of stay, in nights |
| **Advance purchase** | Days between booking date and arrival date |
| **Blackout** | Dates or weekdays on which an offer does not apply |
| **Stacking** | Applying more than one offer to the same reservation or room-night |
| **Yieldable offer** | An offer whose availability is controlled by revenue management |
| **Reinvestment** | The share of a player's theoretical gaming value returned as comps and offers |

---

## 3. Master List of Valid Offer Types (US & Canada)

Each entry states: what it is, how it is expressed, and any US/Canada notes. **All are valid in both countries unless a note says otherwise.**

### 3.1 Category A — Rate-Reducing Offers

| # | Offer type | Description | Typical configuration |
|---|---|---|---|
| A1 | **Percentage discount** | X% off the room rate | Percentage value; applied per night or per stay |
| A2 | **Flat-amount discount** | Fixed currency amount off | Amount per night or per stay; must be clamped so it cannot exceed the rate |
| A3 | **Fixed promotional rate** | Rate overridden to a set amount | Discrete rate code with its own pricing schedule |
| A4 | **Best Available Rate (BAR) derivative** | Rate expressed as BAR minus X% or minus $Y | Derived/linked rate code |
| A5 | **Advance-purchase offer** | Discount for booking ≥ N days ahead | `minAdvancePurchase`; often non-refundable |
| A6 | **Last-minute / distressed-inventory offer** | Discount for booking ≤ N days ahead | `maxAdvancePurchase`; yield-controlled |
| A7 | **Length-of-stay (LOS) offer** | Discount when LOS falls in a range | `minLOS` / `maxLOS` |
| A8 | **Buy N / Get M (free-night) offer** | "Stay 3, get the 4th free" | Buy-nights, get-nights, and a free-night selection rule |
| A9 | **Nth-night-free offer** | Specific ordinal night is free | Posting rhythm targeting night N |
| A10 | **Day-of-week offer** | Applies only to certain arrival or stay days | Arrival-day mask; stay-day mask |
| A11 | **Seasonal / date-range offer** | Valid only within stay dates | Stay start/end window |
| A12 | **Booking-window offer** | Sellable only within booking dates | Booking start/end window |
| A13 | **Early-bird offer** | Combination of booking window and advance purchase | Both windows configured |
| A14 | **Non-refundable / prepaid offer** | Discount in exchange for a strict cancellation policy | Discount + deposit/cancellation policy binding |
| A15 | **Opaque / unpublished rate** | Discounted rate where the brand is concealed until booking | Restricted rate code, channel-limited |
| A16 | **Coupon-code offer** | Discount unlocked by a single-use or limited-use code | Coupon pool generated from a promotion |
| A17 | **Free room upgrade** | Higher room type sold at a lower room type's rate | Upgrade flag with room-type mapping |
| A18 | **Third-/fourth-person free** | Extra-person charges waived | Occupancy pricing override |
| A19 | **Kids-stay-free offer** | Children not charged as extra persons | Child-bucket pricing rule |
| A20 | **Multi-room / block discount** | Discount when booking ≥ N rooms | Quantity qualifier |
| A21 | **Consecutive-nights escalator** | Discount deepens with each additional night | Tiered LOS pricing schedule |

### 3.2 Category B — Value-Add / Inclusion Offers

| # | Offer type | Description | Typical configuration |
|---|---|---|---|
| B1 | **Inclusive package** | Rate includes goods/services; no separate folio line | Posting type *Included in Rate*; item price deducted from accommodation revenue |
| B2 | **Add-to-rate, separate line** | Add-on posts as its own folio line | Posting type *Add to Rate — Separate Line* |
| B3 | **Add-to-rate, combined line** | Add-on folded into the room charge line | Posting type *Add to Rate — Combined Line* |
| B4 | **Breakfast-included offer** | Most common inclusion in North America | Package element, per adult / per person |
| B5 | **Parking-included offer** | Self or valet parking bundled | Package element, per room per night |
| B6 | **Resort-credit / property-credit offer** | Spendable credit, e.g. "$100 resort credit" | Allowance, per stay or per night |
| B7 | **Daily F&B allowance** | "$50 food & beverage per night" | Allowance with alternate outlet transaction codes |
| B8 | **Spa / golf / attraction credit** | Credit usable in a specific revenue centre | Allowance restricted to one transaction code group |
| B9 | **Ticket / event package** | Room plus event or attraction tickets | Ticketing package element, often inventory-controlled |
| B10 | **Amenity package** | Champagne, flowers, turndown, in-room gift | Package element, flat amount |
| B11 | **Waived resort fee / destination fee offer** | Mandatory fee suppressed for qualifying stays | Fee suppression rule on the rate or offer |
| B12 | **Waived pet fee / waived early-departure fee** | Specific fee suppressed | Fee suppression rule |
| B13 | **Late-checkout / early-check-in offer** | Time entitlement without charge | Reservation attribute, optionally inventory-checked |
| B14 | **Wi-Fi / premium internet included** | Service inclusion | Package element, often zero-price with a service flag |
| B15 | **Airport transfer included** | Transport inclusion | Package element with alternate outlet |
| B16 | **All-inclusive plan** | Room, meals, beverages and activities in one rate | Multiple package elements with a package wrapper |

### 3.3 Category C — Loyalty, Membership & Affinity Offers

| # | Offer type | Description | Typical configuration |
|---|---|---|---|
| C1 | **Member rate** | Discount for enrolled loyalty members | Rate code restricted by membership type |
| C2 | **Tier-based offer** | Benefit varies by elite tier | Membership tier qualifier |
| C3 | **Points redemption (award) stay** | Room paid with loyalty points | Award package with a points price; zero cash revenue |
| C4 | **Points + cash offer** | Split payment between points and currency | Award package plus a cash rate component |
| C5 | **Points-earning bonus offer** | Bonus accrual, no price change | Accrual multiplier attached to the rate |
| C6 | **Membership promotion** | Promotion scoped to a membership program | Promotion group of type *Profile/Membership* |
| C7 | **Corporate / employee-affinity offer** | Discount for a named employer or association | Negotiated rate code tied to a company profile |
| C8 | **Government / military rate** | US GSA per-diem or Canadian federal/provincial rate | Rate code with ID-verification requirement |
| C9 | **Senior / AAA / CAA rate** | Discount tied to a verifiable affiliation | Rate code with membership verification |
| C10 | **Friends-and-family / industry rate** | Restricted-eligibility discount | Restricted rate code with authorisation |
| C11 | **Referral / advocacy offer** | Credit for referring a guest | Coupon or account credit |
| C12 | **Anniversary / birthday offer** | Personalised, profile-triggered | Coupon issued from CRM |

> **Note (Canada):** loyalty points and award stays are generally treated as a form of consideration for GST/HST purposes when redeemed; the redemption mechanics affect tax base. Confirm treatment with tax counsel.

### 3.4 Category D — Casino / Gaming Comp Offers

Legal and pervasive in US commercial and tribal gaming jurisdictions, and in Canadian provincial gaming venues. Availability of specific mechanics is governed by the relevant gaming regulator.

| # | Offer type | Description | Typical configuration |
|---|---|---|---|
| D1 | **Full room comp (RFB / RLFB)** | Room, food and beverage complimentary | Comp routing to a comp window with an authorizer |
| D2 | **Partial room comp** | Percentage or amount of the room comped | Comp routing with a percentage or amount split |
| D3 | **Casino rate** | Discounted room rate offered to rated players | Restricted rate code requiring a player ID |
| D4 | **Marketed offer / direct-mail offer** | Campaign offer sent to a player segment | Offer code sourced from the casino management system (CMS) |
| D5 | **Comp voucher** | Physical or digital voucher redeemed for a stay | Voucher identifiers validated against the CMS |
| D6 | **Awarded offer** | Offer generated from a player award or tier benefit | Award identifiers carried on the offer |
| D7 | **Free-play-linked room offer** | Room offer bundled with slot free play | Offer plus a free-play credit issued by the CMS |
| D8 | **Host / discretionary comp** | Granted ad hoc by a casino host or executive | Authorizer with a discretionary limit; audit-logged |
| D9 | **Player self-redeem offer** | Player redeems their own offer at booking or kiosk | Self-service redemption path against the CMS |
| D10 | **Tournament / event invitation offer** | Room offer attached to an invited event | Event-scoped offer with a fixed date block |
| D11 | **Reinvestment-tier offer** | Offer value derived from theoretical win | Offer value computed by the CMS, consumed by the PMS |
| D12 | **Comp with exclusions** | Comp valid on some charges only | Excluded transaction items list |
| D13 | **Comp with limits** | Comp capped per day, per stay, or both | Comp limit type with per-day and per-stay balances |

### 3.5 Category E — Contracted & Group Offers

| # | Offer type | Description | Typical configuration |
|---|---|---|---|
| E1 | **Negotiated corporate rate** | Contracted annual rate for a company | Company profile linked to a rate code |
| E2 | **Consortia rate** | Rate for a travel-agency consortium | Consortium code and rate access rules |
| E3 | **Wholesale / tour-operator rate** | Net rate sold as part of a package | Net rate code, channel-restricted |
| E4 | **Group block rate** | Rate for a contracted room block | Block code with pickup tracking |
| E5 | **Group concession** | Comp room ratio, e.g. 1 comp per 40 room-nights | Comp-room calculation on the block |
| E6 | **Group add-on / group package** | Meals, meeting space, AV bundled with the block | Package elements attached to the block |
| E7 | **Crew / airline contract rate** | Contracted rate for flight crews | Restricted rate code with allotment |
| E8 | **Long-stay / extended-stay rate** | Weekly or monthly rate | LOS-tiered rate code; may change tax status (see §9.3, §10.3) |
| E9 | **Rooming-list rate** | Rate applied by bulk import of guests | Block-derived rate assignment |

### 3.6 Category F — Distribution & Channel Offers

| # | Offer type | Description | Typical configuration |
|---|---|---|---|
| F1 | **OTA-exclusive promotion** | Offer visible only on a named OTA | Channel-restricted rate/offer mapping |
| F2 | **Brand.com / direct-booking offer** | Discount exclusive to the direct channel | Channel restriction plus rate parity handling |
| F3 | **Mobile-app-only offer** | Discount exclusive to the mobile channel | Channel restriction |
| F4 | **GDS-only negotiated rate** | Rate distributed only through the GDS | Channel restriction and access code |
| F5 | **Metasearch / campaign offer** | Offer surfaced through a metasearch campaign | Campaign-tagged rate |
| F6 | **Flash-sale / limited-inventory offer** | Time-boxed, capacity-capped discount | Sell window plus inventory cap |
| F7 | **Stackable channel offer** | Two or more offers combined in one quote | Compatibility list plus an application order |
| F8 | **Yield-controlled offer** | Availability driven by revenue-management signals | Offer flagged yieldable; RMS controls open/close |

### 3.7 Category G — Operational & Service-Recovery Offers

| # | Offer type | Description | Typical configuration |
|---|---|---|---|
| G1 | **Walk / relocation compensation** | Compensation when a guest is walked to another property | Rate adjustment plus expense posting; audit-logged |
| G2 | **Service-recovery discount** | Goodwill discount after a service failure | Adjustment or allowance with a reason code |
| G3 | **Rate override** | Manual rate change by an authorised user | Permission-gated override with a reason code |
| G4 | **Complimentary house use** | Room used for hotel purposes, no revenue | House-use status; excluded from occupancy statistics |
| G5 | **Out-of-order compensation** | Compensation for a room-quality issue | Adjustment with reason code |
| G6 | **Loyalty goodwill points** | Points issued instead of a discount | Accrual adjustment |

---

## 4. Standard Offer Attribute Model

The following attribute set is common across major PMS platforms and is sufficient to express every offer type in §3.

### 4.1 Identity and classification

| Attribute | Type | Notes |
|---|---|---|
| `offerCode` | String | Immutable after creation; typically 1–20 alphanumeric |
| `offerName` | String | Operational display name |
| `description` | String | Guest-facing text |
| `longDescription` | String | Extended marketing copy |
| `agentInstructions` | String | Text shown to reservation agents |
| `offerCategory` | Enum/String | Marketing classification |
| `offerGroup` | String | Promotion group (reservation, profile/membership, block) |
| `offerType` | Enum | One of the types in §3 |
| `active` | Boolean | Enable/disable without deletion |
| `scope` | Enum | Global / chain / property |
| `currency` | ISO 4217 | Required for any monetary attribute |
| `localizedDescriptions` | Map<locale, text> | Required for Quebec (see §11.4) |

### 4.2 Economics

| Attribute | Type | Notes |
|---|---|---|
| `discountType` | Enum | `PERCENT`, `AMOUNT`, `FIXED_RATE`, `FREE_NIGHT`, `NONE` |
| `discountValue` | Decimal | Interpreted per `discountType` |
| `applicationBasis` | Enum | `PER_NIGHT`, `PER_STAY`, `PER_PERSON`, `PER_ROOM` |
| `appliesToItems` | Set<transactionCode> | Which charges the offer touches |
| `excludedItems` | Set<transactionCode> | Charges the offer must never touch |
| `maxDiscountAmount` | Decimal | Clamp for `AMOUNT` discounts |
| `buyNights` / `getNights` | Integer | For Buy N / Get M offers |
| `freeNightSelection` | Enum | `LAST_NIGHT`, `LOWEST_PRICE`, `HIGHEST_PRICE`, `FIRST_NIGHT` |
| `maxNightsCovered` | Integer | Hard cap on discounted or comped nights |
| `pointsPrice` | Integer | For award redemption offers |
| `allowanceAmount` | Decimal | For allowance offers; must be ≥ item price |
| `overageTransactionCode` | String | Where consumption above the allowance posts |

### 4.3 Qualification (see §5 for evaluation logic)

`bookingWindowStart`, `bookingWindowEnd`, `stayWindowStart`, `stayWindowEnd`, `latestArrivalDate`, `minAdvancePurchase`, `maxAdvancePurchase`, `minLOS`, `maxLOS`, `arrivalDaysOfWeek`, `stayDaysOfWeek`, `blackoutDateRanges`, `minOccupancy`, `maxOccupancy`, `minRooms`, `eligibleRoomTypes`, `eligibleRateCodes`, `eligibleChannels`, `eligibleMarketSegments`, `eligibleMembershipTypes`, `eligibleCountries`, `requiresCouponCode`, `requiresPlayerId`, `requiresIdVerification`.

### 4.4 Control and governance

| Attribute | Type | Notes |
|---|---|---|
| `limitedUse` | Boolean | Backed by a coupon pool |
| `totalRedemptionLimit` | Integer | Global cap |
| `perGuestRedemptionLimit` | Integer | Per-profile cap |
| `authorizerId` | String | Required for comps |
| `authorizerLimitType` | Enum | `PER_DAY`, `PER_STAY`, `PER_DAY_AND_PER_STAY` |
| `authorizedAmount` | Decimal | Budget ceiling |
| `stackable` | Boolean | May combine with other offers |
| `compatibleOfferCodes` | Set<String> | Explicit compatibility list |
| `applicationOrder` | Integer | Deterministic ordering when stacking |
| `yieldable` | Boolean | Revenue-management controlled |
| `reasonCodeRequired` | Boolean | For overrides and discretionary comps |

---

## 5. Standard Qualification and Restriction Rules

Restrictions divide into three evaluation scopes. Implementations must be explicit about which scope each rule belongs to, because evaluating a stay-level rule per night (or vice versa) is the most common source of offer defects.

| Scope | Evaluated once per | Rules in this scope |
|---|---|---|
| **Booking scope** | Quote / booking attempt | Booking window, coupon validity, redemption limits, channel, market segment, membership, player ID, room count |
| **Stay scope** | Reservation | Advance purchase, LOS, latest arrival date, arrival day-of-week, occupancy, room type |
| **Night scope** | Each stay night | Stay window, blackout dates, blackout weekdays, posting rhythm, per-day comp limits |

### 5.1 Canonical qualification order

```
1.  Offer is active, and today ∈ [bookingWindowStart, bookingWindowEnd]
2.  Channel, market segment, membership, company, and player eligibility satisfied
3.  Coupon code valid, unredeemed, and within redemption limits
4.  Room count ≥ minRooms
5.  Arrival day-of-week ∈ arrivalDaysOfWeek
6.  advancePurchaseDays = arrivalDate − bookingDate;  minAP ≤ advancePurchaseDays ≤ maxAP
7.  arrivalDate ≤ latestArrivalDate
8.  lengthOfStay = departureDate − arrivalDate;  minLOS ≤ lengthOfStay ≤ maxLOS
9.  Occupancy within [minOccupancy, maxOccupancy]
10. Room type ∈ eligibleRoomTypes;  rate code ∈ eligibleRateCodes
11. Per night N:
      N ∈ [stayWindowStart, stayWindowEnd]
      N ∉ blackoutDateRanges
      dayOfWeek(N) ∉ blackoutDaysOfWeek
      posting rhythm includes N
12. Inventory / allotment available for the offer
```

### 5.2 Partial vs all-or-nothing qualification

Two industry-standard behaviours exist and the choice must be an explicit configuration:

- **All-or-nothing:** if any stay night fails a night-scope rule, the whole offer is rejected. Typical for packaged and contracted offers.
- **Partial application:** failing nights are dropped and the offer applies to the remainder. Typical for casino comps and free-night promotions.

### 5.3 Sentinel and null conventions

- A null or absent restriction means **unrestricted**, never zero.
- Numeric restrictions should be stored as integers, not strings, to avoid parse failures inside the pricing path.
- `0` and `-1` should not be overloaded to mean "not configured"; use null.

---

## 6. How an Offer Applies to a PMS Reservation

```
 CONFIGURE          SHOP / QUOTE            BOOK                 STAY                 SETTLE
┌──────────┐   ┌──────────────────┐   ┌───────────────┐   ┌──────────────┐   ┌────────────────┐
│ Offer    │   │ Availability +   │   │ Offer frozen  │   │ Nightly      │   │ Redemption     │
│ defined, │──►│ rate query;      │──►│ onto the      │──►│ posting at   │──►│ finalised;     │
│ linked   │   │ qualification    │   │ reservation   │   │ night audit  │   │ ledgers        │
│ to rates │   │ + pricing        │   │ as a snapshot │   │              │   │ balanced       │
└──────────┘   └──────────────────┘   └───────────────┘   └──────────────┘   └────────────────┘
                                             │                                       │
                                       inventory/coupon                        release on
                                       decremented; hold                       cancel / no-show
```

### 6.1 Lifecycle touchpoints

| Reservation event | Required offer behaviour |
|---|---|
| **Quote / availability search** | Evaluate qualification; return per-night offer amounts; never persist |
| **Create** | Freeze the offer into an immutable **offer snapshot** on the reservation: offer code, covered dates, amounts, authorizer, routing, coupon/voucher IDs. Decrement coupon and inventory. |
| **Modify — dates** | Re-qualify. If the new stay fails a stay-scope rule, either drop the offer or re-price; never silently keep stale amounts. |
| **Modify — room type / occupancy** | Re-qualify against room-type and occupancy rules; re-price package elements with per-person calculation rules. |
| **Modify — rate code** | Re-validate that the offer is linked to the new rate code. |
| **Share / split reservation** | Decide and document whether the offer applies per sharer or once per room. |
| **Check-in** | Materialise routing instructions; bind authorizer budget; begin allowance windows. |
| **Night audit** | Post recurring charges; apply discounts/comps; post allowance credits and package profit/loss; roll per-day comp balances. |
| **Early departure** | Recompute LOS-dependent offers; a shortened stay may retroactively invalidate a min-LOS offer. Define whether the discount is clawed back. |
| **Extension** | Re-evaluate `maxNightsCovered` and per-stay limits before extending the offer. |
| **Check-out** | Finalise offer totals; mark redeemed; emit redemption to the source system. |
| **Cancel / no-show** | Release coupon and inventory; reverse any pre-posted comp; return casino offers to the player's bucket. |
| **Reinstate** | Re-acquire the offer only if it is still valid; do not resurrect an expired offer. |

### 6.2 The offer snapshot

The snapshot is the contract of record and must contain at minimum:

```
offerCode, offerVersion, appliedDates[], discountType, discountValue,
perNightAmounts{date → amount}, applicableBase{date → amount},
routingTemplateId, authorizerId, couponCode, voucherIds[],
playerId, sourceSystemTransactionId, redeemed, capturedAt, capturedBy
```

Rationale: offers are configuration, and configuration changes. Without a snapshot, a mid-stay configuration edit silently repriced historical nights.

---

## 7. Implementation Logic — Core Algorithms

### F-1 — Stay-scope qualification

```
FUNCTION qualifiesForStay(offer, reservation, businessDate) → Boolean

  IF NOT offer.active                                 RETURN false
  IF businessDate  < offer.bookingWindowStart         RETURN false
  IF businessDate  > offer.bookingWindowEnd           RETURN false

  advancePurchaseDays = daysBetween(businessDate, reservation.arrivalDate)
  IF offer.minAdvancePurchase != NULL
     AND advancePurchaseDays < offer.minAdvancePurchase   RETURN false
  IF offer.maxAdvancePurchase != NULL
     AND advancePurchaseDays > offer.maxAdvancePurchase   RETURN false

  IF offer.latestArrivalDate != NULL
     AND reservation.arrivalDate > offer.latestArrivalDate RETURN false

  IF offer.arrivalDaysOfWeek NOT EMPTY
     AND dayOfWeek(reservation.arrivalDate) ∉ offer.arrivalDaysOfWeek  RETURN false

  los = daysBetween(reservation.arrivalDate, reservation.departureDate)
  IF offer.minLOS != NULL AND los < offer.minLOS      RETURN false
  IF offer.maxLOS != NULL AND los > offer.maxLOS      RETURN false

  occupancy = reservation.adults + reservation.children
  IF offer.minOccupancy != NULL AND occupancy < offer.minOccupancy  RETURN false
  IF offer.maxOccupancy != NULL AND occupancy > offer.maxOccupancy  RETURN false

  IF offer.eligibleRoomTypes NOT EMPTY
     AND reservation.roomType ∉ offer.eligibleRoomTypes  RETURN false
  IF offer.eligibleRateCodes NOT EMPTY
     AND reservation.rateCode ∉ offer.eligibleRateCodes  RETURN false
  IF offer.eligibleChannels NOT EMPTY
     AND reservation.channel ∉ offer.eligibleChannels    RETURN false

  RETURN true
```

### F-2 — Night-scope qualification

```
FUNCTION qualifyingNights(offer, reservation) → List<Date>

  nights = []
  FOR date FROM reservation.arrivalDate TO reservation.departureDate − 1:

      IF offer.stayWindowStart != NULL AND date < offer.stayWindowStart   CONTINUE
      IF offer.stayWindowEnd   != NULL AND date > offer.stayWindowEnd     CONTINUE
      IF dayOfWeek(date) ∈ offer.blackoutDaysOfWeek                       CONTINUE
      IF ANY range ∈ offer.blackoutDateRanges COVERS date                 CONTINUE
      IF NOT postingRhythmIncludes(offer.postingRhythm, reservation, date) CONTINUE

      nights.append(date)

  IF offer.allOrNothing AND size(nights) < stayLength(reservation):
      RETURN []                       # reject entirely

  RETURN nights
```

> A blackout range with only a start date means "from that date onward"; with only an end date, "up to and including that date". Define and document the open-ended semantics explicitly.

### F-3 — Applying `maxNightsCovered`

```
FUNCTION capNights(nights, offer) → List<Date>

  IF offer.maxNightsCovered == NULL:  RETURN nights

  SWITCH offer.nightSelectionPolicy:
      CASE CHRONOLOGICAL:   RETURN nights.sortByDate().take(maxNightsCovered)
      CASE HIGHEST_VALUE:   RETURN nights.sortByRateDesc().take(maxNightsCovered)
      CASE LOWEST_VALUE:    RETURN nights.sortByRateAsc().take(maxNightsCovered)
```

`CHRONOLOGICAL` is the common default. `HIGHEST_VALUE` is the guest-favourable variant and should be used where the offer is marketed as "your N most expensive nights free".

### F-4 — Buy N / Get M free-night allocation

```
FUNCTION freeNights(offer, nightlyRates) → Set<Date>

  blockSize = offer.buyNights + offer.getNights
  IF blockSize <= 0:  RETURN {}

  free    = {}
  index   = 0
  nights  = nightlyRates.datesInStayOrder()

  WHILE index + blockSize <= size(nights):
      block = nights[index .. index + blockSize − 1]

      SWITCH offer.freeNightSelection:
          CASE LAST_NIGHT:
              free ∪= block[offer.buyNights .. blockSize − 1]
          CASE FIRST_NIGHT:
              free ∪= block[0 .. offer.getNights − 1]
          CASE LOWEST_PRICE:
              free ∪= block.sortByRateAsc().take(offer.getNights)
          CASE HIGHEST_PRICE:
              free ∪= block.sortByRateDesc().take(offer.getNights)

      index += blockSize            # blocks are non-overlapping

  RETURN free
```

Required decisions, each of which must be configuration rather than implicit behaviour:

| Decision | Options |
|---|---|
| **Partial trailing block** | Discard (strict) or pro-rate (generous) |
| **Block overlap** | Non-overlapping (standard) or sliding window |
| **Tie-breaking on equal rates** | Earliest date (standard) |
| **Accumulation across blocks** | Free nights must **accumulate** across all blocks, not be overwritten by the last block |
| **Interaction with blackouts** | Apply blackouts before block formation, or after selection |

### F-5 — Determining the discountable base

```
FUNCTION discountableBase(night, offer, charges) → Decimal

  base = 0
  FOR charge IN charges[night]:
      IF charge.transactionCode ∈ offer.excludedItems:   CONTINUE
      IF offer.appliesToItems NOT EMPTY
         AND charge.transactionCode ∉ offer.appliesToItems:  CONTINUE
      base += charge.amount

  RETURN base
```

A room-only offer must not reach resort fees, F&B, taxes, or cash advances. Excluded items take precedence over included items.

### F-6 — Discount computation

```
FUNCTION discountAmount(base, offer) → Decimal

  SWITCH offer.discountType:

      CASE PERCENT:
          raw = base × (offer.discountValue / 100)

      CASE AMOUNT:
          raw = offer.discountValue
          IF offer.applicationBasis == PER_STAY:
              raw = allocateAcrossNights(raw, qualifyingNights)   # see F-7

      CASE FIXED_RATE:
          raw = MAX(0, base − offer.discountValue)

      CASE FREE_NIGHT:
          raw = base

      CASE NONE:
          raw = 0

  # Mandatory clamps
  raw = MIN(raw, base)                                   # never exceed the base
  IF offer.maxDiscountAmount != NULL:
      raw = MIN(raw, offer.maxDiscountAmount)
  raw = MAX(raw, 0)

  RETURN round(raw, currencyScale, HALF_UP)
```

Two rules that are frequently violated in practice:

1. **Sequential percentage discounts compound.** Two 50% offers applied in sequence produce 75%, not 100%. If additive behaviour is intended, sum the percentages first, then apply once.
2. **Flat-amount discounts must be clamped to the base.** An unclamped amount produces negative room revenue and breaks the trial balance.

### F-7 — Per-stay amount allocation across nights

```
FUNCTION allocateAcrossNights(totalAmount, nights) → Map<Date, Decimal>

  n         = size(nights)
  perNight  = round(totalAmount / n, currencyScale, HALF_UP)
  allocated = {}
  running   = 0

  FOR i FROM 0 TO n − 2:
      allocated[nights[i]] = perNight
      running += perNight

  allocated[nights[n − 1]] = totalAmount − running     # remainder to the last night

  RETURN allocated
```

Allocating the rounding remainder to a single night — rather than spreading rounding error — guarantees the allocation sums exactly to the stated offer value, which is what folio and revenue reconciliation require.

### F-8 — Stacking multiple offers

```
FUNCTION applyOffers(night, offers, base) → List<AppliedOffer>

  eligible = offers.filter(o → qualifies(o, night))

  # Compatibility: an offer may only stack with offers on its compatibility list
  selected = []
  FOR o IN eligible.sortBy(o.applicationOrder, then o.offerCode):
      IF selected IS EMPTY:
          selected.append(o)
      ELIF o.stackable AND ALL(s ∈ selected → o.compatibleWith(s) AND s.compatibleWith(o)):
          selected.append(o)
      # otherwise skip

  IF selected IS EMPTY AND eligible NOT EMPTY:
      selected = [ bestSingleOffer(eligible, base) ]     # "best offer wins" fallback

  applied   = []
  remaining = base
  FOR o IN selected:
      d = discountAmount(remaining, o)                   # sequential, on the remainder
      applied.append({offer: o, amount: d, basis: remaining})
      remaining -= d

  RETURN applied
```

Design decisions to document explicitly:

- **Sequential vs parallel:** sequential applies each offer to the remainder (compounding); parallel applies every offer to the original base then sums (can exceed the base — must be clamped).
- **Best-offer-wins:** where stacking is disallowed, define the tie-break — greatest guest benefit is the safest and most defensible.
- **Determinism:** application order must be stable across repeated quotes for the same input, or quotes will not reproduce.

### F-9 — Allowance consumption and the package ledger

```
ON check-in (or nightly, per configuration):
    POST credit  allowanceAmount  → package ledger

ON charge posted against an allowance-bearing transaction code:
    IF postedAmount <= remainingAllowance:
        route postedAmount → package ledger
        remainingAllowance −= postedAmount
    ELSE:
        route remainingAllowance → package ledger
        route (postedAmount − remainingAllowance) → guest ledger via overageTransactionCode
        remainingAllowance = 0

ON night audit / check-out:
    IF remainingAllowance > 0:
        POST remainingAllowance → "package profit" revenue code (package ledger)
    IF consumedAmount > itemPrice:
        POST (consumedAmount − itemPrice) → "package loss" code (package ledger)

INVARIANT:  package ledger balance == 0 at period close
```

### F-10 — Comp authorization and limits

```
FUNCTION postComp(charge, offer, authorizer, businessDate) → (comped, overage)

  IF charge.transactionCode ∈ offer.excludedItems:
      RETURN (0, charge.amount)

  headroom = +∞
  IF authorizer.limitType IN (PER_DAY, PER_DAY_AND_PER_STAY):
      headroom = MIN(headroom, authorizer.dailyBalance[businessDate])
  IF authorizer.limitType IN (PER_STAY, PER_DAY_AND_PER_STAY):
      headroom = MIN(headroom, authorizer.stayBalance)

  comped  = MIN(charge.amount, headroom)
  overage = charge.amount − comped

  route comped  → comp billing window
  route overage → guest billing window

  decrement authorizer balances by comped
  append charge.id to authorizer.mappedTransactionItems
  write audit record {authorizer, offer, charge, comped, businessDate, reasonCode}

  RETURN (comped, overage)
```

Comps must **route** charges, not delete them. Accommodation revenue remains recognised at full value; the comp appears as a cost against the granting department. This is required for revenue reporting, for gaming-regulator reporting, and for the departmental P&L.

### F-11 — Cancellation and reversal

```
ON cancel | no-show | offer removal:

  1. Reverse pre-posted comps using the configured offset transaction code
  2. Restore authorizer daily and stay balances
  3. Release coupon (mark unredeemed) if the offer was never consumed
  4. Return the offer to the source system (casino CMS, loyalty engine, campaign engine)
  5. Restore offer inventory / allotment
  6. Retain the offer snapshot with status CANCELLED — do not delete it
  7. Write an audit record with actor, timestamp and reason code
```

Reversal must be **idempotent**: a repeated reversal for the same snapshot must not double-credit.

### F-12 — Retroactive invalidation on early departure

```
ON early departure:
  newLOS = daysBetween(arrivalDate, actualDepartureDate)

  FOR each applied offer:
      IF offer.minLOS != NULL AND newLOS < offer.minLOS:
          SWITCH offer.earlyDeparturePolicy:
              CASE CLAWBACK:      reverse all discounts granted; reprice at rack/BAR
              CASE PRORATE:       recompute discount for the shortened stay
              CASE HONOUR:        leave discount intact
              CASE FEE:           honour discount, post early-departure fee
```

The chosen policy must be disclosed at booking. In both the US and Canada, an undisclosed retroactive clawback is a consumer-protection exposure.

---

## 8. Implementation Logic — Folio, Ledger and Posting

### 8.1 Posting types for inclusions

| Posting type | Folio appearance | Revenue effect |
|---|---|---|
| **Included in rate** | No separate line | Item price is deducted from accommodation revenue and recognised against the item's transaction code |
| **Add to rate — separate line** | Own line | Item price is added to the total; both amounts recognised separately |
| **Add to rate — combined line** | Folded into the room line | Room rate increases by the item price |

For an inclusive package:

```
netAccommodationRevenue = packageRateAmount − Σ(itemPrice of all included package elements)
```

### 8.2 Posting rhythms

Standard set expected by North American operators:

`POST_EVERY_NIGHT`, `POST_ARRIVAL_NIGHT`, `POST_LAST_NIGHT`, `POST_EVERY_NIGHT_EXCEPT_ARRIVAL`, `POST_EVERY_NIGHT_EXCEPT_LAST`, `POST_EVERY_N_NIGHTS_FROM_NIGHT_M`, `POST_ON_SPECIFIC_WEEKDAYS`, `CUSTOM_SCHEDULE_BY_STAY_DAY`, `CUSTOM_SCHEDULE_BY_NIGHT`, `FLOATING_ALLOWANCE_PER_STAY`, `POST_NEXT_DAY`.

`POST_NEXT_DAY` exists so that a breakfast allowance created during night audit is consumable the following morning — a common source of off-by-one defects.

### 8.3 Calculation rules for package elements

| Rule | Formula |
|---|---|
| Flat amount | `price` |
| Per person | `price × (adults + children)` |
| Per adult | `price × adults` |
| Per child | `price × children` (optionally per child age bucket) |
| Per room | `price`, posted once even for shared reservations |

For shared reservations, "flat amount" posts per sharer and "per room" posts once. This distinction must be surfaced in configuration UI because it materially changes the folio.

### 8.4 Billing windows

| Window | Conventional use |
|---|---|
| 1 | Guest — room and tax |
| 2–8 | Guest — split billing, company direct-bill, incidentals |
| 101+ | Comp windows, one per authorizer or department |

Offers that comp charges route them from window 1 to a 101+ window. Offers that discount reduce the amount posted to window 1 directly.

### 8.5 Non-negotiable invariants

1. Guest ledger + package ledger + comp ledger balances to zero at period close.
2. No posted line may be negative solely because a discount exceeded its base.
3. Every discount and comp line carries: offer code, snapshot ID, authorizer (if any), reason code, actor, timestamp.
4. Reversal is idempotent and traceable to the original posting.
5. Accommodation revenue is never reduced by a comp — the comp is a routing, not a credit.

---

## 9. Tax Treatment — United States

> Verify all rates and rules with your tax advisor; US lodging tax is imposed at state, county, city and district level and changes frequently.

### 9.1 Structure

There is no federal VAT or sales tax. Lodging is subject to a stack of:

- State sales tax and/or state transient occupancy/lodging tax
- County and city occupancy tax
- Special-district taxes (convention, tourism improvement, stadium districts)
- Tourism/marketing assessments, sometimes levied on the operator rather than the guest

The stack can exceed 17% in some major markets. Each layer can have a different taxable base and a different treatment of discounts.

### 9.2 Discounts

A genuine reduction in the price paid generally reduces the taxable base — tax is computed on the discounted amount. Exceptions to check per jurisdiction:

- **Third-party-reimbursed discounts** (a coupon the property redeems for value from a third party) may be treated as consideration and remain taxable.
- **OTA merchant-model bookings** raise the question of whether tax applies to the net rate or the retail rate; several states have litigated this.

### 9.3 Complimentary rooms

Treatment varies materially by state:

- Many states impose no occupancy tax where there is no consideration.
- Several gaming states apply tax or use tax to the **retail value** of complimentary rooms and complimentary food and beverage provided to patrons. Nevada in particular has an extensive body of law on complimentaries.
- Some jurisdictions require the property to self-assess use tax on the cost of goods given away.

**Design requirement:** the PMS must support, per property, all three configurations:

1. Tax the retail value of a comped room and charge the guest.
2. Tax the retail value and route the tax to the comp window (property absorbs it).
3. Do not tax a zero-consideration stay.

### 9.4 Extended stay

Most jurisdictions exempt transient occupancy tax after a continuous stay threshold — commonly 30 days, but 28, 29, 31 and 90 days all appear. The exemption may be prospective only or retroactive to night one. A long-stay offer must therefore be modelled together with its tax-exemption trigger.

### 9.5 Resort and destination fees

Generally taxable as part of the room charge where the fee is mandatory. An offer that waives a resort fee reduces both the fee and its associated tax.

### 9.6 Tax-exempt guests

Government, diplomatic, non-profit and tribal exemptions apply at the guest or payer level and are independent of offers. An exemption must be applied after the offer discount, on the discounted base, and requires exemption-certificate capture.

---

## 10. Tax Treatment — Canada

> Verify current rates; provincial rates and thresholds change. Nova Scotia's HST rate changed in 2025.

### 10.1 Structure

| Layer | Detail |
|---|---|
| **GST** | 5% federal, in provinces and territories without HST |
| **HST** | Harmonised federal + provincial. Ontario 13%; New Brunswick, Newfoundland and Labrador, Prince Edward Island 15%; Nova Scotia 14% (reduced from 15% effective 1 April 2025) |
| **PST / QST** | British Columbia PST on accommodation 8%; Saskatchewan PST 6%; Manitoba RST 7%; Quebec QST 9.975% |
| **Municipal / regional accommodation taxes** | BC Municipal and Regional District Tax (MRDT) up to 3%; Ontario Municipal Accommodation Tax up to 4%; Alberta Tourism Levy 4%; Manitoba Accommodation Tax 5%; Quebec lodging tax 3.5%; various city-level levies |

A Canadian PMS must therefore support at least three concurrent tax layers on a single room-night, each with its own base and its own treatment of discounts.

### 10.2 Discounts and coupons

The Excise Tax Act distinguishes coupon types, and the distinction changes the GST/HST base:

- **Reimbursable coupons** (the property is reimbursed by a third party for the coupon value) — the coupon is treated as consideration; **tax is calculated on the pre-discount amount**.
- **Non-reimbursable coupons** (the property funds the discount itself) — the discount reduces consideration; **tax is calculated on the discounted amount**.
- **Volume rebates and post-sale discounts** have their own adjustment mechanics.

**Design requirement:** an offer must carry a `reimbursedByThirdParty` flag that drives whether tax computes on the gross or net base. This is the single most important Canada-specific offer attribute.

### 10.3 Complimentary rooms

A supply for no consideration generally attracts no GST/HST. However:

- Input tax credits claimed on inputs to that supply may be subject to recapture or change-in-use rules.
- Provincial accommodation levies may still be assessed on the retail value in some jurisdictions.
- Gaming-authority venues may have specific reporting obligations for complimentary value.

### 10.4 Long-term accommodation

Continuous occupancy of **one month or more** in a residential complex is generally exempt from GST/HST. Additionally, where the accommodation charge is **$20 per day or less**, the supply is generally exempt. Long-stay offers must be modelled with these thresholds.

### 10.5 Loyalty and award stays

Points redemption raises questions of whether points constitute consideration, and of the timing of the taxable event between accrual and redemption. Treatment depends on the structure of the loyalty program and whether the operating entity is separate. Obtain a ruling for material programs.

### 10.6 GST/HST rebates for tour packages

The Foreign Convention and Tour Incentive Program provides rebates in defined circumstances for eligible tour packages sold to non-residents. Wholesale and tour-operator offers should carry the flags needed to identify eligible packages.

---

## 11. Price-Display and Advertising Rules

These rules constrain how offers may be *presented*, and both countries tightened them recently.

### 11.1 United States — federal

The FTC **Rule on Unfair or Deceptive Fees** took effect **12 May 2025** and applies to short-term lodging. In substance:

- The **total price**, inclusive of all mandatory fees (resort fees, destination fees, cleaning fees), must be displayed **as prominently as, or more prominently than, any other price**, wherever a price is first shown.
- Government charges, shipping, and genuinely optional charges may be excluded from the headline total but must be disclosed before payment.
- Misrepresenting the nature or purpose of a fee is prohibited.

**Implication for offers:** any offer presentation surface — availability grid, offer tile, confirmation email — must be able to render an all-in total that includes mandatory fees, not just a discounted nightly rate.

### 11.2 United States — states

California **SB 478** and **AB 537** (both effective 1 July 2024) prohibit drip pricing and specifically require lodging advertising to include all mandatory fees other than taxes and government fees. Several other states have parallel statutes. Multiple state attorneys general have pursued resort-fee cases.

### 11.3 Canada — federal

The **Competition Act** drip-pricing provisions, strengthened by the 2022 amendments, make it a reviewable practice — and in some circumstances a criminal offence — to advertise a price that is not attainable because of mandatory non-government fees. The Competition Bureau has pursued lodging and ticketing cases.

Related requirements:

- **Ordinary selling price (OSP)** rules govern "was/now" and "% off" claims: the reference price must be genuine, satisfying either a volume test or a time test.
- Performance and savings claims must be substantiable.

**Implication for offers:** a "50% off" offer must reference a price at which a substantial volume of rooms was sold, or which was offered in good faith for a substantial period. Storing the reference price against the offer is the practical way to evidence this.

### 11.4 Quebec — language

The **Charter of the French Language**, as amended by **Bill 96**, requires French in commercial publications and consumer contracts, with French at least equally prominent. Offer names, descriptions, terms and folio descriptors presented to guests in Quebec must exist in French.

**Design requirement:** offer descriptive fields must be localisable (`Map<locale, text>`), not single-string. This is a schema decision that is expensive to retrofit.

### 11.5 Accessibility

US ADA regulations require that reservation systems allow guests to identify and book accessible rooms and describe accessibility features. Offers that restrict room types must not have the effect of making accessible rooms unavailable at the offered rate.

---

## 12. Gaming, Privacy and Marketing Compliance

| Area | United States | Canada |
|---|---|---|
| **Gaming regulator** | State gaming boards (e.g. NGCB, NJDGE, MGCB, PGCB); tribal gaming commissions under IGRA | Provincial bodies: AGCO (ON), BCLC (BC), AGLC (AB), Loto-Québec / RACJ (QC), SLGA (SK), Manitoba Liquor & Lotteries |
| **Comp reporting** | Gaming boards commonly require records of complimentaries granted, by department and authorizer | Provincial operators impose analogous reporting on complimentary value |
| **AML / financial recordkeeping** | Bank Secrecy Act / Title 31: casinos are financial institutions; CTRs for currency transactions over $10,000; SARs | FINTRAC: casinos are reporting entities; large cash transaction reports and suspicious transaction reports |
| **Income reporting** | Complimentaries may constitute reportable income to the recipient; operators commonly evaluate Form 1099-MISC for prizes and awards at or above the $600 threshold. Form W-2G applies to gambling **winnings**, not to comps. | Casual gambling winnings are generally not taxable to individuals; prizes and awards have their own treatment. Non-resident withholding may apply in defined cases. |
| **Self-exclusion** | State self-exclusion programs require suppression of direct marketing and, in most cases, denial of comps to enrolled individuals | Provincial self-exclusion programs impose equivalent obligations |
| **Responsible gaming messaging** | Required on marketing material in many jurisdictions | Required in most provinces |
| **Marketing consent** | CAN-SPAM: opt-out model; clear identification and functioning unsubscribe; TCPA governs SMS and calls with strict consent requirements | **CASL**: opt-in model; express or implied consent required before sending commercial electronic messages; significantly stricter than CAN-SPAM, with substantial penalties |
| **Privacy** | State laws — CCPA/CPRA (CA), CPA (CO), VCDPA (VA) and others; consumer rights over profiling and targeted advertising | PIPEDA federally; Quebec **Law 25**, which adds consent, profiling-transparency and portability obligations |

**Design requirements arising:**

1. A hard suppression check against self-exclusion status before any offer is presented, quoted, or granted.
2. Consent state (CASL express/implied, with expiry dates) stored per profile and enforced before any offer communication to a Canadian address.
3. Full audit trail on every comp: authorizer, amount, department, reason code, timestamp, actor.
4. Complimentary value exported to the CMS and data warehouse with a stable transaction key so tax and AML aggregation can be performed downstream.
5. Data-subject rights (access, deletion, profiling opt-out) must extend to offer and comp history.

---

## 13. Reference Data Model

```
┌──────────────────┐        ┌────────────────────┐        ┌──────────────────┐
│ PROMOTION_GROUP  │1──────*│ OFFER              │*──────*│ RATE_CODE        │
│ code, type       │        │ offerCode (PK)     │        │ rateCode (PK)    │
│ description      │        │ name, description  │        │ transactionCode  │
└──────────────────┘        │ offerType          │        └────────┬─────────┘
                            │ discountType/value │                 │
┌──────────────────┐        │ applicationBasis   │        ┌────────▼─────────┐
│ COUPON           │*──────1│ scope, currency    │        │ RATE_DETAIL      │
│ couponCode (PK)  │        │ active             │        │ date, roomType   │
│ status, expiry   │        └───┬──────┬─────┬───┘        │ amount           │
│ redeemedBy       │            │      │     │            └──────────────────┘
└──────────────────┘            │      │     │
                                │      │     │
        ┌───────────────────────┘      │     └──────────────────────┐
        │                              │                            │
┌───────▼────────────┐   ┌─────────────▼──────────┐   ┌─────────────▼────────┐
│ OFFER_RESTRICTION  │   │ PACKAGE_ELEMENT        │   │ COMP_ROUTING          │
│ bookingWindow      │   │ packageCode (PK)       │   │ templateId (PK)       │
│ stayWindow         │   │ postingType            │   │ splitType             │
│ minLOS / maxLOS    │   │ calculationRule        │   │ destinations[]        │
│ min/maxAdvancePur. │   │ postingRhythm          │   │ includedItems[]       │
│ arrivalDaysOfWeek  │   │ itemPrice              │   │ excludedItems[]       │
│ blackoutDates[]    │   │ allowanceAmount        │   │ authorizerId          │
│ blackoutDays[]     │   │ overageTxnCode         │   │ limitType, amounts    │
│ eligibleRoomTypes  │   │ profitTxnCode          │   └───────────┬───────────┘
│ eligibleChannels   │   │ lossTxnCode            │               │
│ eligibleMemberships│   │ alternateTxnCodes[]    │   ┌───────────▼───────────┐
└────────────────────┘   └────────────────────────┘   │ COMP_AUTHORIZER       │
                                                       │ authorizerId (PK)     │
┌──────────────────────────────────────────┐          │ name, department      │
│ RESERVATION                              │          │ perDayLimit           │
│ confirmationNumber (PK)                  │          │ perStayLimit          │
│ arrival, departure, roomType, rateCode   │          │ balances{date→amount} │
│ adults, children, channel, profileId     │          └───────────────────────┘
└───────────────┬──────────────────────────┘
                │ 1
                │
                │ *
┌───────────────▼──────────────────────────┐        ┌───────────────────────┐
│ OFFER_SNAPSHOT                           │*──────1│ FOLIO_WINDOW          │
│ snapshotId (PK)                          │        │ windowNumber          │
│ offerCode, offerVersion                  │        │ payeeType             │
│ appliedDates[]                           │        │ balance               │
│ perNightAmounts{date→amount}             │        └───────────┬───────────┘
│ applicableBase{date→amount}              │                    │
│ couponCode, voucherIds[]                 │        ┌───────────▼───────────┐
│ playerId, authorizerId, routingTemplateId│        │ FOLIO_LINE            │
│ sourceSystemTransactionId                │        │ date, txnCode, amount │
│ status {QUOTED|APPLIED|REDEEMED|         │        │ offerSnapshotId       │
│         CANCELLED|REVERSED}              │        │ reasonCode, actor     │
│ capturedAt, capturedBy                   │        └───────────────────────┘
└──────────────────────────────────────────┘
```

### 13.1 Indexing guidance

| Access pattern | Index |
|---|---|
| Offer lookup during availability search | `(propertyId, active, bookingWindowStart, bookingWindowEnd)` |
| Offers attached to a rate code | `(propertyId, rateCode)` |
| Coupon validation | `(couponCode)` unique |
| Redemption limit enforcement | `(offerCode, profileId)` |
| Snapshot retrieval on a reservation | `(confirmationNumber, status)` |
| Comp balance by authorizer and date | `(authorizerId, businessDate)` |
| Offer performance reporting | `(propertyId, offerCode, businessDate)` |

---

## 14. Reporting and Audit Requirements

### 14.1 Operational and commercial reports

| Report | Content |
|---|---|
| **Offer production** | Room-nights, gross revenue, discount value, net revenue, ADR, by offer code and date |
| **Discount reason analysis** | Discount value grouped by reason code and by actor |
| **Promotion / coupon redemption** | Issued, redeemed, expired, redemption rate, revenue attributable |
| **Package forecast** | Forecast package element consumption for procurement and labour planning |
| **Package ledger balance** | Credits, consumption, profit, loss, closing balance — must reconcile to zero |
| **Comp report** | Comp value by authorizer, department, offer and date, with per-day and per-stay limit utilisation |
| **Rate-override report** | All manual overrides with actor, reason code and delta |
| **Offer displacement** | Revenue foregone where discounted inventory displaced higher-rated demand |
| **Channel offer performance** | Offer production split by channel, with cost of acquisition |

### 14.2 Audit trail — mandatory fields

Every offer application, modification, comp grant, override and reversal must record:

```
timestamp (with time zone), actor, actorRole, workstation/terminal,
reservationId, offerSnapshotId, offerCode, action,
amountBefore, amountAfter, reasonCode, authorizerId (if applicable),
sourceSystemTransactionId (if externally granted)
```

Retention should meet the longest applicable requirement across tax authority, gaming regulator and internal audit — commonly seven years in both countries.

---

## 15. Implementation Checklist

**Data model**

- [ ] Offer descriptions are localisable (`Map<locale, text>`) — required for Quebec.
- [ ] Every monetary attribute carries an ISO 4217 currency code.
- [ ] Numeric restrictions stored as integers, with `null` meaning unrestricted.
- [ ] `reimbursedByThirdParty` flag present on every offer — drives the Canadian GST/HST base.
- [ ] Offer snapshot is immutable and versioned against the offer definition.

**Qualification**

- [ ] Booking-scope, stay-scope and night-scope rules are separated and evaluated in the correct scope.
- [ ] Partial vs all-or-nothing qualification is explicit configuration, not implicit behaviour.
- [ ] Blackout dates and weekdays are applied on every quote path, not only the player/loyalty path.
- [ ] Open-ended blackout ranges (start-only, end-only) have documented semantics.

**Pricing**

- [ ] Discounts are clamped so they can never exceed their base.
- [ ] Percentage stacking behaviour (compounding vs additive) is explicit and documented.
- [ ] Per-stay amounts allocate across nights with the remainder assigned to one night.
- [ ] Buy-N/Get-M free nights accumulate across all blocks.
- [ ] Rounding is HALF_UP at currency scale, applied once, at a defined point.
- [ ] Offer application order is deterministic and reproducible.

**Reservation lifecycle**

- [ ] Offers are re-qualified on every date, room-type, occupancy and rate-code change.
- [ ] Early-departure policy (clawback / prorate / honour / fee) is configured and disclosed at booking.
- [ ] Extension re-checks `maxNightsCovered` and per-stay limits.
- [ ] Share/split behaviour (per sharer vs per room) is explicit.
- [ ] Cancellation releases coupons, inventory and source-system holds; reversal is idempotent.

**Accounting**

- [ ] Comps route charges rather than reducing accommodation revenue.
- [ ] Package ledger reconciles to zero at period close.
- [ ] Excluded transaction items take precedence over included items.
- [ ] Comp limits enforced per-day, per-stay, or both, with overage routed to the guest window.

**Tax**

- [ ] Per-property configuration for taxing complimentary rooms: guest pays / property absorbs / not taxed.
- [ ] Canadian reimbursable-coupon handling computes tax on the gross base.
- [ ] Long-stay tax-exemption thresholds configurable per jurisdiction, with the correct prospective/retroactive behaviour.
- [ ] Multiple concurrent tax layers supported, each with its own base and discount treatment.
- [ ] Tax exemption applied after the offer discount.

**Compliance**

- [ ] All-in total price, inclusive of mandatory fees, renderable on every offer surface.
- [ ] Reference price stored against any "was/now" or "% off" claim.
- [ ] Self-exclusion suppression enforced before offer presentation, quotation or grant.
- [ ] CASL consent state stored and enforced for Canadian recipients.
- [ ] Full audit trail on every discount, comp, override and reversal.
- [ ] Complimentary value exported with a stable key for downstream tax and AML aggregation.

---

## 16. Standards and Sources

**Technical standards**

- OpenTravel Alliance (OTA) messaging specifications — `OfferType`, `OfferRules`, `Discount`, `FreeUpgrade`, `CompatibleOffers`, `applicationOrder`
- HTNG (Hospitality Technology Next Generation) interface specifications
- ISO 4217 currency codes; ISO 8601 dates
- USALI (Uniform System of Accounts for the Lodging Industry) — revenue and discount classification

**Vendor documentation used as terminology reference**

- Oracle OPERA Cloud — [Configuring Promotion Codes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/t_creating_promotion_codes.htm)
- Oracle OPERA Cloud — [Configuring Promotion Coupon Codes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.1/ocsuh/t_configuring_promotion_coupon_codes.htm)
- Oracle OPERA Cloud — [Package Codes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.3/ocsuh/c_package_codes.htm)
- Oracle OPERA Cloud — [About Rate Codes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.3/ocsuh/c_rate_codes.htm)
- Oracle OPERA Cloud — [Rate Management](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.1/ocsuh/c_rate_management_ch.htm)
- Oracle OPERA 5 — [OPERA Gaming Interface](https://docs.oracle.com/cd/E93781_01/index.html)

**Regulatory references**

*United States* — FTC Rule on Unfair or Deceptive Fees (16 CFR Part 464, effective 12 May 2025); California SB 478 / AB 537; CAN-SPAM Act; Telephone Consumer Protection Act; Bank Secrecy Act / 31 CFR Chapter X; IRS Forms 1099-MISC and W-2G; Indian Gaming Regulatory Act; ADA Title III reservation requirements; state gaming board regulations; state and local transient occupancy tax codes.

*Canada* — Excise Tax Act (GST/HST, including coupon provisions); CRA GST/HST Memoranda; provincial sales tax and accommodation tax statutes; Competition Act (drip pricing, ordinary selling price); Canada's Anti-Spam Legislation (CASL); PIPEDA; Quebec Law 25; Charter of the French Language as amended by Bill 96; provincial gaming authority regulations; FINTRAC reporting requirements for casinos.

---

*This document is engineering and product guidance. Statements about tax, gaming and consumer-protection law are summaries of general practice and are not legal or tax advice. Rates, thresholds and effective dates change; validate every jurisdictional rule with qualified tax and regulatory counsel before implementation.*
