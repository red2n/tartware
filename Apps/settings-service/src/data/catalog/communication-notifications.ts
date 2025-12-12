import type { RawCategory } from "../catalog-types.js";

export const COMMUNICATION_NOTIFICATIONS: RawCategory = {
  code: "COMMUNICATION_NOTIFICATIONS",
  name: "Communication & Notifications",
  description:
    "Guest messaging templates, preferences, and system alert routing for proactive communication.",
  icon: "notifications",
  color: "red",
  tags: ["communication"],
  sections: [
    {
      code: "CHANNELS_AND_WORKFLOWS",
      name: "Channels & Workflows",
      description:
        "Email/SMS/WhatsApp templates; automations (pre-arrival, confirmations, reviews); personalization.",
      icon: "sms",
      definitions: [
        {
          code: "COMMUNICATION.CHANNELS.CATALOG",
          name: "Messaging Channel Catalog",
          description:
            "Defines available communication channels, templates, and automation triggers.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            channels: ["EMAIL", "SMS", "WHATSAPP"],
            templates: [
              { code: "CONFIRMATION", channels: ["EMAIL", "SMS"], supportsLocalization: true },
              { code: "PRE_ARRIVAL", channels: ["EMAIL"], supportsLocalization: true },
            ],
            automation: {
              preArrivalDays: 2,
              postStayReviewDays: 3,
            },
          },
          tags: ["communication", "guest-experience"],
          moduleDependencies: ["guest-experience"],
          referenceDocs: ["https://docs.tartware.com/settings/communication/channels"],
        },
      ],
    },
    {
      code: "PREFERENCES",
      name: "Preferences",
      description: "Frequency; opt-ins; do-not-disturb; GDPR controls.",
      icon: "toggle_on",
      definitions: [
        {
          code: "COMMUNICATION.PREFERENCES.POLICY",
          name: "Communication Preference Framework",
          description:
            "Controls subscription categories, default frequency, and privacy consent handling.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT", "USER"],
          defaultValue: {
            preferences: [
              { category: "PROMOTIONS", defaultOptIn: false },
              { category: "TRANSACTIONAL", defaultOptIn: true },
              { category: "HOUSEKEEPING_UPDATES", defaultOptIn: true },
            ],
            doNotDisturb: { allowPerChannel: true, quietHours: { start: "22:00", end: "08:00" } },
            dataSubjectRequests: { autoAcknowledgeHours: 24 },
          },
          tags: ["communication", "compliance-gdpr"],
          moduleDependencies: ["core-platform"],
          referenceDocs: ["https://docs.tartware.com/settings/communication/preferences"],
          sensitivity: "SENSITIVE",
        },
      ],
    },
    {
      code: "SYSTEM_ALERTS",
      name: "System Alerts",
      description: "Bookings; payments; inventory; errors; routing by role.",
      icon: "warning",
      definitions: [
        {
          code: "COMMUNICATION.ALERTS.ROUTING",
          name: "System Alert Routing",
          description: "Routes operational and financial alerts to relevant roles and channels.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["PROPERTY", "TENANT"],
          defaultValue: {
            alertCategories: [
              { code: "PAYMENT_FAILURE", severity: "HIGH", notify: ["FINANCE", "FRONT_DESK"] },
              { code: "OVERBOOKING", severity: "CRITICAL", notify: ["REVENUE_MANAGER"] },
              { code: "MAINTENANCE_EMERGENCY", severity: "CRITICAL", notify: ["ENGINEERING"] },
            ],
            deliveryChannels: ["EMAIL", "IN_APP", "SMS"],
          },
          tags: ["communication", "operations"],
          moduleDependencies: ["core-platform"],
          referenceDocs: ["https://docs.tartware.com/settings/communication/alerts"],
        },
      ],
    },
  ],
};
