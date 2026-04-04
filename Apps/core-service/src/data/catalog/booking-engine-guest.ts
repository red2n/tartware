import type { RawCategory } from "../catalog-types.js";

export const BOOKING_ENGINE_GUEST: RawCategory = {
  code: "BOOKING_ENGINE_GUEST",
  name: "Booking Engine & Guest Management",
  description:
    "Controls for booking engine presentation, booking flow, loyalty program, and guest history tracking.",
  icon: "travel_explore",
  color: "purple",
  tags: ["guest-experience", "distribution"],
  sections: [
    {
      code: "BOOKING_ENGINE_DISPLAY",
      name: "Booking Engine Display",
      description: "Widget types; languages; date/currency formats; branding; search fields.",
      icon: "web_asset",
      definitions: [
        {
          code: "BOOKING.ENGINE.DISPLAY",
          name: "Booking Engine Display Profile",
          description:
            "Defines the look-and-feel, localization, and content blocks for the booking engine.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT", "PROPERTY"],
          defaultValue: {
            theme: "MODERN",
            primaryColor: "#155EEF",
            widgetTypes: ["EMBEDDED", "FLOATING_BUTTON"],
            supportedLanguages: ["en", "es", "fr"],
            showPromoCodeField: true,
          },
          tags: ["guest-experience", "ui"],
          moduleDependencies: ["booking-engine"],
          referenceDocs: ["https://docs.tartware.com/settings/booking/display"],
        },
      ],
    },
    {
      code: "BOOKING_FLOW_RESTRICTIONS",
      name: "Booking Flow & Restrictions",
      description: "Steps; guest info requirements; upsells; terms; same-day cutoffs; age limits.",
      icon: "workflow",
      definitions: [
        {
          code: "BOOKING.ENGINE.FLOW",
          name: "Booking Flow Configuration",
          description:
            "Controls booking steps, required guest information, and upsell presentation.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["PROPERTY"],
          defaultValue: {
            steps: ["SEARCH", "ROOM_SELECTION", "ADD_ONS", "PAYMENT", "CONFIRMATION"],
            requiredFields: ["EMAIL", "PHONE", "ARRIVAL_TIME"],
            upsellPanels: ["PARKING", "BREAKFAST", "LATE_CHECKOUT"],
            sameDayCutoffHour: 18,
            minGuestAge: 18,
          },
          tags: ["guest-experience", "compliance"],
          moduleDependencies: ["booking-engine"],
          referenceDocs: ["https://docs.tartware.com/settings/booking/flow"],
        },
      ],
    },
    {
      code: "LOYALTY_PROGRAM",
      name: "Loyalty Program",
      description: "Tiers; points rules; redemptions; expirations; benefits; partner integrations.",
      icon: "loyalty",
      definitions: [
        {
          code: "GUEST.LOYALTY.PROGRAM",
          name: "Loyalty Program Configuration",
          description:
            "Govern loyalty tiers, accrual rules, redemption catalog, and partner alignments.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            tiers: [
              { code: "SILVER", nightsRequired: 5, benefits: ["LATE_CHECKOUT"] },
              { code: "GOLD", nightsRequired: 15, benefits: ["ROOM_UPGRADE", "WELCOME_GIFT"] },
              {
                code: "PLATINUM",
                nightsRequired: 30,
                benefits: ["SUITE_UPGRADE", "DINING_CREDIT"],
              },
            ],
            accrual: { pointsPerDollar: 1.5, bonusForDirect: 25 },
            expirationMonths: 24,
            partners: [{ name: "AirlineOne", type: "AIR", conversionRate: 0.5 }],
          },
          tags: ["loyalty", "guest-experience"],
          moduleDependencies: ["guest-experience"],
          referenceDocs: ["https://docs.tartware.com/settings/guest/loyalty"],
        },
      ],
    },
    {
      code: "GUEST_HISTORY_TRACKING",
      name: "Guest History & Tracking",
      description: "Past records; patterns; feedback; sentiment analysis.",
      icon: "history_edu",
      definitions: [
        {
          code: "GUEST.HISTORY.SETTINGS",
          name: "Guest History Tracking Policy",
          description:
            "Controls data captured for guest history, sentiment, and experience feedback.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            trackedEvents: ["STAY", "ANCILLARY_PURCHASE", "FEEDBACK", "COMPLAINT"],
            sentimentAnalysis: { enabled: true, provider: "TART_AI" },
            feedbackSurveys: { postStayDelayHours: 12, reminderDays: [3] },
          },
          tags: ["guest-experience", "analytics"],
          moduleDependencies: ["guest-experience"],
          referenceDocs: ["https://docs.tartware.com/settings/guest/history"],
          sensitivity: "SENSITIVE",
        },
      ],
    },
  ],
};
