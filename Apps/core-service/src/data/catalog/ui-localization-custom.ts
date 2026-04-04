import type { RawCategory } from "../catalog-types.js";

export const UI_LOCALIZATION_CUSTOM: RawCategory = {
  code: "UI_LOCALIZATION_CUSTOM",
  name: "UI, Localization & Custom Settings",
  description:
    "Controls for UI theming, mobile capabilities, localization formats, and custom fields.",
  icon: "palette",
  color: "pink",
  tags: ["ui", "customization"],
  sections: [
    {
      code: "UI_CUSTOMIZATION",
      name: "UI Customization",
      description: "Themes; logos; dashboards; menus; views (list/card); shortcuts.",
      icon: "palette",
      definitions: [
        {
          code: "UI.CUSTOMIZATION.WORKSPACE",
          name: "Workspace Theme & Layout",
          description: "Controls global theming, navigation layout, and quick access shortcuts.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "USER",
          allowedScopes: ["TENANT", "USER"],
          defaultValue: {
            theme: "LIGHT",
            customLogo: null,
            layout: "SIDEBAR_LEFT",
            defaultViewMode: "CARD",
            shortcuts: ["RESERVATIONS", "SETTINGS", "REPORTS"],
          },
          tags: ["ui"],
          moduleDependencies: ["ui-shell"],
          referenceDocs: ["https://docs.tartware.com/settings/ui/customization"],
        },
      ],
    },
    {
      code: "MOBILE_APP_FEATURES",
      name: "Mobile App Features",
      description: "Reservations; housekeeping; payments; notifications; offline sync.",
      icon: "smartphone",
      definitions: [
        {
          code: "UI.MOBILE.FEATURE_FLAGS",
          name: "Mobile Feature Flags",
          description:
            "Enables mobile modules, offline synchronization, and push notification behaviors.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            enabledModules: ["RESERVATIONS", "HOUSEKEEPING", "MAINTENANCE"],
            pushNotifications: { enabled: true, quietHours: { start: "22:00", end: "07:00" } },
            offlineSync: { enabled: true, maxCacheHours: 24 },
          },
          tags: ["mobile"],
          moduleDependencies: ["mobile-apps"],
          referenceDocs: ["https://docs.tartware.com/settings/ui/mobile"],
        },
      ],
    },
    {
      code: "LANGUAGE_LOCALIZATION",
      name: "Language & Localization",
      description: "Languages; formats (date/time/number); translations (UI/templates).",
      icon: "translate",
      definitions: [
        {
          code: "UI.LOCALIZATION.SETTINGS",
          name: "Localization & Formatting",
          description: "Configures language packs, fallback behavior, and formatting standards.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            defaultLanguage: "en",
            supportedLanguages: ["en", "fr", "es", "de"],
            numberFormat: { style: "decimal", minimumFractionDigits: 2 },
            dateFormat: "YYYY-MM-DD",
            timeFormat: "24H",
          },
          tags: ["localization"],
          moduleDependencies: ["ui-shell"],
          referenceDocs: ["https://docs.tartware.com/settings/ui/localization"],
        },
      ],
    },
    {
      code: "CUSTOM_FIELDS",
      name: "Custom Fields",
      description: "Types (text, dropdown); validations; permissions; dependencies.",
      icon: "category",
      definitions: [
        {
          code: "UI.CUSTOM_FIELDS.BUILDER",
          name: "Custom Field Builder",
          description:
            "Allows administrators to define custom fields with validation and permission logic.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: {
            entities: [
              {
                target: "RESERVATION",
                fields: [
                  { key: "ARRIVAL_FLIGHT", type: "text", required: false },
                  { key: "TRANSPORTATION", type: "select", options: ["NONE", "TAXI", "LIMO"] },
                ],
              },
            ],
            validationLibrary: ["required", "minLength", "maxLength", "regex"],
            permissions: { visibilityRoles: ["SUPER_ADMIN", "PROPERTY_MANAGER"] },
          },
          tags: ["customization"],
          moduleDependencies: ["ui-shell"],
          referenceDocs: ["https://docs.tartware.com/settings/ui/custom-fields"],
          sensitivity: "INTERNAL",
        },
      ],
    },
  ],
};
