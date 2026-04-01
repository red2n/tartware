import type { RawCategory } from "../catalog-types.js";

export const RATE_PRICING_FINANCIAL: RawCategory = {
  code: "RATE_PRICING_FINANCIAL",
  name: "Rate, Pricing & Financial",
  description:
    "Dynamic pricing strategies, restrictions, taxation, billing, and payment gateway configuration.",
  icon: "request_quote",
  color: "amber",
  tags: ["revenue", "finance"],
  sections: [
    {
      code: "RATE_PLANS_STRUCTURE",
      name: "Rate Plans Structure",
      description:
        "Base/BAR; seasonal; packages; negotiated/corporate; dynamic adjustments (demand/occupancy-based); derived rates.",
      icon: "price_change",
      definitions: [
        {
          code: "FINANCE.RATES.PLAN_MATRIX",
          name: "Rate Plan Matrix",
          description:
            "Configures base rates, derived rate formulas, and seasonal strategy bundles.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["TENANT", "PROPERTY"],
          defaultValue: {
            basePlans: [
              { code: "BAR", type: "DYNAMIC", strategy: "DEMAND_BASED" },
              { code: "CORP", type: "NEGOTIATED", strategy: "CONTRACTED" },
            ],
            derivedPlans: [
              { code: "ADV7", base: "BAR", adjustment: "-10%", conditions: ["BOOKING_LEAD>=7"] },
            ],
            seasonalRamps: [
              { season: "PEAK", upliftPercent: 20 },
              { season: "LOW", decreasePercent: 15 },
            ],
          },
          tags: ["revenue"],
          moduleDependencies: ["revenue-management"],
          referenceDocs: ["https://docs.tartware.com/settings/rates/structure"],
        },
      ],
    },
    {
      code: "RATE_RESTRICTIONS_MEALS",
      name: "Rate Restrictions & Meals",
      description:
        "Min/max stay; advance booking; extra charges; blackout dates; meal plans; child surcharges.",
      icon: "restaurant_menu",
      definitions: [
        {
          code: "FINANCE.RATES.RESTRICTIONS",
          name: "Rate Restrictions Configuration",
          description:
            "Controls stay restrictions, meal plan inclusions, and surcharge calculations.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["PROPERTY"],
          defaultValue: {
            minStay: 1,
            maxStay: 21,
            advanceBookingDays: { min: 0, max: 365 },
            mealPlans: [
              { code: "RO", label: "Room Only", included: [] },
              { code: "BB", label: "Bed & Breakfast", included: ["BREAKFAST"] },
              { code: "AI", label: "All Inclusive", included: ["BREAKFAST", "LUNCH", "DINNER"] },
            ],
            childPolicy: {
              allowed: true,
              ageBands: [
                { maxAge: 5, chargeType: "FREE" },
                { maxAge: 12, chargeType: "PERCENT", value: 50 },
              ],
            },
          },
          tags: ["revenue", "guest-experience"],
          moduleDependencies: ["revenue-management"],
          referenceDocs: ["https://docs.tartware.com/settings/rates/restrictions"],
        },
      ],
    },
    {
      code: "TAX_CONFIGURATION",
      name: "Tax Configuration",
      description:
        "Types (VAT, occupancy); calculation methods (inclusive/exclusive); exemptions; application rules; reporting.",
      icon: "receipt_long",
      definitions: [
        {
          code: "FINANCE.TAX.MATRIX",
          name: "Tax Configuration Matrix",
          description:
            "Defines tax types, jurisdictions, and application logic for folios and invoices.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            taxes: [
              { code: "VAT", type: "PERCENT", value: 18, inclusive: false },
              { code: "OCCUPANCY", type: "FIXED", value: 5, inclusive: false },
            ],
            exemptions: [{ nationality: "US", taxCodes: ["VAT"], requiresDocument: true }],
            rounding: { mode: "HALF_UP", decimals: 2 },
          },
          tags: ["finance", "compliance"],
          moduleDependencies: ["finance"],
          referenceDocs: ["https://docs.tartware.com/settings/finance/taxes"],
          sensitivity: "SENSITIVE",
        },
      ],
    },
    {
      code: "INVOICE_AND_BILLING",
      name: "Invoice & Billing",
      description:
        "Numbering; generation timing; layouts; folio splitting; multi-currency; credit notes.",
      icon: "article",
      definitions: [
        {
          code: "FINANCE.BILLING.POLICY",
          name: "Invoice & Billing Policy",
          description:
            "Controls invoice numbering schemes, folio behaviors, and document delivery.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            numbering: { prefix: "INV-", sequenceLength: 6, reset: "ANNUAL" },
            folio: { allowSplit: true, maxSplits: 4 },
            currency: { primary: "USD", allowMultiCurrency: true },
            delivery: { email: true, portal: true },
          },
          tags: ["finance"],
          moduleDependencies: ["finance"],
          referenceDocs: ["https://docs.tartware.com/settings/finance/billing"],
        },
      ],
    },
    {
      code: "PAYMENT_GATEWAY",
      name: "Payment Gateway",
      description:
        "Processor integration; tokenization; 3D Secure; pre-auth; retries; refund rules; methods.",
      icon: "payments",
      definitions: [
        {
          code: "FINANCE.PAYMENTS.GATEWAY_PROFILE",
          name: "Payment Gateway Profile",
          description:
            "Configures payment processor credentials, tokenization policies, and retry strategies.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            provider: "STRIPE",
            currency: "USD",
            tokenization: { enabled: true, provider: "STRIPE" },
            threeDSecure: { enabled: true, enforceOnHighRisk: true },
            retryPolicy: { attempts: 3, intervalMinutes: 15 },
            allowedMethods: ["CREDIT_CARD", "APPLE_PAY", "BANK_TRANSFER"],
          },
          tags: ["payments", "compliance-pcidss"],
          moduleDependencies: ["finance"],
          referenceDocs: ["https://docs.tartware.com/settings/finance/payment-gateway"],
          sensitivity: "CONFIDENTIAL",
        },
      ],
    },
  ],
};
