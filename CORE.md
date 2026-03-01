# Stay PMS — Formulas & Calculations Consolidated Reference

> **Generated:** February 2026
> **Scope:** All `.java` files across the Stay PMS application (non-test source only)

---

## Table of Contents

1. [Tax Calculations](#1-tax-calculations)
2. [Rate & Pricing Calculations](#2-rate--pricing-calculations)
3. [Balance & Ledger Calculations](#3-balance--ledger-calculations)
4. [Revenue Calculations](#4-revenue-calculations)
5. [Rate Splitting (Shared Reservations)](#5-rate-splitting-shared-reservations)
6. [Occupancy-Based Calculations](#6-occupancy-based-calculations)
7. [Authorization Calculations](#7-authorization-calculations)
8. [Deposit Calculations](#8-deposit-calculations)
9. [Allowance & Package Calculations](#9-allowance--package-calculations)
10. [Cancellation Fee Calculations](#10-cancellation-fee-calculations)
11. [Commission Calculations](#11-commission-calculations)
12. [Foreign Exchange Calculations](#12-foreign-exchange-calculations)
13. [Casino Points / CMS Calculations](#13-casino-points--cms-calculations)
14. [Comp Accounting Calculations](#14-comp-accounting-calculations)
15. [Payment & Credit Calculations](#15-payment--credit-calculations)
16. [Reporting Aggregation Formulas](#16-reporting-aggregation-formulas)
17. [Yield Rate Calculations](#17-yield-rate-calculations)
18. [Estimated Charges Summary](#18-estimated-charges-summary)
19. [Utility / Rounding Calculations](#19-utility--rounding-calculations)

---

## 1. Tax Calculations

### 1.1 Taxable Amount (Charge Line Item)
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/tax/TaxesHandler.java`
- **Method:** `getBulkTaxes()`
- **Formula:** `taxableAmount = amount × quantity`
- **Negation:** For refund/allowance transaction types, the result is negated.
```java
BigDecimal taxableAmount = chargeLineItem.getAmount()
    .multiply(BigDecimal.valueOf(chargeLineItem.getQuantity()));
if (transactionType != null && transactionType.negate()) {
    taxableAmount = taxableAmount.negate();
}
```

> **📊 Example:** amount = $150.00, quantity = 2, transactionType = CHARGE (no negate)
> ```
> taxableAmount = 150.00 × 2 = $300.00
> ```

### 1.2 Reverse Tax — Unit Amount from Taxable Amount
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/tax/TaxesHandler.java`
- **Method:** `getBulkTaxes()` (reverse tax block)
- **Formula:** `unitAmount = taxableAmount ÷ quantity`; then `unitAmountAfterExemption = (amount − exemptedTaxAmount) ÷ quantity`
```java
actualAmount = actualAmount.divide(BigDecimal.valueOf(chargeLineItem.getQuantity()), 2, RoundingMode.HALF_UP);
BigDecimal actualTaxExemptedAmount = chargeLineItem.getAmount()
    .subtract(negate ? exemptedTaxAmount.negate() : exemptedTaxAmount);
```

> **📊 Example:** taxableAmount = $300.00, quantity = 2, exemptedTaxAmount = $20.00
> ```
> unitAmount = 300.00 ÷ 2 = $150.00
> unitAmountAfterExemption = (300.00 − 20.00) ÷ 2 = $140.00
> ```

### 1.3 Reverse Tax with Excluded Inclusive Tax
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/tax/TaxesHandler.java`
- **Formula:** For group deposit proforma with excluded inclusive tax: `reverseTaxTotal = reverseTaxTotal + taxExcludedAmount`
```java
reverseTaxTotalChargeAmount = reverseTaxTotalChargeAmount.add(taxExcludedAmount);
amount = amount.add(taxExcludedAmount);
```

> **📊 Example:** reverseTaxTotal = $500.00, taxExcludedAmount = $35.00
> ```
> reverseTaxTotal = 500.00 + 35.00 = $535.00
> amount = 500.00 + 35.00 = $535.00
> ```

### 1.4 Negate Allowance Package Folio Tax
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/tax/TaxesHandler.java`
- **Method:** `negateAllowancePackageFolioTax()`
- **Formula:** `taxOnAllowance = −taxAmount` (credit)
```java
BigDecimal negatedTax = taxFolioLineItem.getAmount().negate();
```

> **📊 Example:** taxAmount on allowance = $12.50
> ```
> negatedTax = −($12.50) = −$12.50  (credit applied to folio)
> ```

### 1.5 Reverse Tax Subtraction from Rate
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/RatesIntegrationHandler.java`
- **Formula:** `netRate = grossRate − inclusiveTaxAmount`
```java
rateSnapshot.setRate(new BigDecimal(rateSnapshot.getRate()).subtract(taxAmount).toString());
```

> **📊 Example:** grossRate = $200.00, inclusiveTaxAmount = $18.00
> ```
> netRate = 200.00 − 18.00 = $182.00
> ```

### 1.6 Tax Line Item Amount
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/common-interface/src/main/java/com/agilysys/pms/account/model/LineItemView.java`
- **Formula:** `taxAmount = Σ(unitTaxAmount × quantity)` per tax line
```java
taxAmount += unitAmount * quantity;
```

> **📊 Example:** Tax line 1: unitTax = $5.00, qty = 2; Tax line 2: unitTax = $3.00, qty = 2
> ```
> taxAmount = (5.00 × 2) + (3.00 × 2) = 10.00 + 6.00 = $16.00
> ```

### 1.7 Reverse Tax Display — Unit Amount
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/invoice/FolioInvoiceHandlerHelper.java`
- **Method:** `formatDisplayDateAndAmount()`
- **Formula:** `unitAmount = (reverseTaxTotal + taxAmount) ÷ quantity`
```java
unitAmount = lineItem.getReverseTaxTotalChargeAmount().add(lineItem.getTaxAmount())
    .divide(BigDecimal.valueOf(lineItem.getQuantity()), 2, RoundingMode.HALF_UP);
```

> **📊 Example:** reverseTaxTotal = $180.00, taxAmount = $20.00, quantity = 2
> ```
> unitAmount = (180.00 + 20.00) ÷ 2 = 200.00 ÷ 2 = $100.00
> ```

### 1.8 Component Taxable Amount
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/AvailabilityHandler.java`
- **Formula:** `taxableAmount = componentAmount × totalQuantity`
```java
taxableComponentItem.setTaxableAmount(component.getAmount().multiply(BigDecimal.valueOf(totalQuantity)));
```

> **📊 Example:** componentAmount = $25.00, totalQuantity = 3
> ```
> taxableAmount = 25.00 × 3 = $75.00
> ```

### 1.9 Deposit Tax Exclusion
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/AvailabilityHandler.java`
- **Method:** `excludeDepositTaxAmount()`
- **Formula:** `effectiveTaxIncluded = taxIncludedAmount − Σ(non-matching tax rule amounts)`
```java
taxIncludedAmount = taxIncludedAmount.subtract(summary.getAmount());
```

> **📊 Example:** taxIncludedAmount = $50.00, non-matching tax rule amount = $8.00
> ```
> effectiveTaxIncluded = 50.00 − 8.00 = $42.00
> ```

---

## 2. Rate & Pricing Calculations

### 2.1 Rate Override / Adjustment
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/util/RatesHelper.java`
- **Method:** `getOverriddenRate()`
- **Formulas:**
  - **UNIT:** `rate = amount` (flat override)
  - **ADJUST_UNIT:** `rate = basePrice + amount`
  - **ADJUST_PERCENT:** `rate = basePrice × (1 + amount/100)`
```java
case ADJUST_PERCENT:
    return basePrice.multiply(BigDecimal.ONE.add(
        amount.divide(new BigDecimal(100), 2, RoundingMode.HALF_UP)));
```

> **📊 Example:** basePrice = $150.00, amount = $25.00
> ```
> UNIT:           rate = $25.00 (flat override)
> ADJUST_UNIT:    rate = 150.00 + 25.00 = $175.00
> ADJUST_PERCENT: rate = 150.00 × (1 + 25/100) = 150.00 × 1.25 = $187.50
> ```

### 2.2 Percentage Rate Modifier
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/DateNodeProcessor.java`
- **Method:** `computeRate()` / `applyPercentageAdjustment()`
- **Formula:** `rate = currentRate × (1 + modifier/100)`
```java
node.setRate(node.getRate().multiply(BigDecimal.ONE.add(
    rate.getAmount().divide(new BigDecimal(100), 10, RoundingMode.HALF_UP))));
```

> **📊 Example:** currentRate = $200.00, modifier = 5%
> ```
> rate = 200.00 × (1 + 5/100) = 200.00 × 1.05 = $210.00
> ```

### 2.3 Surcharge Calculation (Single Person)
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/DateNodeProcessor.java`
- **Method:** `computeSurcharge()`
- **Formula:** `rate = rate + singlePersonAdultCharge` (when `guestTotal < minAdults`)
```java
surCharge = surCharge.add(ratePlanSurcharge.getSinglePersonAdultCharge());
node.setRate(node.getRate().add(surCharge));
```

> **📊 Example:** rate = $180.00, singlePersonAdultCharge = $20.00, guestTotal = 1, minAdults = 2
> ```
> surCharge = $20.00  (single person, below minimum)
> rate = 180.00 + 20.00 = $200.00
> ```

### 2.4 Room Rate with Inclusive/Exclusive Components
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/DateNode.java`
- **Method:** `toModel()`
- **Formula:**
  - `roomRate = max(0, baseRate − inclusiveComponents + extras)`
  - `totalRate = roomRate + inclusiveComponents + exclusiveComponents`
```java
BigDecimal roomRate = baseRate.subtract(includedComponentsRate).add(rateWithoutBaseRate);
model.setRate(roomRate.add(includedComponentsRate).add(excludedComponentsRate));
```

> **📊 Example:** baseRate = $200.00, inclusiveComponents = $30.00, extras = $10.00, exclusiveComponents = $25.00
> ```
> roomRate = max(0, 200.00 − 30.00 + 10.00) = $180.00
> totalRate = 180.00 + 30.00 + 25.00 = $235.00
> ```

### 2.5 Strike-Through Price
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/AvailableRatesHandler.java`
- **Method:** `getStrikeThroughPriceByDate()`
- **Formula:** `strikeThrough = roomRate + Σ componentAmounts`
```java
strikeThroughByPriceId.put(key, rate.getRoomRate().add(componentRate));
```

> **📊 Example:** roomRate = $200.00, componentAmounts = [$30.00, $20.00]
> ```
> strikeThrough = 200.00 + 30.00 + 20.00 = $250.00
> ```

### 2.6 Extra Guest Charge
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/sharedreservation/util/SharedReservationCalculationUtils.java`
- **Method:** `getExtraChargeForCategory()`
- **Formula:** `extraChargeTotal = extraCharge × (totalGuests − includedGuests)`
```java
int applicableCount = (totalAgeCategory - includedGuestCount);
return extraCharge.multiply(BigDecimal.valueOf(applicableCount));
```

> **📊 Example:** extraCharge = $25.00/person, totalGuests = 4, includedGuests = 2
> ```
> applicableCount = 4 − 2 = 2
> extraChargeTotal = 25.00 × 2 = $50.00
> ```

### 2.7 Daily Rate with Full Occupancy Surcharges
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/common-interface/src/main/java/com/agilysys/common/model/rate/DailyRateView.java`
- **Method:** `getCalculatedRate()`
- **Formula:** `totalRate = preOccupancyRate + Σ(extraCategoryCharge × max(categoryCount − categoryIncluded, 0))` for adults, children, ageCategory1..8
```java
total = preOccupancyRate
    + extraAdultCharge * (adults - adultsIncluded)
    + extraChildCharge * (children - childrenIncluded)
    + extraAgeCategory1Charge * (ageCategory1 - ageCategory1Included) ...;
```

> **📊 Example:** preOccupancyRate = $180.00, adults = 3 (included = 2), children = 1 (included = 1), extraAdultCharge = $25.00, extraChildCharge = $15.00
> ```
> totalRate = 180.00 + (25.00 × max(3−2, 0)) + (15.00 × max(1−1, 0))
>          = 180.00 + 25.00 + 0.00 = $205.00
> ```

### 2.8 Add-On / Component Rate
- **Service:** `stay-rate-service`
- **Files:** `ComponentDomain.java`, `RoomTypeNode.java`, `RatesEngine.java`
- **Formula:** `addOnRate = unitAmount × totalQuantity`
```java
BigDecimal addOnsRate = amount.multiply(new BigDecimal(ComponentHelper.getTotalQuantity(...)));
```

> **📊 Example:** unitAmount = $35.00, totalQuantity = 2
> ```
> addOnRate = 35.00 × 2 = $70.00
> ```

### 2.9 Add-On Total Charges
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/RatesIntegrationHandler.java`
- **Formula:** `totalCharge = amount × quantity`
```java
groupAddOnsCharge.setTotalCharges(component.getAmount().multiply(new BigDecimal(component.getQuantity())));
```

> **📊 Example:** amount = $50.00, quantity = 3
> ```
> totalCharge = 50.00 × 3 = $150.00
> ```

### 2.10 Occupancy Percentage
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/DateNodeProcessor.java`
- **Method:** `applyYielding()`
- **Formula:** `occupancy% = ⌈(granted × 100) ÷ (granted + available)⌉`
```java
BigDecimal total = new BigDecimal(granted + available);
BigDecimal diff = new BigDecimal(granted).multiply(new BigDecimal("100"));
roomTypeOccupancyPercent = diff.divide(total, RoundingMode.CEILING);
```

> **📊 Example:** granted = 75 rooms, available = 25 rooms
> ```
> total = 75 + 25 = 100
> occupancy% = ⌈(75 × 100) ÷ 100⌉ = ⌈75.0⌉ = 75%
> ```

### 2.11 Comp Offer Percentage Discount
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/RoomTypeNode.java`
- **Method:** `applyCompOffers()`
- **Formula:** `discountAmount = (discount / 100) × remainingRate`
```java
BigDecimal discountAmount = discount.divide(BigDecimal.valueOf(100))
    .multiply(remainingRate).setScale(2, RoundingMode.HALF_UP);
```

> **📊 Example:** discount = 20%, remainingRate = $250.00
> ```
> discountAmount = (20 / 100) × 250.00 = 0.20 × 250.00 = $50.00
> ```

### 2.12 Routing Rule — Percentage Discount
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/RoutingRuleHandler.java`
- **Method:** `getCompRate()`
- **Formula:** `discountValue = (discount / 100) × remainingRate`; `compRate = applicableRate − Σ discountValues`
```java
BigDecimal discountValue = discount.divide(BigDecimal.valueOf(100))
    .multiply(remainingRate).setScale(2, RoundingMode.HALF_UP);
compRate = applicableRate.subtract(discountAmount);
```

> **📊 Example:** discount = 15%, remainingRate = $200.00, applicableRate = $200.00
> ```
> discountValue = (15 / 100) × 200.00 = $30.00
> compRate = 200.00 − 30.00 = $170.00
> ```

### 2.13 Routing Rule — Amount Discount
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/RoutingRuleHandler.java`
- **Formula:** `compRate = max(0, applicableRate − Σ fixedDiscountAmounts)`
```java
compRate = applicableRate.subtract(discountAmount);
if (compRate.compareTo(BigDecimal.ZERO) < 0) compRate = BigDecimal.ZERO;
```

> **📊 Example:** applicableRate = $200.00, fixedDiscountAmount = $50.00
> ```
> compRate = max(0, 200.00 − 50.00) = max(0, 150.00) = $150.00
> ```

### 2.14 Last Room Value (LRV) Comparison
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/RoomTypeNodeProcessor.java`
- **Method:** `applyLastRoomValue()`
- **Formula:** If `Σ LRV > Σ dailyRate` → room is UNAVAILABLE
```java
lrvTotal = lrvTotal.add(lastRoomValueResponse.getAmount());
totalDailyRate = totalDailyRate.add(dateNode.getRate());
if (lrvTotal.compareTo(totalDailyRate) > 0) node.setStatus(AvailabilityStatus.UNAVAILABLE);
```

> **📊 Example:** Night 1: LRV = $180, dailyRate = $150; Night 2: LRV = $180, dailyRate = $150
> ```
> lrvTotal = 180 + 180 = $360
> totalDailyRate = 150 + 150 = $300
> 360 > 300 → Room is UNAVAILABLE
> ```

### 2.15 Auto-Recurring Charge as Percentage of Room Rate
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceDomain/src/main/java/com/agilysys/pms/account/data/domain/RecurringCharge.java`
- **Method:** `updateAutoRecurringItemAmount()`
- **Formula:** `baseAmount = roomRate × (value / 100)`
```java
BigDecimal baseAmount = roomRate.multiply(autoRecurringItem.getValue().divide(new BigDecimal(100)));
```

> **📊 Example:** roomRate = $200.00, autoRecurringValue = 10%
> ```
> baseAmount = 200.00 × (10 / 100) = 200.00 × 0.10 = $20.00
> ```

### 2.16 Auto-Recurring Item Absolute Value
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/common-interface/src/main/java/com/agilysys/common/model/DepositRateSnapshot.java`
- **Method:** `getAbsoluteValue()`
- **Formulas:**
  - Based on nightly charge: `value = preOccupancyRate × item.getValue() / 100`
  - With components: `value = (preOccupancyRate + componentRates) × item.getValue() / 100`
```java
value = preOccupancyRate.multiply(item.getValue()).divide(new BigDecimal(100));
value = preOccupancyRate.add(componentRates).multiply(item.getValue()).divide(new BigDecimal(100));
```

> **📊 Example:** preOccupancyRate = $180.00, item.value = 5%, componentRates = $30.00
> ```
> Without components: value = 180.00 × 5.00 / 100 = $9.00
> With components:    value = (180.00 + 30.00) × 5.00 / 100 = 210.00 × 0.05 = $10.50
> ```

### 2.17 Occupancy-Based Rate Incremental Charges
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/RatesIntegrationHandler.java`
- **Method:** `applyBaseByOccupancy()`
- **Formula:** `extraAdultCharge[occupancy] = baseByOccupancy[occupancy] − runningTotal`
```java
BigDecimal value = current.subtract(runningTotal);
runningTotal = current;
```

> **📊 Example:** baseByOccupancy = [null, $200, $225, $260], runningTotal starts at $0
> ```
> occupancy 1: extraCharge = 200 − 0 = $200.00,   runningTotal = $200
> occupancy 2: extraCharge = 225 − 200 = $25.00,  runningTotal = $225
> occupancy 3: extraCharge = 260 − 225 = $35.00,  runningTotal = $260
> ```

### 2.18 Batch Update Recurring Charge Percentage
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/utils/BatchUpdateRoomRateUtils.java`
- **Formula:** `baseAmount = rate × (value / 100)`
```java
BigDecimal percentage = value.divide(BigDecimal.valueOf(100));
BigDecimal baseAmount = rate.multiply(percentage);
```

> **📊 Example:** rate = $200.00, value = 8%
> ```
> percentage = 8 / 100 = 0.08
> baseAmount = 200.00 × 0.08 = $16.00
> ```

### 2.19 Rate Plan Quote Totals (Integration)
- **Service:** `stay-integration-core`
- **File:** `stay-integration-core/mediator/src/main/java/com/agilysys/pms/integration/mediator/processors/AvailableRatePlansDetailProcessor.java`
- **Formulas:**
  - `roomCharge = originalAmount − offerAmount + routedAmount`
  - `roomTax = totalTax − offerTax + routedTax`
  - `roomRate = roomCharge + componentCharge`
  - `quoteTotal = roomTotal + recurringChargeTotal`
  - `quoteGrandTotal = quoteTotal + quoteTotalTax`
```java
quoteGrandTotal = (quoteTotal + quoteTotalTax).setScale(2, HALF_UP);
```

> **📊 Example:** originalAmount = $200, offerAmount = $20, routedAmount = $15, totalTax = $25, offerTax = $3, routedTax = $2, componentCharge = $40, recurringChargeTotal = $45
> ```
> roomCharge  = 200 − 20 + 15 = $195.00
> roomTax     = 25 − 3 + 2 = $24.00
> roomRate    = 195 + 40 = $235.00
> quoteTotal  = (195 × 3 nights) + 45 = 585 + 45 = $630.00  (example 3-night stay)
> quoteTotalTax = 24 × 3 = $72.00
> quoteGrandTotal = 630.00 + 72.00 = $702.00
> ```

### 2.20 Group Revenue Forecasting
- **Service:** `stay-profile-service`
- **File:** `stay-profile-service/ServiceImplementation/src/main/java/com/agilysys/pms/profile/service/handler/GroupHandler.java`
- **Formulas:**
  - `forecastRevenue = basePrice × roomCount`
  - `actualRevenue = basePrice × pickUp`
```java
forecastRevenue = forecastRevenue.add(basePrice.multiply(BigDecimal.valueOf(roomCount)));
actualRevenue = actualRevenue.add(basePrice.multiply(BigDecimal.valueOf(pickUp)));
```

> **📊 Example:** basePrice = $200.00, roomCount = 50 (forecast), pickUp = 35 (actual)
> ```
> forecastRevenue = 200.00 × 50 = $10,000.00
> actualRevenue   = 200.00 × 35 = $7,000.00
> ```

---

## 3. Balance & Ledger Calculations

### 3.1 Ledger Transaction Balance
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceDomain/src/main/java/com/agilysys/pms/account/data/domain/LedgerTransaction.java`
- **Method:** `getBalance()`
- **Formula:** `balance = Σ(folioLines + ledgerLines)` where each line = `amount × quantity` or `reverseTaxTotal` if reverse tax
```java
balance = balance.add(folioLine.getAmount().multiply(new BigDecimal(folioLine.getQuantity())));
```

> **📊 Example:** Folio line 1: amount = $100, qty = 1; Folio line 2: amount = $50, qty = 2
> ```
> balance = (100 × 1) + (50 × 2) = 100 + 100 = $200.00
> ```

### 3.2 Invoice Payment Balance
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceDomain/src/main/java/com/agilysys/pms/account/data/domain/InvoicePayment.java`
- **Method:** `getBalance()`
- **Formula:** `balance = paymentAmount + Σ(refundAmounts)` (refunds are negative)
```java
for (InvoicePayment refund : refunds) {
    balance = balance.add(refund.getAmount());
}
```

> **📊 Example:** paymentAmount = $500.00, refund 1 = −$150.00
> ```
> balance = 500.00 + (−150.00) = $350.00
> ```

### 3.3 Credit Limit Remaining
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/ar/ARHandler.java`
- **Method:** `getCreditLimitLeft()`
- **Formula:** `remainingCredit = creditLimit − accountBalance`
```java
return destinationAccount.getAccountsReceivableSettings().getCreditLimit().subtract(accountBalance);
```

> **📊 Example:** creditLimit = $10,000.00, accountBalance = $3,500.00
> ```
> remainingCredit = 10,000.00 − 3,500.00 = $6,500.00
> ```

### 3.4 AR Property Balance Breakdown
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/invoice/InvoiceHandler.java`
- **Method:** `toPropertyBalanceInfo()`
- **Formulas:**
  - `invoiceTotal = Σ(aging bucket amounts)`
  - `unInvoicedTotal = accountBalanceTotal − invoiceTotal − depositBalance`
  - `balance = invoiceTotal + unInvoicedTotal + depositBalance`
  - `creditLimitBalance = creditLimit − unInvoicedTotal`
  - `availableCredit = creditLimitBalance − invoiceTotal`
```java
availableCredit = creditLimitBalance.subtract(invoiceTotal);
```

> **📊 Example:** aging buckets = [$1,000, $2,000, $500], accountBalanceTotal = $5,000, depositBalance = $200, creditLimit = $10,000
> ```
> invoiceTotal      = 1,000 + 2,000 + 500 = $3,500.00
> unInvoicedTotal   = 5,000 − 3,500 − 200 = $1,300.00
> balance           = 3,500 + 1,300 + 200 = $5,000.00
> creditLimitBalance = 10,000 − 1,300 = $8,700.00
> availableCredit   = 8,700 − 3,500 = $5,200.00
> ```

### 3.5 Company Balance Aggregation
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/invoice/InvoiceHandler.java`
- **Formula:** `companyBalance = Σ(propertyInvoiceTotals) + Σ(propertyUnInvoicedTotals) + companyDepositTotal`

> **📊 Example:** property 1 invoiceTotal = $10,000, property 2 invoiceTotal = $5,000, unInvoiced = $3,000, companyDeposit = $500
> ```
> companyBalance = 15,000 + 3,000 + 500 = $18,500.00
> ```

### 3.6 Auto-Settlement Total Balance
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/autosettlementrule/AutoSettlementRuleHandler.java`
- **Method:** `getBalanceForAutoSettlement()`
- **Formula:** `totalBalance = Σ(folioBalances) + Σ(unpostedRecurringCharge amounts + estimatedTaxes)`
```java
totalBalance = totalBalance.add(folio.getValue().getBalance().getTotal());
totalBalance = totalBalance.add(recurringCharge.getAmount());
totalBalance = totalBalance.add(recurringCharge.getEstimatedTaxInfo().getTotalTaxAmount());
```

> **📊 Example:** folio 1 balance = $250, unposted recurring charge = $50, estimated tax = $8.00
> ```
> totalBalance = 250.00 + 50.00 + 8.00 = $308.00
> ```

### 3.7 Bad Debt Validation
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/invoice/InvoiceHandler.java`
- **Formula:** `|badDebtAmount| ≤ totalExcludingBadDebt` (validation constraint)
```java
BigDecimal totalExcludingBadDebt = lineItemViews.stream()
    .filter(v -> !badDebtIds.contains(v.getId()))
    .map(LineItemView::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
```

> **📊 Example:** badDebtAmount = −$200, other line items total = $1,500
> ```
> |−200| ≤ 1,500 → 200 ≤ 1,500 → ✓ Valid (bad debt does not exceed total)
> ```

### 3.8 Folio Line Item Balances
- **Service:** `stay-reports-aggregator`
- **File:** `stay-reports-aggregator/ServiceImplementation/src/main/java/com/agilysys/pms/aggregator/foliosummary/FolioSummaryHandler.java`
- **Formulas:**
  - `totalAmount = total − adjustmentsGrandTotal + adjustmentsTax`
  - `chargesBalance = grandTotal − tax`
```java
totalAmount = summationMap.get(key).getTotalAmount()
    .subtract(summationMap.get(key).getAdjustmentsGrandTotalAmount())
    .add(summationMap.get(key).getAdjustmentsTaxAmount());
```

> **📊 Example:** total = $500, adjustmentsGrandTotal = $50, adjustmentsTax = $8, tax = $42
> ```
> totalAmount    = 500 − 50 + 8 = $458.00
> chargesBalance = 500 − 42 = $458.00
> ```

### 3.9 Credit Limit Validation (Relay)
- **Service:** `stay-relay-service`
- **File:** `stay-relay-service/ServiceImplementation/src/main/java/com/agilysys/pms/relay/handler/charge/PostChargeBaseHandler.java`
- **Formula:** `availableCredit = authorizedAmount − accountBalance`; charge fails if `amount > availableCredit`
```java
BigDecimal limit = authAmount.subtract(accountBalance);
```

> **📊 Example:** authorizedAmount = $1,000, accountBalance = $750, chargeAmount = $300
> ```
> availableCredit = 1,000 − 750 = $250.00
> 300 > 250 → Charge FAILS (insufficient credit)
> ```

### 3.10 Guest Spending Limit
- **Service:** `stay-relay-service`
- **File:** `stay-relay-service/ServiceImplementation/src/main/java/com/agilysys/pms/relay/manager/FolioProvider.java`
- **Formulas:**
  - Cash: `limit = paymentMethodLimit − expenses`
  - Credit Card: `limit = authAmountCC − expenses`
```java
limit = paymentMethodSetting.getLimit().subtract(expenses);
limit = authAmountCC.subtract(expenses);
```

> **📊 Example:** paymentMethodLimit = $500, authAmountCC = $2,000, expenses = $320
> ```
> Cash limit: 500 − 320 = $180.00
> CC limit:   2,000 − 320 = $1,680.00
> ```

---

## 4. Revenue Calculations

### 4.1 RevPAR (Revenue Per Available Room)
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/dateroll/UpdateRotationCounterParticipant.java`
- **Method:** `generateOwnerRevParModel()`
- **Formula:** `RevPAR = roomRate ÷ availableDays`
```java
BigDecimal revParValue = availableDays.equals(BigDecimal.ZERO)
    ? BigDecimal.ZERO : roomRate.divide(availableDays, 2, RoundingMode.CEILING);
```

> **📊 Example:** roomRate = $15,000 (total revenue), availableDays = 100
> ```
> RevPAR = 15,000 ÷ 100 = $150.00
> ```

### 4.2 Total Available Days
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/dateroll/UpdateRotationCounterParticipant.java`
- **Formula:** `totalAvailableDays = totalRoomNights − inventoryBlockedNights − startOffset − endOffset`

> **📊 Example:** totalRoomNights = 100, inventoryBlocked = 10, startOffset = 2, endOffset = 3
> ```
> totalAvailableDays = 100 − 10 − 2 − 3 = 85 days
> ```

### 4.3 Room Revenue Rotation Counter
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/dateroll/UpdateRotationCounterParticipant.java`
- **Formula:** `rotationCounter += (amount × quantity)` per line item (or `reverseTaxTotal` if reverse tax)
```java
rotationCounter = rotationCounter.add(
    lineItem.getAmount().multiply(BigDecimal.valueOf(lineItem.getQuantity())));
```

> **📊 Example:** existing rotationCounter = $0, line item: amount = $200, quantity = 1
> ```
> rotationCounter = 0 + (200 × 1) = $200.00
> ```

### 4.4 Player Retail Rating Total
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/dateroll/PlayerRetailRatingNotificationParticipant.java`
- **Formula:** `retailTotal = Σ(amount × quantity)` for eligible line items
```java
BigDecimal total = lineItems.stream()
    .map(li -> li.getAmount().multiply(BigDecimal.valueOf(li.getQuantity())))
    .reduce(BigDecimal.ZERO, BigDecimal::add);
```

> **📊 Example:** line item 1: amount = $50, qty = 2; line item 2: amount = $30, qty = 1
> ```
> retailTotal = (50 × 2) + (30 × 1) = 100 + 30 = $130.00
> ```

### 4.5 Average Daily Rate (ADR)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/audit/listeners/RoomTypeChangeListener.java`
- **Method:** `calculateAdr()`
- **Formula:** `ADR = totalRoomRate ÷ stayDuration`
```java
return totalRoomRate.divide(new BigDecimal(stayDuration), 2, RoundingMode.HALF_UP);
```

> **📊 Example:** totalRoomRate = $900.00, stayDuration = 5 nights
> ```
> ADR = 900.00 ÷ 5 = $180.00
> ```

### 4.6 Average Room Rate for Guest History
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/manager/GuestStayHistoryManager.java`
- **Formula:** `avgRoomRate = Σ(pastRoomRates) ÷ totalPreviousNights`
```java
guestStayHistoryDomain.setAvgRoomRate(sumRoomRateOfPastReservations
    .divide(BigDecimal.valueOf(totalPreviousNights), 2, RoundingMode.HALF_UP));
```

> **📊 Example:** sumRoomRateOfPastReservations = $5,400.00, totalPreviousNights = 30
> ```
> avgRoomRate = 5,400.00 ÷ 30 = $180.00
> ```

### 4.7 Average Nightly Rate
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/handler/ReportHandler.java`
- **Method:** `getAverageNightlyRate()`
- **Formula:** `avgNightlyRate = totalNightlyRate ÷ |departureDate − arrivalDate|`
```java
return totalNightlyRate.divide(BigDecimal.valueOf(daysInBetween), MathContext.DECIMAL32)
    .setScale(2, RoundingMode.HALF_EVEN);
```

> **📊 Example:** totalNightlyRate = $750.00, daysInBetween = 4 (arrival to departure)
> ```
> avgNightlyRate = 750.00 ÷ 4 = $187.50
> ```

### 4.8 Average Revenue per Room
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/service/aggregator/entry/AccountRevenue.java`
- **Method:** `getAverage()`
- **Formula:** `avgRevenue = amount ÷ (roomsSold + compRooms)`
```java
return getAmount().divide(getRoomsSold().add(getCompRooms()), 2, RoundingMode.HALF_EVEN);
```

> **📊 Example:** amount = $5,000.00, roomsSold = 25, compRooms = 3
> ```
> avgRevenue = 5,000.00 ÷ (25 + 3) = 5,000.00 ÷ 28 = $178.57
> ```

### 4.9 Revenue (Total / Realized / Unrealized)
- **Service:** `stay-profile-service`
- **File:** `stay-profile-service/ServiceImplementation/src/main/java/com/agilysys/pms/profile/data/domain/grc/Revenue.java`
- **Formulas:**
  - `totalRevenue = unitPrice × actual`
  - `realizedRevenue = unitPrice × pickup`
  - `unrealizedRevenue = unitPrice × remaining`

> **📊 Example:** unitPrice = $200.00, actual = 50, pickup = 35, remaining = 15
> ```
> totalRevenue      = 200.00 × 50 = $10,000.00
> realizedRevenue   = 200.00 × 35 = $7,000.00
> unrealizedRevenue = 200.00 × 15 = $3,000.00
> ```

### 4.10 Group ADR
- **Service:** `stay-profile-service`
- **File:** `stay-profile-service/ServiceImplementation/src/main/java/com/agilysys/pms/profile/service/handler/GroupHandler.java`
- **Method:** `calculateAdr()`
- **Formula:** `ADR = roomRevenue ÷ roomCount`
```java
return roomRevenue.divide(new BigDecimal(roomCount), CURRENCY_PRECISION, RoundingMode.HALF_UP);
```

> **📊 Example:** roomRevenue = $35,000.00, roomCount = 200
> ```
> ADR = 35,000.00 ÷ 200 = $175.00
> ```

### 4.11 NET Department Revenue
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/service/aggregator/impl/DepartmentRevenueAggregator.java`
- **Formula:** `NET = postings + adjustments + corrections`
```java
afterCalculationItem.put(NET, postingsAmount.add(adjustmentsAmount).add(correctionsAmount).toString());
```

> **📊 Example:** postings = $5,000, adjustments = −$200, corrections = $150
> ```
> NET = 5,000 + (−200) + 150 = $4,950.00
> ```

---

## 5. Rate Splitting (Shared Reservations)

### 5.1 Split by Reservation Count
- **Services:** `stay-rate-service`, `stay-reservation-service`
- **Files:** `SplitByReservationCountStrategy.java`, `ShareOccupancyHandler.java`, `SharedReservationManager.java`
- **Formula:** `share = total ÷ reservationCount`; `primaryShare = share + (total − share × count)` (remainder to primary)
```java
BigDecimal share = total.divide(BigDecimal.valueOf(size), 2, RoundingMode.HALF_UP);
BigDecimal remaining = total.subtract(share.multiply(BigDecimal.valueOf(size)));
primaryShare = share.add(remaining);
```

> **📊 Example:** total = $301.00, reservationCount = 3
> ```
> share     = 301.00 ÷ 3 = $100.33
> remaining = 301.00 − (100.33 × 3) = 301.00 − 300.99 = $0.01
> primaryShare   = 100.33 + 0.01 = $100.34
> secondaryShare = $100.33  (each)
> ```

### 5.2 Split by Guest Count
- **Services:** `stay-rate-service`, `stay-reservation-service`
- **Files:** `SplitByGuestCountStrategy.java`, `ShareOccupancyHandler.java`, `SharedReservationManager.java`
- **Formula:** `perGuest = ⌊total ÷ guestCount⌋`; `share = perGuest × myGuests`; `primaryShare += remainder`
```java
BigDecimal perGuestCharge = total.divide(BigDecimal.valueOf(overallGuestCount), 2, RoundingMode.DOWN);
BigDecimal remainder = total.subtract(perGuestCharge.multiply(BigDecimal.valueOf(overallGuestCount)));
```

> **📊 Example:** total = $300.00, overallGuestCount = 5, myGuests = 2, isPrimary = true
> ```
> perGuest  = ⌊300.00 ÷ 5⌋ = $60.00
> myShare   = 60.00 × 2 = $120.00
> remainder = 300.00 − (60.00 × 5) = $0.00
> primaryShare = 120.00 + 0.00 = $120.00
> ```

### 5.3 Component Rate Splitting
- **Services:** `stay-rate-service`, `stay-reservation-service`
- **Files:** `SharedReservationCalculationUtils.java`, `SharedReservationPackageComponentHandler.java`, `SharedReservationUtils.java`
- **Formula:** `componentShare = componentRate ÷ reservationCount`; primary absorbs remainder
```java
BigDecimal amountPerRate = amount.divide(divisor, 2, RoundingMode.HALF_UP);
BigDecimal remainingAmount = amount.subtract(amountPerRate.multiply(divisor));
return isPrimary ? amountPerRate.add(remainingAmount) : amountPerRate;
```

> **📊 Example:** componentRate = $91.00, reservationCount = 3, isPrimary = true
> ```
> amountPerRate   = 91.00 ÷ 3 = $30.33
> remainingAmount = 91.00 − (30.33 × 3) = 91.00 − 90.99 = $0.01
> primaryShare    = 30.33 + 0.01 = $30.34
> secondaryShare  = $30.33
> ```

### 5.4 Alpha/Delta Split (Shared Reservations)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/manager/SharedReservationManager.java`
- **Method:** `computeSplitRateSnapshots()`
- **Formula:** `alpha = rate ÷ divisor`; `delta = rate − (alpha × divisor)` (rounding correction)
```java
alphaRateSnapshot.setBaseRate(baseRate.divide(splitDivisor, 2, RoundingMode.HALF_UP));
delta = wholeValue.subtract(value.multiply(split)).setScale(2, RoundingMode.HALF_UP);
```

> **📊 Example:** rate = $301.00, splitDivisor = 3
> ```
> alpha = 301.00 ÷ 3 = $100.33
> delta = 301.00 − (100.33 × 3) = 301.00 − 300.99 = $0.01
> primary gets alpha + delta = $100.34
> ```

### 5.5 Surcharge Split (Inverse Guest Count Ratio)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/manager/SharedReservationManager.java`
- **Method:** `computeSplitSurcharges()`
- **Formula:** `ratio = singlePersonCharge ÷ Σ(splitDivisor ÷ guestCount_i)`
```java
totalChargeToAggregatedInverseRatio = singlePersonCharge.divide(sumOfInverseValues, 2, RoundingMode.HALF_UP);
```

> **📊 Example:** singlePersonCharge = $50, reservation 1: 2 guests (divisor=3), reservation 2: 3 guests (divisor=3)
> ```
> sumOfInverseValues = (3 ÷ 2) + (3 ÷ 3) = 1.50 + 1.00 = 2.50
> ratio = 50.00 ÷ 2.50 = $20.00
> ```

### 5.6 Shared Room Count Distribution (Reports)
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/service/aggregator/entry/RevenueComposite.java`
- **Formula:** `perShareCount = roomCount ÷ numShared`; primary gets remainder
```java
countToAdd = roomCount.divide(BigDecimal.valueOf(sharedReservations.size()), 2, RoundingMode.HALF_EVEN);
countToAddForPrimary = countToAdd.add(roomCount.subtract(countToAdd.multiply(BigDecimal.valueOf(size))));
```

> **📊 Example:** roomCount = 1.00, numShared = 3
> ```
> perShareCount = 1.00 ÷ 3 = 0.33
> primaryCount  = 0.33 + (1.00 − 0.33 × 3) = 0.33 + 0.01 = 0.34
> ```

### 5.7 Shared Reservation Amount Division (Account)
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/AutoRecurringManager.java`
- **Formula:** `amount = sharedCharge ÷ numberOfSharedAccounts`
```java
recurringChargeOverride.setBaseAmount(
    sharedRecurringCharge.getAmount()
        .divide(new BigDecimal(sharedAccountIds.size()), 2, RoundingMode.HALF_UP));
```

> **📊 Example:** sharedCharge = $60.00, numberOfSharedAccounts = 2
> ```
> amount = 60.00 ÷ 2 = $30.00 per account
> ```

---

## 6. Occupancy-Based Calculations

### 6.1 Occupancy Quantity Calculation
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceDomain/src/main/java/com/agilysys/pms/account/data/domain/RecurringCharge.java`
- **Method:** `calculateQuantity()`
- **Formula:** `totalPersons = adults + children + Σ(ageCategoriesNotExcluded)`

> **📊 Example:** adults = 2, children = 1, ageCategories (not excluded) = 0
> ```
> totalPersons = 2 + 1 + 0 = 3
> ```

### 6.2 Occupancy Override Amount
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/AutoRecurringManager.java`
- **Method:** `computeOverrideAmount()`
- **Formula:** `overrideAmount = Σ(categoryOverrideRate × numberOfPeopleInCategory)` for adults, children, ageCategory1..8
```java
overrideAmount = overrideAmount.add(
    overrideRateByCondition.getAdultsOverrideAmount()
        .multiply(BigDecimal.valueOf(occupancy.getNumberOfAdults())));
```

> **📊 Example:** adultsOverrideRate = $25, adults = 2; childrenOverrideRate = $15, children = 1
> ```
> overrideAmount = (25.00 × 2) + (15.00 × 1) = 50.00 + 15.00 = $65.00
> ```

### 6.3 Occupancy Rate with Components (Reservation)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/handler/OccupancyUpdateHandler.java`
- **Method:** `calculateComponentRates()`
- **Formula:** `occupancyRateToBeAdded = newOccupancyCharge − existingOccupancyCharge`; `rate = preOccupancyRate + occupancyDelta − inclusiveCharge`
```java
occupancyRateToBeAdded = newOccupancyCharge.subtract(existingOccupancyCharge);
rate = rateSnapshot.getPreOccupancyRate().add(occupancyRateToBeAdded).subtract(inclusiveCharge);
```

> **📊 Example:** preOccupancyRate = $180, newOccupancyCharge = $220, existingOccupancyCharge = $200, inclusiveCharge = $15
> ```
> occupancyRateToBeAdded = 220 − 200 = $20.00
> rate = 180 + 20 − 15 = $185.00
> ```

### 6.4 Room Rate Redistribution to Components
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/handler/OccupancyUpdateHandler.java`
- **Method:** `splitRoomRateToComponents()`
- **Formula:** When room rate < inclusive components: `perUnit = remaining ÷ quantity`, `roundOffAmount += remaining − (perUnit × quantity)`
```java
componentRateSnapshot.setAmount(
    remaining.divide(BigDecimal.valueOf(totalQuantity), 2, RoundingMode.DOWN));
```

> **📊 Example:** remaining = $50.00, totalQuantity = 3
> ```
> perUnit = ⌊50.00 ÷ 3⌋ = $16.66 (RoundingMode.DOWN)
> roundOffAmount = 50.00 − (16.66 × 3) = 50.00 − 49.98 = $0.02
> ```

### 6.5 Occupancy Percentage (Property)
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/availability/matrix/AvailabilityMatrix.java`
- **Formula:** `occupancyPct = (dividend × 100) ÷ divisor`
```java
getByDate(dividend, date).multiply(new BigDecimal(100)).divide(divisorValue, MATH_CONTEXT);
```

> **📊 Example:** dividend (occupied rooms) = 80, divisor (total rooms) = 100
> ```
> occupancyPct = (80 × 100) ÷ 100 = 80.00%
> ```

---

## 7. Authorization Calculations

### 7.1 Total Due at Checkout (TDAC)
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/common-interface/src/main/java/com/agilysys/pms/property/model/AuthorizationSettings.java`
- **Enum:** `TOTAL_DUE_AT_CHECKOUT`
- **Formula:** `auth = estimatedTotal + value% × (estimatedTotal + postedPayment)`
```java
estimatedTotal + value * (estimatedTotal + postedPayment) / 100;
```

> **📊 Example:** estimatedTotal = $500, postedPayment = −$200, value = 10%
> ```
> auth = 500 + 10% × (500 + (−200))
>      = 500 + 0.10 × 300 = 500 + 30 = $530.00
> ```

### 7.2 RTDC Percentage
- **Formula:** `auth = value% × (postedRoomCharges + postedRoomTaxes + futureRoomChargeTotal)`
```java
value * (postedRoomCharges + postedRoomTaxes + futureRoomChargeTotal) / 100;
```

> **📊 Example:** value = 15%, postedRoomCharges = $600, postedRoomTaxes = $90, futureRoomChargeTotal = $300
> ```
> auth = 15% × (600 + 90 + 300) = 0.15 × 990 = $148.50
> ```

### 7.3 RTDC Per-Person
- **Formula:** `auth = value × numberOfPersons × maximumDaysToAuthorize`
```java
value * numberOfPersons * maximumDaysToAuthorize;
```

> **📊 Example:** value = $50/person, numberOfPersons = 3, maximumDaysToAuthorize = 5
> ```
> auth = 50 × 3 × 5 = $750.00
> ```

### 7.4 Percentage Authorization with Per-Person
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/RecurringChargesHandler.java`
- **Formula:** `roomCharge = value% × (RTDC + ARC revenue + packageComponents) ÷ 100 + perPersonValue`
```java
roomCharge = value.multiply(rtdcCharges.add(arcRoomRevenue).add(packageComponentCharges))
    .divide(ONE_HUNDRED, 2, BigDecimal.ROUND_HALF_UP).add(perPersonValue);
```

> **📊 Example:** value = 10%, RTDC = $600, ARC revenue = $100, packageComponents = $50, perPersonValue = $75
> ```
> roomCharge = 10 × (600 + 100 + 50) ÷ 100 + 75
>           = 10 × 750 ÷ 100 + 75 = 75.00 + 75.00 = $150.00
> ```

### 7.5 Per-Person Authorization (Per Stay / Per Diem)
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/RecurringChargesHandler.java`
- **Formulas:**
  - Per Stay: `personValue = perPersonValue × numberOfPersons`
  - Per Diem: `personValue = perPersonValue × numberOfPersons × maxDaysToAuthorize`

> **📊 Example:** perPersonValue = $50/person, numberOfPersons = 2, maxDaysToAuthorize = 3
> ```
> Per Stay: personValue = 50 × 2 = $100.00
> Per Diem: personValue = 50 × 2 × 3 = $300.00
> ```

### 7.6 Auth Decrement / Increment (Payment)
- **Service:** `stay-payment-service`
- **File:** `stay-payment-service/ServiceImplementation/src/main/java/com/agilysys/pms/payment/rguestpay/TransactionFacade.java`
- **Formulas:**
  - `decrementedAmount = authAmount − authorizedAmount`
  - `incrementalAmount = grandTotalAmount − currentAuthAmount`
  - `newAuthAmount = existingAuthAmount + authorizedAmount`

> **📊 Example:** authAmount = $1,000, authorizedAmount = $800, grandTotalAmount = $1,200, existingAuth = $800
> ```
> decrementedAmount = 1,000 − 800 = $200.00
> incrementalAmount = 1,200 − 1,000 = $200.00
> newAuthAmount     = 800 + 200 = $1,000.00
> ```

---

## 8. Deposit Calculations

### 8.1 Entire Stay Deposit (Percentage)
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/AvailabilityHandler.java`
- **Method:** `getCalculatedChargeBasedOnChargeType()`
- **Formula:** `entireStayDeposit = percentageOfStay × 0.01 × totalReservationCharge`
```java
return percentageOfStay.multiply(percentageConversion)
    .multiply(getTotalChargeFromReservation(...)).setScale(2, RoundingMode.HALF_EVEN);
```

> **📊 Example:** percentageOfStay = 50%, totalReservationCharge = $900.00
> ```
> entireStayDeposit = 50 × 0.01 × 900.00 = $450.00
> ```

### 8.2 Per-Guest Deposit Amount
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/AvailabilityHandler.java`
- **Method:** `getTotalDepositAmountForPerPerson()`
- **Formula:** `perGuestDeposit = (perAdultRate × numAdults) + (perChildRate × numChildren)`
```java
totalAmount = totalAmount.add(perAdultValue.multiply(BigDecimal.valueOf(totalAdult)));
totalAmount = totalAmount.add(perChildValue.multiply(BigDecimal.valueOf(totalChild)));
```

> **📊 Example:** perAdultRate = $75, numAdults = 2, perChildRate = $40, numChildren = 1
> ```
> perGuestDeposit = (75 × 2) + (40 × 1) = 150 + 40 = $190.00
> ```

### 8.3 Deposit Due Capping
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/AvailabilityHandler.java`
- **Formula:** `excess = cumulativeScheduleTotal − totalReservationCharge`; `collectible = dueAmount − excess`
```java
BigDecimal excessAmount = afterScheduleTotal.subtract(totalReservationCharge);
BigDecimal amountToBeCollected = scheduledDepositDue.getTotalDueAmount().subtract(excessAmount);
```

> **📊 Example:** cumulativeScheduleTotal = $1,000, totalReservationCharge = $900, dueAmount = $500
> ```
> excess      = 1,000 − 900 = $100.00
> collectible = 500 − 100 = $400.00
> ```

### 8.4 Group Deposit — Remaining / Collected / Split
- **Service:** `stay-profile-service`
- **File:** `stay-profile-service/ServiceImplementation/src/main/java/com/agilysys/pms/profile/service/handler/GroupDepositHandler.java`
- **Formulas:**
  - `remainingDeposit = totalDue − totalCollected`
  - `excessDeposit = remainingAmount − splitAmount`
  - `remainingSplit = splitAmount − toCollect`
  - `remainingAmount = max(splitAmount − toCollect, 0)`
```java
BigDecimal remainingAmount = depositDue.getTotalDueAmount().subtract(totalCollectedAmount);
split.setAmount(splitAmount.subtract(toCollect).max(BigDecimal.ZERO));
```

> **📊 Example:** totalDue = $1,000, totalCollected = $600, splitAmount = $300, toCollect = $250
> ```
> remainingDeposit = 1,000 − 600 = $400.00
> excessDeposit    = 400 − 300 = $100.00
> remainingSplit   = max(300 − 250, 0) = $50.00
> ```

### 8.5 Deposit Rate Snapshot (Nightly Charge)
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/common-interface/src/main/java/com/agilysys/common/model/DepositRateSnapshot.java`
- **Method:** `getChargeForRateSnapshot()`
- **Formula:** `rate = preOccupancyRate + Σ(extraCategoryCharge × extraCount) + arcRates − negatedCharges − offerAmount − routedAmount`

> **📊 Example:** preOccupancyRate = $180, extraAdultCharge = $25 (1 extra), arcRates = $20, negatedCharges = $5, offerAmount = $10, routedAmount = $15
> ```
> rate = 180 + 25 + 20 − 5 − 10 − 15 = $195.00
> ```

---

## 9. Allowance & Package Calculations

### 9.1 Remaining Allowance
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/PackageFolioChargesHandler.java`
- **Methods:** `calculateRemainingAllowance()` / `calculateLineItemAllowanceAmount()`
- **Formulas:**
  - `remainingAllowance = lineItemAmount < remaining ? remaining − lineItemAmount : 0`
  - `lineItemExcess = lineItemAmount > remaining ? lineItemAmount − remaining : 0`
  - `spent = totalAllowance − remainingAllowance`
  - `breakageCharge = allowanceCharge − spent`
```java
remainingAllowance = lineItemAmount < remainingAllowance
    ? remainingAllowance.subtract(lineItemAmount) : BigDecimal.ZERO;
breakageCharge = allowanceCharge.subtract(spent);
```

> **📊 Example:** totalAllowance = $200, lineItem1 = $100, lineItem2 = $80, allowanceCharge = $200
> ```
> After item 1: remaining = 200 − 100 = $100, excess = $0
> After item 2: remaining = 100 − 80 = $20,   excess = $0
> spent    = 200 − 20 = $180
> breakage = 200 − 180 = $20.00  (unused allowance)
> ```

### 9.2 Allowance as Negative Charge (Credit)
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/PackageFolioChargesHandler.java`
- **Formula:** `chargeAmount = −allowanceAmount` (posted as credit)

> **📊 Example:** allowanceAmount = $75.00
> ```
> chargeAmount = −$75.00  (posted as credit on folio)
> ```

### 9.3 Enhancement Item Total
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/RecurringChargesHandler.java`
- **Formula:** `totalTaxableAmount = defaultPrice × requestedQuantity × numberOfDates`
```java
totalTaxableAmount = selectedEnhancementItem.getDefaultPrice()
    .multiply(new BigDecimal(getRequestedQuantity(...)));
totalTaxableAmount = totalTaxableAmount.multiply(new BigDecimal(transactionDates.size()));
```

> **📊 Example:** defaultPrice = $25.00, requestedQuantity = 3, numberOfDates = 4
> ```
> totalTaxableAmount = 25.00 × 3 = $75.00 (per date)
> totalTaxableAmount = 75.00 × 4 = $300.00 (all dates)
> ```

---

## 10. Cancellation Fee Calculations

### 10.1 Cancellation Fee — Percentage of Nightly Rate
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/Common/src/main/java/com/agilysys/pms/common/impl/CancellationFeeCalculator.java`
- **Method:** `calculateFeeIfGetPercentageIsNotNull()`
- **Formula:** `fee = Σ(percentage% × nightlyRate)` across applicable stay dates
```java
fee = fee.add(getPercentage(policy, policySchedule).movePointLeft(2).multiply(rate));
```

> **📊 Example:** percentage = 50%, night 1 rate = $200, night 2 rate = $180
> ```
> fee = (0.50 × 200) + (0.50 × 180) = 100 + 90 = $190.00
> ```

### 10.2 Cancellation Fee — N Nights
- **Method:** `calculateFeeIfGetNightIsNotNull()`
- **Formula:** `fee = Σ(nightlyRate)` for first N nights
```java
fee = fee.add(rate);  // for up to N nights
```

> **📊 Example:** N = 2 nights, night 1 rate = $200, night 2 rate = $180
> ```
> fee = 200 + 180 = $380.00
> ```

### 10.3 Override Cancellation Fee
- **Method:** `calculateFee()`
- **Formula:** `overrideFee = overridePercentage% × originalFee`
```java
fee = overridePercentage.movePointLeft(2).multiply(fee);
```

> **📊 Example:** originalFee = $190.00, overridePercentage = 75%
> ```
> overrideFee = 0.75 × 190.00 = $142.50
> ```

---

## 11. Commission Calculations

### 11.1 Commission Amount (Percentage-Based)
- **Service:** `stay-profile-service`
- **File:** `stay-profile-service/ServiceImplementation/src/main/java/com/agilysys/pms/profile/service/function/CommissionCalculationStrategy.java`
- **Method:** `calculateAmount()`
- **Formula:** `commission = ratePlanTotal × percentage × 0.01` (or flat fee if configured)
```java
ratePlanTotal.multipliedBy(dailyPercentage).multipliedBy(0.01, RoundingMode.HALF_EVEN);
```

> **📊 Example:** ratePlanTotal = $900.00, dailyPercentage = 10%
> ```
> commission = 900.00 × 10 × 0.01 = $90.00
> ```

### 11.2 Commission Percentage Back-Calculation
- **Formula:** `commissionPct = (commissionAmount ÷ roomRate) × 100`
```java
percentage = percentageAmount.dividedBy(roomRate.getAmount(), RoundingMode.HALF_EVEN)
    .multipliedBy(100).getAmount().intValue();
```

> **📊 Example:** commissionAmount = $90.00, roomRate = $900.00
> ```
> commissionPct = (90.00 ÷ 900.00) × 100 = 0.10 × 100 = 10%
> ```

---

## 12. Foreign Exchange Calculations

### 12.1 Forex Exchange Value
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/data/domain/ForexConversionDomain.java`
- **Method:** `calculateExchangeValue()`
- **Formulas:**
  - Flat Fee: `exchangeValue = conversionRate + surcharge`
  - Percentage: `exchangeValue = conversionRate + (conversionRate × surcharge / 100)`
```java
// FLAT_FEE:
return conversionRate.add(surcharge);
// PERCENTAGE:
BigDecimal surchargeValue = conversionRate.multiply(surcharge.divide(new BigDecimal(100)));
return conversionRate.add(surchargeValue);
```

> **📊 Example:** conversionRate = 1.25 (USD to EUR), surcharge = 0.05 (flat) or 2% (percentage)
> ```
> Flat Fee:    exchangeValue = 1.25 + 0.05 = 1.30
> Percentage:  surchargeValue = 1.25 × (2 / 100) = 0.025
>              exchangeValue = 1.25 + 0.025 = 1.275
> ```

---

## 13. Casino Points / CMS Calculations

### 13.1 Points to Monetary Value Conversion
- **Service:** `stay-integration-core`
- **File:** `stay-integration-core/mediator/src/main/java/com/agilysys/pms/integration/mediator/handlers/CmsHandler.java`
- **Method:** `calculateConversionRate()`
- **Formula:** `balanceAmount = conversionRate × pointBalance`
```java
balanceAmount = conversionRate * balance;
```

> **📊 Example:** conversionRate = 0.05 ($/point), pointBalance = 10,000 points
> ```
> balanceAmount = 0.05 × 10,000 = $500.00
> ```

### 13.2 Monetary Value to Points (IGT)
- **Service:** `stay-integration-modulesa`
- **File:** `stay-integration-modulesa/igt/src/main/java/com/agilysys/pms/integration/igt/transformer/PlayerPointRedemptionReqOutTransformer.java`
- **Formula:** `quantity = amount ÷ pointsConversionRate`

> **📊 Example:** amount = $100.00, pointsConversionRate = 0.05 ($/point)
> ```
> quantity = 100.00 ÷ 0.05 = 2,000 points
> ```

### 13.3 Points to Dollar Value (Aristocrat)
- **Service:** `stay-integration-modulesb`
- **File:** `stay-integration-modulesb/aristocrat/src/main/java/com/agilysys/pms/integration/aristocrat/transformer/PlayerPointsResponseInTransformer.java`
- **Formula:** `dollarValue = ⌊pointBalance ÷ conversionRate⌋` (floored)
```java
pointTypeBalAmt = pointBalance.divide(conversionRate, 2, RoundingMode.FLOOR);
```

> **📊 Example:** pointBalance = 10,000 points, conversionRate = 100 (points/$)
> ```
> dollarValue = ⌊10,000 ÷ 100⌋ = $100.00
> ```

### 13.4 Dollar to Points for Redemption (Aristocrat)
- **File:** `stay-integration-modulesb/aristocrat/src/main/java/com/agilysys/pms/integration/aristocrat/transformer/PostRedemptionRequestOutTransformer.java`
- **Formula:** `points = ⌊amount × conversionRate⌋`
```java
redemption.amount = amount.multiply(conversionRate).setScale(0, RoundingMode.FLOOR);
```

> **📊 Example:** amount = $50.00, conversionRate = 100 (points/$)
> ```
> points = ⌊50.00 × 100⌋ = 5,000 points
> ```

### 13.5 Comp Balance After Redemption
- **Service:** `stay-integration-core`
- **File:** `stay-integration-core/mediator/src/main/java/com/agilysys/pms/integration/mediator/handlers/CasinoPointsHandler.java`
- **Formulas:**
  - `authorizedRemaining = authorizedPerStay − redeemedAmount`
  - `ineligibleComp = accountBalance − eligibleValueForPlayer`
  - `redeemedAmount = amountPerStay − balancePerDay`

> **📊 Example:** authorizedPerStay = $500, redeemedAmount = $150, accountBalance = $800, eligibleValue = $500, amountPerStay = $500, balancePerDay = $350
> ```
> authorizedRemaining = 500 − 150 = $350.00
> ineligibleComp     = 800 − 500 = $300.00
> redeemedAmount     = 500 − 350 = $150.00
> ```

---

## 14. Comp Accounting Calculations

### 14.1 Comp Per-Day Balance
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/compaccounting/CompAuthorizerHandler.java`
- **Method:** `updatePerDayCompBalance()`
- **Formula:** `newBalance = currentBalance − compAmount`
```java
amountPerDayBalances.put(propertyDate, amountPerDayBalances.get(propertyDate).subtract(compAmount));
```

> **📊 Example:** currentBalance = $500.00, compAmount = $120.00
> ```
> newBalance = 500.00 − 120.00 = $380.00
> ```

### 14.2 Comp Balance Recalculation
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/compaccounting/CompAccountingBaseHandler.java`
- **Formula:** `redeemed = oldAmountPerStay − oldBalance`; `newBalance = newAmountPerStay − redeemed`
```java
BigDecimal redeemedAmount = oldAmountPerStay.subtract(oldBalance);
BigDecimal amountPerDayBalance = newAmountPerStay.subtract(redeemedAmount);
```

> **📊 Example:** oldAmountPerStay = $500, oldBalance = $350, newAmountPerStay = $600
> ```
> redeemed   = 500 − 350 = $150.00
> newBalance = 600 − 150 = $450.00
> ```

### 14.3 Comp Restriction Consecutive Window
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/CompRateBuilder.java`
- **Formula:** `windowTotal = Σ compedRates[window]`; tracks max consecutive window for comp restrictions

> **📊 Example:** consecutive window of 3 days: compedRates = [$200, $180, $210]
> ```
> windowTotal = 200 + 180 + 210 = $590.00
> ```

---

## 15. Payment & Credit Calculations

### 15.1 Excess Payment Amount
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/handler/PaymentRequestHandler.java`
- **Formula:** `excessAmount = paymentAmount − invoiceTotal` (when payment exceeds balance)
```java
excessAmount = postPayment.getAmount().subtract(invoice.getBalance().getTotal());
```

> **📊 Example:** paymentAmount = $600.00, invoiceTotal = $450.00
> ```
> excessAmount = 600.00 − 450.00 = $150.00
> ```

### 15.2 POS Cents to Dollars Conversion
- **Service:** `stay-igconnector-service`
- **File:** `stay-igconnector-service/service/src/main/java/com/agilysys/pms/igconnector/service/pos/data/model/PostRequest.java`
- **Method:** `toChargeAmount()`
- **Formula:** `dollars = cents ÷ 100`
```java
return BigDecimal.valueOf(amount).divide(ONE_HUNDRED, 2, RoundingMode.HALF_EVEN);
```

> **📊 Example:** amount = 1,500 cents
> ```
> dollars = 1,500 ÷ 100 = $15.00
> ```

### 15.3 POS Dollars to Cents Conversion
- **Service:** `stay-igconnector-service`
- **File:** `stay-igconnector-service/service/src/main/java/com/agilysys/pms/igconnector/service/pos/data/model/AccountDetail.java`
- **Formula:** `cents = dollars × 100`
```java
balanceAmount = folio.getAccountBalance().multiply(ONE_HUNDRED).longValue();
```

> **📊 Example:** dollars = $15.00
> ```
> cents = 15.00 × 100 = 1,500 cents
> ```

### 15.4 POS Net Charge
- **Service:** `stay-relay-service`
- **File:** `stay-relay-service/ServiceImplementation/src/main/java/com/agilysys/pms/relay/handler/charge/PostPosChargeHandler.java`
- **Formula:** `netCharge = grossCharge − prepaymentAmount`
```java
BigDecimal chargeAmount = new BigDecimal(postCharge.getChargeAmount())
    .subtract(new BigDecimal(postCharge.getPrepaymentAmount()));
```

> **📊 Example:** grossCharge = $45.00, prepaymentAmount = $10.00
> ```
> netCharge = 45.00 − 10.00 = $35.00
> ```

### 15.5 Phone Call Charge with Free Allowance
- **Service:** `stay-relay-service`
- **File:** `stay-relay-service/ServiceImplementation/src/main/java/com/agilysys/pms/relay/handler/charge/PostCallChargeHandler.java`
- **Formula:** `billableAmount = total − min(dailyAllowance − used, total)`
```java
BigDecimal freeAllowanceAmount = dailyAllowanceAmount.compareTo(calculatedAmount) >= 0
    ? amount : dailyAllowanceAmount.subtract(freeAllowanceCharges);
charge.setAmount(amount.subtract(freeAllowanceAmount));
```

> **📊 Example:** total call amount = $12.00, dailyAllowance = $5.00, alreadyUsed = $2.00
> ```
> freeAllowanceRemaining = 5.00 − 2.00 = $3.00
> billableAmount = 12.00 − min(3.00, 12.00) = 12.00 − 3.00 = $9.00
> ```

---

## 16. Reporting Aggregation Formulas

### 16.1 Nightly Room Charge
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/handler/ReportHandler.java`
- **Formula:** `nightlyRoomCharge = Σ(recurringCharge.amount + componentCharge)` per date
```java
nightlyRoomCharge = nightlyRoomCharge.add(recurringCharge.getAmount()).add(componentCharge);
```

> **📊 Example:** recurringCharge.amount = $200, componentCharge = $35
> ```
> nightlyRoomCharge = 200 + 35 = $235.00
> ```

### 16.2 Day Total
- **Formula:** `dayTotal = nightlyRoomCharge + todayRecurringCharge + totalTax`
```java
BigDecimal dayTotal = nightlyRoomCharge.add(todaySummaryRecurringCharge).add(totalTax);
```

> **📊 Example:** nightlyRoomCharge = $235, todayRecurringCharge = $50, totalTax = $28.50
> ```
> dayTotal = 235 + 50 + 28.50 = $313.50
> ```

### 16.3 Day Total with Comp
- **Formula:** `dayTotalWithComp = roomChargeWithComp + recurringChargeWithComp + taxWithComp`
- Where: `compedAmount = compedTotal − compedTax`; `chargeWithComp = (amount + component) − compedAmount`
```java
compedAmount = recurringCharge.getCompedAmount().subtract(compedTaxAmount);
nightlyRoomChargeWithComp += (amount + componentCharge) - compedAmount;
```

> **📊 Example:** amount = $200, componentCharge = $35, compedTotal = $80, compedTax = $10
> ```
> compedAmount = 80 − 10 = $70.00
> chargeWithComp = (200 + 35) − 70 = $165.00
> ```

### 16.4 Average Night Package Gross
- **Formula:** `avgNightPackageGross = nightPackageGrossWithTax ÷ numberOfNights`
```java
averageNightPackageGrossWithTax = nightPackageGrossWithTax.divide(noOfNights, 2, RoundingMode.HALF_UP);
```

> **📊 Example:** nightPackageGrossWithTax = $150.00, numberOfNights = 3
> ```
> avgNightPackageGross = 150.00 ÷ 3 = $50.00
> ```

### 16.5 Future Charges Summary
- **Formulas:**
  - `futureCharges = Σ(dayTotal − tax)`
  - `futureTaxes = Σ(tax)`
  - `futureTotal = Σ(dayTotal)`

> **📊 Example:** 3-night stay, dayTotals = [$313.50, $313.50, $313.50], taxes = [$28.50, $28.50, $28.50]
> ```
> futureCharges = (313.50 − 28.50) × 3 = $855.00
> futureTaxes   = 28.50 × 3 = $85.50
> futureTotal   = 313.50 × 3 = $940.50
> ```

### 16.6 Total Excluding Routed Charges
- **Formula:** `totalExcludingRouted = |estimatedAtCheckout − totalRoutedCharges|`
```java
if (totalRoutedCharges.compareTo(estimatedAtCheckout) > 0)
    totalExcludingRoutedCharges = totalRoutedCharges.subtract(estimatedAtCheckout);
else
    totalExcludingRoutedCharges = estimatedAtCheckout.subtract(totalRoutedCharges);
```

> **📊 Example:** estimatedAtCheckout = $1,200, totalRoutedCharges = $300
> ```
> totalExcludingRouted = |1,200 − 300| = $900.00
> ```

### 16.7 Component Charge (Report)
- **Formula:** `componentCharge = Σ(component.totalAmount)` or `Σ(component.estimatedTax)` depending on mode
```java
return components.stream()
    .filter(c -> c.getTotalQuantity() > 0 && (!c.isAddOn() || includeAddOn))
    .map(c -> calculateCharge(c, calculateTax))
    .reduce(BigDecimal.ZERO, BigDecimal::add);
```

> **📊 Example:** component 1: totalAmount = $35, component 2: totalAmount = $20
> ```
> componentCharge = 35 + 20 = $55.00
> ```

### 16.8 Charge Rate × Quantity (Reports)
- **Services:** `stay-report-service`
- **Files:** `ChargeAggregator.java`, `ShiftAggregator.java`, `TransactionAggregator.java`, `DepartmentRevenueAggregator.java`
- **Formula:** `itemTotal = amount × quantity`
```java
BigDecimal itemSum = item.getAmount().multiply(new BigDecimal(item.getQuantity()));
BigDecimal total = rate.add(tax);
```

> **📊 Example:** amount = $50.00, quantity = 3
> ```
> itemTotal = 50.00 × 3 = $150.00
> ```

---

## 17. Yield Rate Calculations

### 17.1 Yielded Rate Computation
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/RateYielder.java`
- **Method:** `computeYieldedRate()`
- **Formula:** `yieldedRate = max(minRate, actualRate + Σ modifiers)` or `flatRate` if applied
```java
return flatRateApplied ? flatRate : actualRate.add(aggregatedModifier);
if (rate.compareTo(ruleSet.getMinimumRate()) < 0) rate = ruleSet.getMinimumRate();
```

> **📊 Example:** actualRate = $180, aggregatedModifier = −$15, minRate = $120
> ```
> yieldedRate = max(120, 180 + (−15)) = max(120, 165) = $165.00
> ```

### 17.2 Yield Modifier Values
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/common-interface/src/main/java/com/agilysys/pms/rates/model/YieldApplyOnLevelBy.java`
- **Formulas:**
  - `PERCENT`: `modifier = resultValue × rate × 0.01`
  - `FLAT_RATE`: `modifier = resultValue` (passthrough)
  - `DECREASE_BY`: modifier is negated

> **📊 Example:** resultValue = 1.10, rate = $200.00
> ```
> PERCENT:   modifier = 1.10 × 200.00 × 0.01 = $2.20
> FLAT_RATE: modifier = $1.10 (passthrough)
> ```

---

## 18. Estimated Charges Summary

### 18.1 Estimated Charges Totals
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/RecurringChargesHandler.java`
- **Method:** `buildEstimatedChargesSummary()`
- **Formulas:**
  - `estimatedCharges = postedCharges + futureCharges`
  - `estimatedTotal = estimatedCharges + estimatedTaxes`
  - `postedTotal = postedCharges + postedTaxes`
  - `futureTotal = futureCharges + futureTaxes`
  - `futureRoomTotal = futureRoomCharges + futureRoomTaxes − inclusiveComponentsRoomRevenueTaxTotal`
  - `roomRate = estimatedRoomCharges ÷ stayLength` (average nightly rate)
  - `total = futureCharges + postedCharges + futureTaxes + postedTaxes`
  - `estimatedAtCheckout = total + postedPayments` (payments are negative)

> **📊 Example:** postedCharges = $600, futureCharges = $400, postedTaxes = $72, futureTaxes = $48, postedPayments = −$300, stayLength = 5
> ```
> estimatedCharges = 600 + 400 = $1,000.00
> estimatedTaxes   = 72 + 48 = $120.00
> estimatedTotal   = 1,000 + 120 = $1,120.00
> postedTotal      = 600 + 72 = $672.00
> futureTotal      = 400 + 48 = $448.00
> roomRate (avg)   = 600 ÷ 5 = $120.00/night
> total            = 400 + 600 + 48 + 72 = $1,120.00
> estimatedAtCheckout = 1,120 + (−300) = $820.00
> ```

### 18.2 Estimated Room Charges
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/consumer/BatchGroupReservationStagingConsumer.java`
- **Formula:** `estimatedCharges = dailyRate × numberOfNights`
```java
estimatedCharges = estimatedRoomRate.multiply(new BigDecimal(getDaysBetweenDates(arrivalDate, departureDate)));
```

> **📊 Example:** dailyRate = $200, numberOfNights = 3
> ```
> estimatedCharges = 200 × 3 = $600.00
> ```

### 18.3 Balance Due (SMS)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/handler/helper/SMSMessageManagerHelper.java`
- **Formula:** `balanceDue = estimatedCharges − postedPayments`

> **📊 Example:** estimatedCharges = $900.00, postedPayments = $350.00
> ```
> balanceDue = 900 − 350 = $550.00
> ```

---

## 19. Utility / Rounding Calculations

### 19.1 Amount × Quantity (Universal Pattern)
Used extensively across the entire application for computing totals:
- **Formula:** `total = unitAmount × quantity`
- **Found in:**
  - `RecurringCharge.getAmount()` — `amount × quantity`
  - `ComponentRateSnapshot` — `amount × realizedQuantity`
  - `ComponentHelper.getTotalAmount()` — `amount × quantity`
  - `PantryItemDetails.getAmount()` — `price × quantity`
  - `Charge` constructor — `lineItemAmount + adjustmentsTotalAmount`
  - `BookingEstimatedChargesRequest` — `overriddenCharge × quantity`

> **📊 Example:** unitAmount = $50.00, quantity = 3
> ```
> total = 50.00 × 3 = $150.00
> ```

### 19.2 Per-Unit Amount Division
Used when splitting a total back into per-unit values:
- **Formula:** `perUnit = totalAmount ÷ quantity` (rounded HALF_UP to 2 decimals)
- **Found in:** `LineItemMapping.java`, `RecurringChargeHelper.java`, `ReservationHandler.java` (integration)

> **📊 Example:** totalAmount = $300.00, quantity = 3
> ```
> perUnit = 300.00 ÷ 3 = $100.00
> ```

### 19.3 Rounding Remainder
- **Service:** `stay-integration-core`
- **File:** `stay-integration-core/mediator/src/main/java/com/agilysys/pms/integration/mediator/handlers/ReservationHandler.java`
- **Method:** `calculateRoundingRemainder()`
- **Formula:** `perUnit = amount ÷ quantity (DOWN)`; `remainder = amount − (perUnit × quantity)`

> **📊 Example:** amount = $301.00, quantity = 3
> ```
> perUnit = ⌊301.00 ÷ 3⌋ = $100.33 (RoundingMode.DOWN)
> remainder = 301.00 − (100.33 × 3) = 301.00 − 300.99 = $0.01
> ```

### 19.4 Pagination
- **Formula:** `totalPages = ⌈totalCount ÷ pageSize⌉`
- **Found in:** `TransactionRepository.java` (igconnector), `ApplianceTransactionRepository.java` (relay), `GuestProfileHandler.java` (profile)
```java
(int) Math.ceil((double) count / pageSize);
```

> **📊 Example:** totalCount = 250, pageSize = 50
> ```
> totalPages = ⌈250 ÷ 50⌉ = 5
> ```

### 19.5 Maximum Reference Number
- **Service:** `stay-relay-service`
- **File:** `stay-relay-service/ServiceImplementation/src/main/java/com/agilysys/pms/relay/handler/reference/ReferenceHandler.java`
- **Formula:** `maxValue = 10^digits − 1`
```java
return (long) Math.pow(10, numberOfDigits) - 1;
```

> **📊 Example:** numberOfDigits = 6
> ```
> maxValue = 10^6 − 1 = 999,999
> ```

### 19.6 Standard Monetary Rounding
Applied across all financial operations: `.setScale(2, RoundingMode.HALF_UP)` for standard rounding, `.setScale(2, RoundingMode.HALF_EVEN)` for banker's rounding.

> **📊 Example:** value = 10.125
> ```
> HALF_UP (standard):  10.125 → $10.13
> HALF_EVEN (banker's): 10.125 → $10.12  (rounds to even)
> ```

### 19.7 Day of Week (Modular Arithmetic)
- **Formula:** `dayIndex = Math.floorMod(getDayValueOfWeek(date), 7)`
- **Found in:** `RoutingRuleHandler.java`, `RateSnapshotValidator.java`

> **📊 Example:** date = Thursday (day value = 4)
> ```
> dayIndex = Math.floorMod(4, 7) = 4
> ```

### 19.8 Housekeeping Point Rounding
- **Service:** `stay-reports-aggregator`
- **File:** `stay-reports-aggregator/ServiceImplementation/src/main/java/com/agilysys/pms/aggregator/hkassignment/Batch4.java`
- **Formula:** `allotted = Math.round(utilizedPoints × 100.0) / 100.0` (2 decimal rounding)

> **📊 Example:** utilizedPoints = 7.456
> ```
> allotted = Math.round(7.456 × 100.0) / 100.0 = round(745.6) / 100 = 746 / 100 = 7.46
> ```

---

## Quick Reference: Formulas by Service

| Service | # Formulas | Key Areas |
|---------|-----------|-----------|
| **stay-account-service** | 39 | Balances, Tax, Recurring Charges, Allowances, Authorization, Revenue, Splits |
| **stay-rate-service** | 30 | Rate Adjustments, Yields, Occupancy, Components, Discounts, LRV, Shared Splits |
| **stay-reservation-service** | 46 | Rate Splitting, Occupancy, Averages, Deposits, Revenue, Duration |
| **stay-pms-common** | 25 | Daily Rates, Deposits, Components, Authorization, Tax, Yield Modifiers, Cancellation |
| **stay-report-service** | 18 | Day Totals, Revenue Averages, Comp Adjustments, Component Charges |
| **stay-property-service** | 12 | Forex, Deposits, Occupancy %, Comp Accounting, Availability |
| **stay-integration-core** | 15 | Rate Snapshots, Casino Points, Rounding, Quote Totals |
| **stay-integration-modulesa** | 3 | IGT Point Conversions, Open API Charges |
| **stay-integration-modulesb** | 10 | Aristocrat/SG Point Conversions, rBook/Synxis Rates |
| **stay-profile-service** | 12 | Commissions, Group Revenue, ADR, Deposits, Revenue |
| **stay-relay-service** | 10 | Credit Limits, POS Conversions, Spending Limits, Call Charges |
| **stay-payment-service** | 4 | Auth Increment/Decrement |
| **stay-reports-aggregator** | 8 | Estimated Charges, Folio Balances, HK Points, Avg Rates |
| **stay-igconnector-service** | 3 | POS Cents↔Dollars |
