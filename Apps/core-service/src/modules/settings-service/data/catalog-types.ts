import type {
  SettingsControlTypeEnum,
  SettingsDataTypeEnum,
  SettingsScopeEnum,
  SettingsSensitivityEnum,
} from "@tartware/schemas";

export type RawDefinition = {
  code: string;
  name: string;
  description: string;
  controlType: keyof typeof SettingsControlTypeEnum.enum;
  dataType: keyof typeof SettingsDataTypeEnum.enum;
  defaultScope: keyof typeof SettingsScopeEnum.enum;
  allowedScopes: Array<keyof typeof SettingsScopeEnum.enum>;
  overrideScopes?: Array<keyof typeof SettingsScopeEnum.enum>;
  defaultValue?: unknown;
  valueConstraints?: Record<string, unknown>;
  formSchema?: Record<string, unknown>;
  tags?: string[];
  moduleDependencies?: string[];
  referenceDocs?: string[];
  sensitivity?: keyof typeof SettingsSensitivityEnum.enum;
  options?: Array<{
    value: string;
    label: string;
    description?: string;
    icon?: string;
    color?: string;
    isDefault?: boolean;
  }>;
};

export type RawSection = {
  code: string;
  name: string;
  description: string;
  icon?: string;
  tags?: string[];
  definitions: RawDefinition[];
};

export type RawCategory = {
  code: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  tags?: string[];
  sections: RawSection[];
};
