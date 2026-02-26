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

### 1.3 Reverse Tax with Excluded Inclusive Tax
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/tax/TaxesHandler.java`
- **Formula:** For group deposit proforma with excluded inclusive tax: `reverseTaxTotal = reverseTaxTotal + taxExcludedAmount`
```java
reverseTaxTotalChargeAmount = reverseTaxTotalChargeAmount.add(taxExcludedAmount);
amount = amount.add(taxExcludedAmount);
```

### 1.4 Negate Allowance Package Folio Tax
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/tax/TaxesHandler.java`
- **Method:** `negateAllowancePackageFolioTax()`
- **Formula:** `taxOnAllowance = −taxAmount` (credit)
```java
BigDecimal negatedTax = taxFolioLineItem.getAmount().negate();
```

### 1.5 Reverse Tax Subtraction from Rate
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/RatesIntegrationHandler.java`
- **Formula:** `netRate = grossRate − inclusiveTaxAmount`
```java
rateSnapshot.setRate(new BigDecimal(rateSnapshot.getRate()).subtract(taxAmount).toString());
```

### 1.6 Tax Line Item Amount
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/common-interface/src/main/java/com/agilysys/pms/account/model/LineItemView.java`
- **Formula:** `taxAmount = Σ(unitTaxAmount × quantity)` per tax line
```java
taxAmount += unitAmount * quantity;
```

### 1.7 Reverse Tax Display — Unit Amount
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/invoice/FolioInvoiceHandlerHelper.java`
- **Method:** `formatDisplayDateAndAmount()`
- **Formula:** `unitAmount = (reverseTaxTotal + taxAmount) ÷ quantity`
```java
unitAmount = lineItem.getReverseTaxTotalChargeAmount().add(lineItem.getTaxAmount())
    .divide(BigDecimal.valueOf(lineItem.getQuantity()), 2, RoundingMode.HALF_UP);
```

### 1.8 Component Taxable Amount
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/AvailabilityHandler.java`
- **Formula:** `taxableAmount = componentAmount × totalQuantity`
```java
taxableComponentItem.setTaxableAmount(component.getAmount().multiply(BigDecimal.valueOf(totalQuantity)));
```

### 1.9 Deposit Tax Exclusion
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/AvailabilityHandler.java`
- **Method:** `excludeDepositTaxAmount()`
- **Formula:** `effectiveTaxIncluded = taxIncludedAmount − Σ(non-matching tax rule amounts)`
```java
taxIncludedAmount = taxIncludedAmount.subtract(summary.getAmount());
```

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

### 2.2 Percentage Rate Modifier
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/DateNodeProcessor.java`
- **Method:** `computeRate()` / `applyPercentageAdjustment()`
- **Formula:** `rate = currentRate × (1 + modifier/100)`
```java
node.setRate(node.getRate().multiply(BigDecimal.ONE.add(
    rate.getAmount().divide(new BigDecimal(100), 10, RoundingMode.HALF_UP))));
```

### 2.3 Surcharge Calculation (Single Person)
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/DateNodeProcessor.java`
- **Method:** `computeSurcharge()`
- **Formula:** `rate = rate + singlePersonAdultCharge` (when `guestTotal < minAdults`)
```java
surCharge = surCharge.add(ratePlanSurcharge.getSinglePersonAdultCharge());
node.setRate(node.getRate().add(surCharge));
```

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

### 2.5 Strike-Through Price
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/AvailableRatesHandler.java`
- **Method:** `getStrikeThroughPriceByDate()`
- **Formula:** `strikeThrough = roomRate + Σ componentAmounts`
```java
strikeThroughByPriceId.put(key, rate.getRoomRate().add(componentRate));
```

### 2.6 Extra Guest Charge
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/sharedreservation/util/SharedReservationCalculationUtils.java`
- **Method:** `getExtraChargeForCategory()`
- **Formula:** `extraChargeTotal = extraCharge × (totalGuests − includedGuests)`
```java
int applicableCount = (totalAgeCategory - includedGuestCount);
return extraCharge.multiply(BigDecimal.valueOf(applicableCount));
```

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

### 2.8 Add-On / Component Rate
- **Service:** `stay-rate-service`
- **Files:** `ComponentDomain.java`, `RoomTypeNode.java`, `RatesEngine.java`
- **Formula:** `addOnRate = unitAmount × totalQuantity`
```java
BigDecimal addOnsRate = amount.multiply(new BigDecimal(ComponentHelper.getTotalQuantity(...)));
```

### 2.9 Add-On Total Charges
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/RatesIntegrationHandler.java`
- **Formula:** `totalCharge = amount × quantity`
```java
groupAddOnsCharge.setTotalCharges(component.getAmount().multiply(new BigDecimal(component.getQuantity())));
```

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

### 2.11 Comp Offer Percentage Discount
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/RoomTypeNode.java`
- **Method:** `applyCompOffers()`
- **Formula:** `discountAmount = (discount / 100) × remainingRate`
```java
BigDecimal discountAmount = discount.divide(BigDecimal.valueOf(100))
    .multiply(remainingRate).setScale(2, RoundingMode.HALF_UP);
```

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

### 2.13 Routing Rule — Amount Discount
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/RoutingRuleHandler.java`
- **Formula:** `compRate = max(0, applicableRate − Σ fixedDiscountAmounts)`
```java
compRate = applicableRate.subtract(discountAmount);
if (compRate.compareTo(BigDecimal.ZERO) < 0) compRate = BigDecimal.ZERO;
```

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

### 2.15 Auto-Recurring Charge as Percentage of Room Rate
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceDomain/src/main/java/com/agilysys/pms/account/data/domain/RecurringCharge.java`
- **Method:** `updateAutoRecurringItemAmount()`
- **Formula:** `baseAmount = roomRate × (value / 100)`
```java
BigDecimal baseAmount = roomRate.multiply(autoRecurringItem.getValue().divide(new BigDecimal(100)));
```

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

### 2.17 Occupancy-Based Rate Incremental Charges
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/service/handler/RatesIntegrationHandler.java`
- **Method:** `applyBaseByOccupancy()`
- **Formula:** `extraAdultCharge[occupancy] = baseByOccupancy[occupancy] − runningTotal`
```java
BigDecimal value = current.subtract(runningTotal);
runningTotal = current;
```

### 2.18 Batch Update Recurring Charge Percentage
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/utils/BatchUpdateRoomRateUtils.java`
- **Formula:** `baseAmount = rate × (value / 100)`
```java
BigDecimal percentage = value.divide(BigDecimal.valueOf(100));
BigDecimal baseAmount = rate.multiply(percentage);
```

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

### 3.3 Credit Limit Remaining
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/ar/ARHandler.java`
- **Method:** `getCreditLimitLeft()`
- **Formula:** `remainingCredit = creditLimit − accountBalance`
```java
return destinationAccount.getAccountsReceivableSettings().getCreditLimit().subtract(accountBalance);
```

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

### 3.5 Company Balance Aggregation
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/invoice/InvoiceHandler.java`
- **Formula:** `companyBalance = Σ(propertyInvoiceTotals) + Σ(propertyUnInvoicedTotals) + companyDepositTotal`

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

### 3.7 Bad Debt Validation
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/invoice/InvoiceHandler.java`
- **Formula:** `|badDebtAmount| ≤ totalExcludingBadDebt` (validation constraint)
```java
BigDecimal totalExcludingBadDebt = lineItemViews.stream()
    .filter(v -> !badDebtIds.contains(v.getId()))
    .map(LineItemView::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
```

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

### 3.9 Credit Limit Validation (Relay)
- **Service:** `stay-relay-service`
- **File:** `stay-relay-service/ServiceImplementation/src/main/java/com/agilysys/pms/relay/handler/charge/PostChargeBaseHandler.java`
- **Formula:** `availableCredit = authorizedAmount − accountBalance`; charge fails if `amount > availableCredit`
```java
BigDecimal limit = authAmount.subtract(accountBalance);
```

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

### 4.2 Total Available Days
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/dateroll/UpdateRotationCounterParticipant.java`
- **Formula:** `totalAvailableDays = totalRoomNights − inventoryBlockedNights − startOffset − endOffset`

### 4.3 Room Revenue Rotation Counter
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/dateroll/UpdateRotationCounterParticipant.java`
- **Formula:** `rotationCounter += (amount × quantity)` per line item (or `reverseTaxTotal` if reverse tax)
```java
rotationCounter = rotationCounter.add(
    lineItem.getAmount().multiply(BigDecimal.valueOf(lineItem.getQuantity())));
```

### 4.4 Player Retail Rating Total
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/dateroll/PlayerRetailRatingNotificationParticipant.java`
- **Formula:** `retailTotal = Σ(amount × quantity)` for eligible line items
```java
BigDecimal total = lineItems.stream()
    .map(li -> li.getAmount().multiply(BigDecimal.valueOf(li.getQuantity())))
    .reduce(BigDecimal.ZERO, BigDecimal::add);
```

### 4.5 Average Daily Rate (ADR)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/audit/listeners/RoomTypeChangeListener.java`
- **Method:** `calculateAdr()`
- **Formula:** `ADR = totalRoomRate ÷ stayDuration`
```java
return totalRoomRate.divide(new BigDecimal(stayDuration), 2, RoundingMode.HALF_UP);
```

### 4.6 Average Room Rate for Guest History
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/manager/GuestStayHistoryManager.java`
- **Formula:** `avgRoomRate = Σ(pastRoomRates) ÷ totalPreviousNights`
```java
guestStayHistoryDomain.setAvgRoomRate(sumRoomRateOfPastReservations
    .divide(BigDecimal.valueOf(totalPreviousNights), 2, RoundingMode.HALF_UP));
```

### 4.7 Average Nightly Rate
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/handler/ReportHandler.java`
- **Method:** `getAverageNightlyRate()`
- **Formula:** `avgNightlyRate = totalNightlyRate ÷ |departureDate − arrivalDate|`
```java
return totalNightlyRate.divide(BigDecimal.valueOf(daysInBetween), MathContext.DECIMAL32)
    .setScale(2, RoundingMode.HALF_EVEN);
```

### 4.8 Average Revenue per Room
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/service/aggregator/entry/AccountRevenue.java`
- **Method:** `getAverage()`
- **Formula:** `avgRevenue = amount ÷ (roomsSold + compRooms)`
```java
return getAmount().divide(getRoomsSold().add(getCompRooms()), 2, RoundingMode.HALF_EVEN);
```

### 4.9 Revenue (Total / Realized / Unrealized)
- **Service:** `stay-profile-service`
- **File:** `stay-profile-service/ServiceImplementation/src/main/java/com/agilysys/pms/profile/data/domain/grc/Revenue.java`
- **Formulas:**
  - `totalRevenue = unitPrice × actual`
  - `realizedRevenue = unitPrice × pickup`
  - `unrealizedRevenue = unitPrice × remaining`

### 4.10 Group ADR
- **Service:** `stay-profile-service`
- **File:** `stay-profile-service/ServiceImplementation/src/main/java/com/agilysys/pms/profile/service/handler/GroupHandler.java`
- **Method:** `calculateAdr()`
- **Formula:** `ADR = roomRevenue ÷ roomCount`
```java
return roomRevenue.divide(new BigDecimal(roomCount), CURRENCY_PRECISION, RoundingMode.HALF_UP);
```

### 4.11 NET Department Revenue
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/service/aggregator/impl/DepartmentRevenueAggregator.java`
- **Formula:** `NET = postings + adjustments + corrections`
```java
afterCalculationItem.put(NET, postingsAmount.add(adjustmentsAmount).add(correctionsAmount).toString());
```

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

### 5.2 Split by Guest Count
- **Services:** `stay-rate-service`, `stay-reservation-service`
- **Files:** `SplitByGuestCountStrategy.java`, `ShareOccupancyHandler.java`, `SharedReservationManager.java`
- **Formula:** `perGuest = ⌊total ÷ guestCount⌋`; `share = perGuest × myGuests`; `primaryShare += remainder`
```java
BigDecimal perGuestCharge = total.divide(BigDecimal.valueOf(overallGuestCount), 2, RoundingMode.DOWN);
BigDecimal remainder = total.subtract(perGuestCharge.multiply(BigDecimal.valueOf(overallGuestCount)));
```

### 5.3 Component Rate Splitting
- **Services:** `stay-rate-service`, `stay-reservation-service`
- **Files:** `SharedReservationCalculationUtils.java`, `SharedReservationPackageComponentHandler.java`, `SharedReservationUtils.java`
- **Formula:** `componentShare = componentRate ÷ reservationCount`; primary absorbs remainder
```java
BigDecimal amountPerRate = amount.divide(divisor, 2, RoundingMode.HALF_UP);
BigDecimal remainingAmount = amount.subtract(amountPerRate.multiply(divisor));
return isPrimary ? amountPerRate.add(remainingAmount) : amountPerRate;
```

### 5.4 Alpha/Delta Split (Shared Reservations)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/manager/SharedReservationManager.java`
- **Method:** `computeSplitRateSnapshots()`
- **Formula:** `alpha = rate ÷ divisor`; `delta = rate − (alpha × divisor)` (rounding correction)
```java
alphaRateSnapshot.setBaseRate(baseRate.divide(splitDivisor, 2, RoundingMode.HALF_UP));
delta = wholeValue.subtract(value.multiply(split)).setScale(2, RoundingMode.HALF_UP);
```

### 5.5 Surcharge Split (Inverse Guest Count Ratio)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/manager/SharedReservationManager.java`
- **Method:** `computeSplitSurcharges()`
- **Formula:** `ratio = singlePersonCharge ÷ Σ(splitDivisor ÷ guestCount_i)`
```java
totalChargeToAggregatedInverseRatio = singlePersonCharge.divide(sumOfInverseValues, 2, RoundingMode.HALF_UP);
```

### 5.6 Shared Room Count Distribution (Reports)
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/service/aggregator/entry/RevenueComposite.java`
- **Formula:** `perShareCount = roomCount ÷ numShared`; primary gets remainder
```java
countToAdd = roomCount.divide(BigDecimal.valueOf(sharedReservations.size()), 2, RoundingMode.HALF_EVEN);
countToAddForPrimary = countToAdd.add(roomCount.subtract(countToAdd.multiply(BigDecimal.valueOf(size))));
```

### 5.7 Shared Reservation Amount Division (Account)
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/AutoRecurringManager.java`
- **Formula:** `amount = sharedCharge ÷ numberOfSharedAccounts`
```java
recurringChargeOverride.setBaseAmount(
    sharedRecurringCharge.getAmount()
        .divide(new BigDecimal(sharedAccountIds.size()), 2, RoundingMode.HALF_UP));
```

---

## 6. Occupancy-Based Calculations

### 6.1 Occupancy Quantity Calculation
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceDomain/src/main/java/com/agilysys/pms/account/data/domain/RecurringCharge.java`
- **Method:** `calculateQuantity()`
- **Formula:** `totalPersons = adults + children + Σ(ageCategoriesNotExcluded)`

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

### 6.3 Occupancy Rate with Components (Reservation)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/handler/OccupancyUpdateHandler.java`
- **Method:** `calculateComponentRates()`
- **Formula:** `occupancyRateToBeAdded = newOccupancyCharge − existingOccupancyCharge`; `rate = preOccupancyRate + occupancyDelta − inclusiveCharge`
```java
occupancyRateToBeAdded = newOccupancyCharge.subtract(existingOccupancyCharge);
rate = rateSnapshot.getPreOccupancyRate().add(occupancyRateToBeAdded).subtract(inclusiveCharge);
```

### 6.4 Room Rate Redistribution to Components
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/handler/OccupancyUpdateHandler.java`
- **Method:** `splitRoomRateToComponents()`
- **Formula:** When room rate < inclusive components: `perUnit = remaining ÷ quantity`, `roundOffAmount += remaining − (perUnit × quantity)`
```java
componentRateSnapshot.setAmount(
    remaining.divide(BigDecimal.valueOf(totalQuantity), 2, RoundingMode.DOWN));
```

### 6.5 Occupancy Percentage (Property)
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/availability/matrix/AvailabilityMatrix.java`
- **Formula:** `occupancyPct = (dividend × 100) ÷ divisor`
```java
getByDate(dividend, date).multiply(new BigDecimal(100)).divide(divisorValue, MATH_CONTEXT);
```

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

### 7.2 RTDC Percentage
- **Formula:** `auth = value% × (postedRoomCharges + postedRoomTaxes + futureRoomChargeTotal)`
```java
value * (postedRoomCharges + postedRoomTaxes + futureRoomChargeTotal) / 100;
```

### 7.3 RTDC Per-Person
- **Formula:** `auth = value × numberOfPersons × maximumDaysToAuthorize`
```java
value * numberOfPersons * maximumDaysToAuthorize;
```

### 7.4 Percentage Authorization with Per-Person
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/RecurringChargesHandler.java`
- **Formula:** `roomCharge = value% × (RTDC + ARC revenue + packageComponents) ÷ 100 + perPersonValue`
```java
roomCharge = value.multiply(rtdcCharges.add(arcRoomRevenue).add(packageComponentCharges))
    .divide(ONE_HUNDRED, 2, BigDecimal.ROUND_HALF_UP).add(perPersonValue);
```

### 7.5 Per-Person Authorization (Per Stay / Per Diem)
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/RecurringChargesHandler.java`
- **Formulas:**
  - Per Stay: `personValue = perPersonValue × numberOfPersons`
  - Per Diem: `personValue = perPersonValue × numberOfPersons × maxDaysToAuthorize`

### 7.6 Auth Decrement / Increment (Payment)
- **Service:** `stay-payment-service`
- **File:** `stay-payment-service/ServiceImplementation/src/main/java/com/agilysys/pms/payment/rguestpay/TransactionFacade.java`
- **Formulas:**
  - `decrementedAmount = authAmount − authorizedAmount`
  - `incrementalAmount = grandTotalAmount − currentAuthAmount`
  - `newAuthAmount = existingAuthAmount + authorizedAmount`

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

### 8.2 Per-Guest Deposit Amount
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/AvailabilityHandler.java`
- **Method:** `getTotalDepositAmountForPerPerson()`
- **Formula:** `perGuestDeposit = (perAdultRate × numAdults) + (perChildRate × numChildren)`
```java
totalAmount = totalAmount.add(perAdultValue.multiply(BigDecimal.valueOf(totalAdult)));
totalAmount = totalAmount.add(perChildValue.multiply(BigDecimal.valueOf(totalChild)));
```

### 8.3 Deposit Due Capping
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/AvailabilityHandler.java`
- **Formula:** `excess = cumulativeScheduleTotal − totalReservationCharge`; `collectible = dueAmount − excess`
```java
BigDecimal excessAmount = afterScheduleTotal.subtract(totalReservationCharge);
BigDecimal amountToBeCollected = scheduledDepositDue.getTotalDueAmount().subtract(excessAmount);
```

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

### 8.5 Deposit Rate Snapshot (Nightly Charge)
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/common-interface/src/main/java/com/agilysys/common/model/DepositRateSnapshot.java`
- **Method:** `getChargeForRateSnapshot()`
- **Formula:** `rate = preOccupancyRate + Σ(extraCategoryCharge × extraCount) + arcRates − negatedCharges − offerAmount − routedAmount`

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

### 9.2 Allowance as Negative Charge (Credit)
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/PackageFolioChargesHandler.java`
- **Formula:** `chargeAmount = −allowanceAmount` (posted as credit)

### 9.3 Enhancement Item Total
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/recurringcharges/RecurringChargesHandler.java`
- **Formula:** `totalTaxableAmount = defaultPrice × requestedQuantity × numberOfDates`
```java
totalTaxableAmount = selectedEnhancementItem.getDefaultPrice()
    .multiply(new BigDecimal(getRequestedQuantity(...)));
totalTaxableAmount = totalTaxableAmount.multiply(new BigDecimal(transactionDates.size()));
```

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

### 10.2 Cancellation Fee — N Nights
- **Method:** `calculateFeeIfGetNightIsNotNull()`
- **Formula:** `fee = Σ(nightlyRate)` for first N nights
```java
fee = fee.add(rate);  // for up to N nights
```

### 10.3 Override Cancellation Fee
- **Method:** `calculateFee()`
- **Formula:** `overrideFee = overridePercentage% × originalFee`
```java
fee = overridePercentage.movePointLeft(2).multiply(fee);
```

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

### 11.2 Commission Percentage Back-Calculation
- **Formula:** `commissionPct = (commissionAmount ÷ roomRate) × 100`
```java
percentage = percentageAmount.dividedBy(roomRate.getAmount(), RoundingMode.HALF_EVEN)
    .multipliedBy(100).getAmount().intValue();
```

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

### 13.2 Monetary Value to Points (IGT)
- **Service:** `stay-integration-modulesa`
- **File:** `stay-integration-modulesa/igt/src/main/java/com/agilysys/pms/integration/igt/transformer/PlayerPointRedemptionReqOutTransformer.java`
- **Formula:** `quantity = amount ÷ pointsConversionRate`

### 13.3 Points to Dollar Value (Aristocrat)
- **Service:** `stay-integration-modulesb`
- **File:** `stay-integration-modulesb/aristocrat/src/main/java/com/agilysys/pms/integration/aristocrat/transformer/PlayerPointsResponseInTransformer.java`
- **Formula:** `dollarValue = ⌊pointBalance ÷ conversionRate⌋` (floored)
```java
pointTypeBalAmt = pointBalance.divide(conversionRate, 2, RoundingMode.FLOOR);
```

### 13.4 Dollar to Points for Redemption (Aristocrat)
- **File:** `stay-integration-modulesb/aristocrat/src/main/java/com/agilysys/pms/integration/aristocrat/transformer/PostRedemptionRequestOutTransformer.java`
- **Formula:** `points = ⌊amount × conversionRate⌋`
```java
redemption.amount = amount.multiply(conversionRate).setScale(0, RoundingMode.FLOOR);
```

### 13.5 Comp Balance After Redemption
- **Service:** `stay-integration-core`
- **File:** `stay-integration-core/mediator/src/main/java/com/agilysys/pms/integration/mediator/handlers/CasinoPointsHandler.java`
- **Formulas:**
  - `authorizedRemaining = authorizedPerStay − redeemedAmount`
  - `ineligibleComp = accountBalance − eligibleValueForPlayer`
  - `redeemedAmount = amountPerStay − balancePerDay`

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

### 14.2 Comp Balance Recalculation
- **Service:** `stay-property-service`
- **File:** `stay-property-service/ServiceImplementation/src/main/java/com/agilysys/pms/property/service/handler/compaccounting/CompAccountingBaseHandler.java`
- **Formula:** `redeemed = oldAmountPerStay − oldBalance`; `newBalance = newAmountPerStay − redeemed`
```java
BigDecimal redeemedAmount = oldAmountPerStay.subtract(oldBalance);
BigDecimal amountPerDayBalance = newAmountPerStay.subtract(redeemedAmount);
```

### 14.3 Comp Restriction Consecutive Window
- **Service:** `stay-rate-service`
- **File:** `stay-rate-service/ServiceImplementation/src/main/java/com/agilysys/pms/rates/engine/CompRateBuilder.java`
- **Formula:** `windowTotal = Σ compedRates[window]`; tracks max consecutive window for comp restrictions

---

## 15. Payment & Credit Calculations

### 15.1 Excess Payment Amount
- **Service:** `stay-account-service`
- **File:** `stay-account-service/ServiceImplementation/src/main/java/com/agilysys/pms/account/handler/PaymentRequestHandler.java`
- **Formula:** `excessAmount = paymentAmount − invoiceTotal` (when payment exceeds balance)
```java
excessAmount = postPayment.getAmount().subtract(invoice.getBalance().getTotal());
```

### 15.2 POS Cents to Dollars Conversion
- **Service:** `stay-igconnector-service`
- **File:** `stay-igconnector-service/service/src/main/java/com/agilysys/pms/igconnector/service/pos/data/model/PostRequest.java`
- **Method:** `toChargeAmount()`
- **Formula:** `dollars = cents ÷ 100`
```java
return BigDecimal.valueOf(amount).divide(ONE_HUNDRED, 2, RoundingMode.HALF_EVEN);
```

### 15.3 POS Dollars to Cents Conversion
- **Service:** `stay-igconnector-service`
- **File:** `stay-igconnector-service/service/src/main/java/com/agilysys/pms/igconnector/service/pos/data/model/AccountDetail.java`
- **Formula:** `cents = dollars × 100`
```java
balanceAmount = folio.getAccountBalance().multiply(ONE_HUNDRED).longValue();
```

### 15.4 POS Net Charge
- **Service:** `stay-relay-service`
- **File:** `stay-relay-service/ServiceImplementation/src/main/java/com/agilysys/pms/relay/handler/charge/PostPosChargeHandler.java`
- **Formula:** `netCharge = grossCharge − prepaymentAmount`
```java
BigDecimal chargeAmount = new BigDecimal(postCharge.getChargeAmount())
    .subtract(new BigDecimal(postCharge.getPrepaymentAmount()));
```

### 15.5 Phone Call Charge with Free Allowance
- **Service:** `stay-relay-service`
- **File:** `stay-relay-service/ServiceImplementation/src/main/java/com/agilysys/pms/relay/handler/charge/PostCallChargeHandler.java`
- **Formula:** `billableAmount = total − min(dailyAllowance − used, total)`
```java
BigDecimal freeAllowanceAmount = dailyAllowanceAmount.compareTo(calculatedAmount) >= 0
    ? amount : dailyAllowanceAmount.subtract(freeAllowanceCharges);
charge.setAmount(amount.subtract(freeAllowanceAmount));
```

---

## 16. Reporting Aggregation Formulas

### 16.1 Nightly Room Charge
- **Service:** `stay-report-service`
- **File:** `stay-report-service/ServiceImplementation/src/main/java/com/agilysys/pms/report/handler/ReportHandler.java`
- **Formula:** `nightlyRoomCharge = Σ(recurringCharge.amount + componentCharge)` per date
```java
nightlyRoomCharge = nightlyRoomCharge.add(recurringCharge.getAmount()).add(componentCharge);
```

### 16.2 Day Total
- **Formula:** `dayTotal = nightlyRoomCharge + todayRecurringCharge + totalTax`
```java
BigDecimal dayTotal = nightlyRoomCharge.add(todaySummaryRecurringCharge).add(totalTax);
```

### 16.3 Day Total with Comp
- **Formula:** `dayTotalWithComp = roomChargeWithComp + recurringChargeWithComp + taxWithComp`
- Where: `compedAmount = compedTotal − compedTax`; `chargeWithComp = (amount + component) − compedAmount`
```java
compedAmount = recurringCharge.getCompedAmount().subtract(compedTaxAmount);
nightlyRoomChargeWithComp += (amount + componentCharge) - compedAmount;
```

### 16.4 Average Night Package Gross
- **Formula:** `avgNightPackageGross = nightPackageGrossWithTax ÷ numberOfNights`
```java
averageNightPackageGrossWithTax = nightPackageGrossWithTax.divide(noOfNights, 2, RoundingMode.HALF_UP);
```

### 16.5 Future Charges Summary
- **Formulas:**
  - `futureCharges = Σ(dayTotal − tax)`
  - `futureTaxes = Σ(tax)`
  - `futureTotal = Σ(dayTotal)`

### 16.6 Total Excluding Routed Charges
- **Formula:** `totalExcludingRouted = |estimatedAtCheckout − totalRoutedCharges|`
```java
if (totalRoutedCharges.compareTo(estimatedAtCheckout) > 0)
    totalExcludingRoutedCharges = totalRoutedCharges.subtract(estimatedAtCheckout);
else
    totalExcludingRoutedCharges = estimatedAtCheckout.subtract(totalRoutedCharges);
```

### 16.7 Component Charge (Report)
- **Formula:** `componentCharge = Σ(component.totalAmount)` or `Σ(component.estimatedTax)` depending on mode
```java
return components.stream()
    .filter(c -> c.getTotalQuantity() > 0 && (!c.isAddOn() || includeAddOn))
    .map(c -> calculateCharge(c, calculateTax))
    .reduce(BigDecimal.ZERO, BigDecimal::add);
```

### 16.8 Charge Rate × Quantity (Reports)
- **Services:** `stay-report-service`
- **Files:** `ChargeAggregator.java`, `ShiftAggregator.java`, `TransactionAggregator.java`, `DepartmentRevenueAggregator.java`
- **Formula:** `itemTotal = amount × quantity`
```java
BigDecimal itemSum = item.getAmount().multiply(new BigDecimal(item.getQuantity()));
BigDecimal total = rate.add(tax);
```

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

### 17.2 Yield Modifier Values
- **Service:** `stay-pms-common`
- **File:** `stay-pms-common/common-interface/src/main/java/com/agilysys/pms/rates/model/YieldApplyOnLevelBy.java`
- **Formulas:**
  - `PERCENT`: `modifier = resultValue × rate × 0.01`
  - `FLAT_RATE`: `modifier = resultValue` (passthrough)
  - `DECREASE_BY`: modifier is negated

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

### 18.2 Estimated Room Charges
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/consumer/BatchGroupReservationStagingConsumer.java`
- **Formula:** `estimatedCharges = dailyRate × numberOfNights`
```java
estimatedCharges = estimatedRoomRate.multiply(new BigDecimal(getDaysBetweenDates(arrivalDate, departureDate)));
```

### 18.3 Balance Due (SMS)
- **Service:** `stay-reservation-service`
- **File:** `stay-reservation-service/ServiceImplementation/src/main/java/com/agilysys/pms/reservation/handler/helper/SMSMessageManagerHelper.java`
- **Formula:** `balanceDue = estimatedCharges − postedPayments`

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

### 19.2 Per-Unit Amount Division
Used when splitting a total back into per-unit values:
- **Formula:** `perUnit = totalAmount ÷ quantity` (rounded HALF_UP to 2 decimals)
- **Found in:** `LineItemMapping.java`, `RecurringChargeHelper.java`, `ReservationHandler.java` (integration)

### 19.3 Rounding Remainder
- **Service:** `stay-integration-core`
- **File:** `stay-integration-core/mediator/src/main/java/com/agilysys/pms/integration/mediator/handlers/ReservationHandler.java`
- **Method:** `calculateRoundingRemainder()`
- **Formula:** `perUnit = amount ÷ quantity (DOWN)`; `remainder = amount − (perUnit × quantity)`

### 19.4 Pagination
- **Formula:** `totalPages = ⌈totalCount ÷ pageSize⌉`
- **Found in:** `TransactionRepository.java` (igconnector), `ApplianceTransactionRepository.java` (relay), `GuestProfileHandler.java` (profile)
```java
(int) Math.ceil((double) count / pageSize);
```

### 19.5 Maximum Reference Number
- **Service:** `stay-relay-service`
- **File:** `stay-relay-service/ServiceImplementation/src/main/java/com/agilysys/pms/relay/handler/reference/ReferenceHandler.java`
- **Formula:** `maxValue = 10^digits − 1`
```java
return (long) Math.pow(10, numberOfDigits) - 1;
```

### 19.6 Standard Monetary Rounding
Applied across all financial operations: `.setScale(2, RoundingMode.HALF_UP)` for standard rounding, `.setScale(2, RoundingMode.HALF_EVEN)` for banker's rounding.

### 19.7 Day of Week (Modular Arithmetic)
- **Formula:** `dayIndex = Math.floorMod(getDayValueOfWeek(date), 7)`
- **Found in:** `RoutingRuleHandler.java`, `RateSnapshotValidator.java`

### 19.8 Housekeeping Point Rounding
- **Service:** `stay-reports-aggregator`
- **File:** `stay-reports-aggregator/ServiceImplementation/src/main/java/com/agilysys/pms/aggregator/hkassignment/Batch4.java`
- **Formula:** `allotted = Math.round(utilizedPoints × 100.0) / 100.0` (2 decimal rounding)

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
