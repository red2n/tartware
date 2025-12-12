import type { RawCategory } from "../catalog-types.js";

export const ADVANCED_TRENDING: RawCategory = {
  code: "ADVANCED_TRENDING",
  name: "Advanced & Trending",
  description:
    "Emerging capabilities including AI automation, sustainability monitoring, and digital guest journey.",
  icon: "rocket_launch",
  color: "lime",
  tags: ["innovation"],
  sections: [
    {
      code: "AI_AND_AUTOMATION",
      name: "AI & Automation",
      description: "Price optimization; forecasting; chatbots; upselling triggers.",
      icon: "smart_toy",
      definitions: [
        {
          code: "INNOVATION.AI.ORCHESTRATION",
          name: "AI Automation Orchestration",
          description: "Configures AI-driven pricing, forecasting, and conversational flows.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            priceOptimization: { enabled: true, provider: "TART_AI", guardRailPercent: 15 },
            forecasting: { horizonDays: 120, refreshCadenceHours: 6 },
            upsellEngine: { enabled: true, triggers: ["PRE_ARRIVAL", "IN_STAY"] },
            chatbot: { enabled: true, escalationRoles: ["FRONT_DESK"], languages: ["en"] },
          },
          tags: ["ai", "revenue"],
          moduleDependencies: ["ai-platform"],
          referenceDocs: ["https://docs.tartware.com/settings/innovation/ai"],
        },
      ],
    },
    {
      code: "SUSTAINABILITY",
      name: "Sustainability",
      description: "Energy/water tracking; carbon calc; green opts; reporting.",
      icon: "energy_savings_leaf",
      definitions: [
        {
          code: "INNOVATION.SUSTAINABILITY.PROGRAM",
          name: "Sustainability Program Settings",
          description:
            "Captures sustainability metrics, guest opt-in programs, and reporting cadence.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["PROPERTY"],
          defaultValue: {
            metrics: ["ENERGY_KWH", "WATER_LITERS", "CARBON_KG"],
            guestOptIn: { linenReuse: true, digitalReceipts: true },
            reporting: { frequency: "MONTHLY", shareWithGuests: true },
            offsetPrograms: ["CARBON_NEUTRAL_STAYS"],
          },
          tags: ["sustainability"],
          moduleDependencies: ["sustainability"],
          referenceDocs: ["https://docs.tartware.com/settings/innovation/sustainability"],
        },
      ],
    },
    {
      code: "DIGITAL_GUEST_JOURNEY",
      name: "Digital Guest Journey",
      description: "Online check-in; digital keys; contactless payments; virtual concierge.",
      icon: "phone_iphone",
      definitions: [
        {
          code: "INNOVATION.DIGITAL_JOURNEY",
          name: "Digital Guest Journey Experience",
          description:
            "Enables digital guest touchpoints such as check-in, mobile keys, and concierge.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["PROPERTY", "TENANT"],
          defaultValue: {
            onlineCheckIn: { enabled: true, earliestHoursBeforeArrival: 24 },
            mobileKey: { enabled: true, provider: "KEYLESS_CO" },
            contactlessPayments: { enabled: true, supportedMethods: ["APPLE_PAY", "GOOGLE_PAY"] },
            virtualConcierge: { enabled: true, knowledgeBase: "DEFAULT" },
          },
          tags: ["guest-experience", "mobile"],
          moduleDependencies: ["guest-experience"],
          referenceDocs: ["https://docs.tartware.com/settings/innovation/digital-journey"],
        },
      ],
    },
  ],
};
