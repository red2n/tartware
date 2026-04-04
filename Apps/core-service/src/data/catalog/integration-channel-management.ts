import type { RawCategory } from "../catalog-types.js";

export const INTEGRATION_CHANNEL_MANAGEMENT: RawCategory = {
  code: "INTEGRATION_CHANNEL_MANAGEMENT",
  name: "Integration & Channel Management",
  description:
    "OTA mapping, API/webhook credentials, and channel prioritization for distribution strategy.",
  icon: "sync_alt",
  color: "blue",
  tags: ["integrations", "distribution"],
  sections: [
    {
      code: "OTA_CHANNEL_MANAGER",
      name: "OTA/Channel Manager",
      description:
        "API keys; mappings (rates, rooms); sync frequency; commissions; inventory allocation; parity; no-show reporting.",
      icon: "public",
      definitions: [
        {
          code: "INTEGRATIONS.OTA.PROFILE",
          name: "OTA Channel Profile",
          description: "Stores OTA credentials, mapping rules, and synchronization cadence.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["PROPERTY"],
          defaultValue: {
            defaultCommissionPercent: 18,
            syncFrequencyMinutes: 15,
            channels: [
              { code: "BOOKING", status: "ACTIVE", overbookingBufferPercent: 5 },
              { code: "EXPEDIA", status: "ACTIVE", overbookingBufferPercent: 3 },
            ],
            noShowPolicy: { autoReportHours: 12 },
          },
          tags: ["integrations", "distribution"],
          moduleDependencies: ["distribution"],
          referenceDocs: ["https://docs.tartware.com/settings/integrations/ota"],
        },
      ],
    },
    {
      code: "API_THIRD_PARTY",
      name: "API & Third-Party",
      description:
        "Endpoints; auth (OAuth); webhooks; intervals; integrations (accounting, CRM, RMS, POS).",
      icon: "cloud",
      definitions: [
        {
          code: "INTEGRATIONS.API.CATALOG",
          name: "Third-Party Integration Catalog",
          description: "Registers external integrations, credential storage, and webhook policies.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            integrations: [
              { name: "NetSuite", type: "ACCOUNTING", auth: "OAUTH2", status: "ACTIVE" },
              { name: "Salesforce", type: "CRM", auth: "OAUTH2", status: "ACTIVE" },
            ],
            webhookDelivery: { retryAttempts: 5, retryIntervalSeconds: 60 },
          },
          tags: ["integrations"],
          moduleDependencies: ["integration-hub"],
          referenceDocs: ["https://docs.tartware.com/settings/integrations/api"],
          sensitivity: "CONFIDENTIAL",
        },
      ],
    },
    {
      code: "CHANNEL_PRIORITY",
      name: "Channel Priority",
      description:
        "Order; auto-stop triggers; overbooking buffers; min rates; blackout per channel.",
      icon: "stacked_bar_chart",
      definitions: [
        {
          code: "INTEGRATIONS.CHANNEL.PRIORITIES",
          name: "Channel Prioritization Matrix",
          description: "Controls distribution channel ordering, blackout windows, and guardrails.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "PROPERTY",
          allowedScopes: ["PROPERTY"],
          defaultValue: {
            priority: ["DIRECT", "LOYALTY", "BOOKING", "EXPEDIA"],
            minRateGuardrails: { OTA: 120, DIRECT: 100 },
            stopSellConditions: [{ channel: "BOOKING", occupancyPercent: 95 }],
          },
          tags: ["distribution", "revenue"],
          moduleDependencies: ["distribution"],
          referenceDocs: ["https://docs.tartware.com/settings/integrations/channel-priority"],
        },
      ],
    },
  ],
};
