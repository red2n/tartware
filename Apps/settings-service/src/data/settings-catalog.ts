import { createHash } from "node:crypto";

import type {
  SettingsCategory,
  SettingsDefinition,
  SettingsOption,
  SettingsScope,
  SettingsSection,
} from "@tartware/schemas";
import {
  SettingsControlTypeEnum,
  SettingsDataTypeEnum,
  SettingsScopeEnum,
  SettingsSensitivityEnum,
} from "@tartware/schemas";

import { catalogCategories } from "./catalog/index.js";
import type { RawCategory } from "./catalog-types.js";

const BASE_TIMESTAMP = new Date("2025-11-12T00:00:00Z");
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const UUID_NAMESPACE = "4f19b8a1-1132-4ffc-8a10-b5f51a9f90d1";
const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

const rawCatalog: RawCategory[] = catalogCategories;

function deterministicUuid(name: string): string {
  const namespaceBytes = Buffer.from(UUID_NAMESPACE.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(name);

  const hash = createHash("sha1");
  hash.update(namespaceBytes);
  hash.update(nameBytes);
  const digest = hash.digest();

  const sixth = digest[6] ?? 0;
  const eighth = digest[8] ?? 0;
  digest[6] = (sixth & 0x0f) | 0x50;
  digest[8] = (eighth & 0x3f) | 0x80;

  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(
    20,
    32,
  )}`;
}

const mapScopes = (scopes: Array<keyof typeof SettingsScopeEnum.enum>): SettingsScope[] =>
  scopes.map((scope) => SettingsScopeEnum.enum[scope] as SettingsScope);

const categories: SettingsCategory[] = rawCatalog.map((category, index) => ({
  id: deterministicUuid(`CATEGORY:${category.code}`),
  tenant_id: DEFAULT_TENANT_ID,
  code: category.code,
  name: category.name,
  description: category.description,
  icon: category.icon,
  color: category.color,
  sort_order: index,
  is_active: true,
  tags: category.tags,
  metadata: {},
  created_at: BASE_TIMESTAMP,
  updated_at: BASE_TIMESTAMP,
}));

const sections: SettingsSection[] = rawCatalog.flatMap((category) =>
  category.sections.map((section, sectionIndex) => ({
    id: deterministicUuid(`SECTION:${category.code}:${section.code}`),
    tenant_id: DEFAULT_TENANT_ID,
    category_id: deterministicUuid(`CATEGORY:${category.code}`),
    code: section.code,
    name: section.name,
    description: section.description,
    icon: section.icon,
    sort_order: sectionIndex,
    is_active: true,
    tags: section.tags,
    metadata: {},
    created_at: BASE_TIMESTAMP,
    updated_at: BASE_TIMESTAMP,
  })),
);

const definitions = rawCatalog.flatMap((category) =>
  category.sections.flatMap((section) =>
    section.definitions.map((definition, definitionIndex) => ({
      id: deterministicUuid(`SETTING:${category.code}:${section.code}:${definition.code}`),
      tenant_id: DEFAULT_TENANT_ID,
      category_id: deterministicUuid(`CATEGORY:${category.code}`),
      section_id: deterministicUuid(`SECTION:${category.code}:${section.code}`),
      code: definition.code,
      name: definition.name,
      description: definition.description,
      help_text: undefined,
      placeholder: undefined,
      tooltip: undefined,
      data_type: SettingsDataTypeEnum.enum[definition.dataType],
      control_type: SettingsControlTypeEnum.enum[definition.controlType],
      default_value: definition.defaultValue,
      value_constraints: definition.valueConstraints ?? {},
      allowed_scopes: mapScopes(definition.allowedScopes),
      default_scope: SettingsScopeEnum.enum[definition.defaultScope] as SettingsScope,
      override_scopes: definition.overrideScopes ? mapScopes(definition.overrideScopes) : undefined,
      is_required: true,
      is_advanced: definition.tags?.includes("advanced") ?? false,
      is_readonly: false,
      is_deprecated: false,
      sensitivity: definition.sensitivity
        ? SettingsSensitivityEnum.enum[definition.sensitivity]
        : SettingsSensitivityEnum.enum.INTERNAL,
      module_dependencies: definition.moduleDependencies,
      feature_flag: undefined,
      compliance_tags: definition.tags?.filter((tag) => tag.startsWith("compliance")),
      related_settings: undefined,
      labels: undefined,
      tags: definition.tags,
      sort_order: definitionIndex,
      version: "1.0.0",
      reference_docs: definition.referenceDocs,
      form_schema: definition.formSchema ?? {},
      metadata: {},
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
      created_by: SYSTEM_USER_ID,
      updated_by: SYSTEM_USER_ID,
    })),
  ),
) as SettingsDefinition[];

const options: SettingsOption[] = rawCatalog.flatMap((category) =>
  category.sections.flatMap((section) =>
    section.definitions.flatMap((definition) =>
      (definition.options ?? []).map((option, optionIndex) => ({
        id: deterministicUuid(
          `OPTION:${category.code}:${section.code}:${definition.code}:${option.value}`,
        ),
        tenant_id: DEFAULT_TENANT_ID,
        setting_id: deterministicUuid(
          `SETTING:${category.code}:${section.code}:${definition.code}`,
        ),
        value: option.value,
        label: option.label,
        description: option.description,
        icon: option.icon,
        color: option.color,
        sort_order: optionIndex,
        is_default: option.isDefault ?? false,
        is_active: true,
        metadata: {},
        created_at: BASE_TIMESTAMP,
        updated_at: BASE_TIMESTAMP,
        created_by: SYSTEM_USER_ID,
        updated_by: SYSTEM_USER_ID,
      })),
    ),
  ),
);

export const settingsCatalogData = {
  categories,
  sections,
  definitions,
  options,
};

export { deterministicUuid as generateDeterministicUuid };
