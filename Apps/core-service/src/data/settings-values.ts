import type { SettingsDefinition, SettingsValue } from "@tartware/schemas";
import { SettingsScopeEnum } from "@tartware/schemas";

import { generateDeterministicUuid, settingsCatalogData } from "./settings-catalog.js";

const SAMPLE_TENANT_ID = "317edc15-bd7b-4fec-afbd-be6a8f316f56";
const SAMPLE_PROPERTY_ID = "400eaa00-6ba4-4421-bbce-8b159bf2d905";
const SAMPLE_UNIT_ID = "672c8378-c7f6-4995-a823-b64c2c8d0a47";
const SAMPLE_USER_ID = "bc6c73ac-49a7-4544-9dbb-a60ba969cd88";
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const BASE_TIMESTAMP = new Date("2025-11-12T00:00:00Z");

const scopeValueFactory = (definition: SettingsDefinition): SettingsValue => {
  const scope = definition.default_scope;

  return {
    id: generateDeterministicUuid(`VALUE:${definition.code}:${scope}`),
    setting_id: definition.id,
    scope_level: scope,
    tenant_id: SAMPLE_TENANT_ID,
    property_id: scope === SettingsScopeEnum.enum.PROPERTY ? SAMPLE_PROPERTY_ID : undefined,
    unit_id: scope === SettingsScopeEnum.enum.UNIT ? SAMPLE_UNIT_ID : undefined,
    user_id: scope === SettingsScopeEnum.enum.USER ? SAMPLE_USER_ID : undefined,
    value: definition.default_value ?? null,
    is_overridden: false,
    is_inherited: false,
    inheritance_path: undefined,
    inherited_from_value_id: undefined,
    locked_until: undefined,
    effective_from: BASE_TIMESTAMP,
    effective_to: undefined,
    source: "DEFAULT",
    status: "ACTIVE",
    notes: undefined,
    context: {},
    metadata: {},
    created_at: BASE_TIMESTAMP,
    updated_at: BASE_TIMESTAMP,
    created_by: SYSTEM_USER_ID,
    updated_by: SYSTEM_USER_ID,
  };
};

const baseValues = settingsCatalogData.definitions.map(scopeValueFactory);

const overriddenValues: SettingsValue[] = [
  {
    id: generateDeterministicUuid("VALUE:BOOKING.ENGINE.DISPLAY:PROPERTY_OVERRIDE"),
    setting_id: generateDeterministicUuid(
      "SETTING:BOOKING_ENGINE_GUEST:BOOKING_ENGINE_DISPLAY:BOOKING.ENGINE.DISPLAY",
    ),
    scope_level: SettingsScopeEnum.enum.PROPERTY,
    tenant_id: SAMPLE_TENANT_ID,
    property_id: SAMPLE_PROPERTY_ID,
    unit_id: undefined,
    user_id: undefined,
    value: {
      theme: "BOUTIQUE",
      primaryColor: "#E91E63",
      widgetTypes: ["EMBEDDED"],
      supportedLanguages: ["en", "ja"],
      showPromoCodeField: false,
    },
    is_overridden: true,
    is_inherited: false,
    inheritance_path: [],
    inherited_from_value_id: generateDeterministicUuid("VALUE:BOOKING.ENGINE.DISPLAY:TENANT"),
    locked_until: undefined,
    effective_from: BASE_TIMESTAMP,
    effective_to: undefined,
    source: "MANUAL",
    status: "ACTIVE",
    notes: "Boutique property branding override.",
    context: { reason: "BrandRefresh2025" },
    metadata: {},
    created_at: BASE_TIMESTAMP,
    updated_at: BASE_TIMESTAMP,
    created_by: SYSTEM_USER_ID,
    updated_by: SYSTEM_USER_ID,
  },
];

export const settingsValues: SettingsValue[] = [...baseValues, ...overriddenValues];
