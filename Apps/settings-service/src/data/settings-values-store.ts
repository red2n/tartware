import { randomUUID } from "node:crypto";

import {
  SettingsScopeEnum,
  SettingsValuesSchema,
  type SettingsValue,
} from "@tartware/schemas";

import { settingsValues } from "./settings-values.js";

type SeedValueFilters = {
  tenantId?: string;
  scopeLevel?: string;
  settingId?: string;
  propertyId?: string;
  unitId?: string;
  userId?: string;
  activeOnly?: boolean;
};

type CreateSeedValueInput = {
  tenantId: string;
  settingId: string;
  scopeLevel: string;
  value?: unknown;
  propertyId?: string | null;
  unitId?: string | null;
  userId?: string | null;
  status?: "ACTIVE" | "PENDING" | "EXPIRED" | null;
  notes?: string | null;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
};

type UpdateSeedValueInput = {
  valueId: string;
  tenantId: string;
  value?: unknown | null;
  status?: "ACTIVE" | "PENDING" | "EXPIRED" | null;
  notes?: string | null;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  lockedUntil?: Date | string | null;
  context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  updatedBy?: string | null;
};

const seedStore: SettingsValue[] = settingsValues.map((value) =>
  SettingsValuesSchema.parse(value),
);

const normalizeScope = (value?: string): string | undefined =>
  value ? value.toUpperCase() : undefined;

const matchesScope = (value: string | undefined, filter?: string): boolean => {
  if (!filter) {
    return true;
  }
  const normalized = normalizeScope(filter);
  return normalized ? value === normalized : true;
};

const matchesOptional = (
  value: string | undefined,
  filter?: string,
): boolean => {
  if (!filter) {
    return true;
  }
  return value === filter;
};

export const listSeedValues = (filters: SeedValueFilters): SettingsValue[] => {
  return seedStore.filter((value) => {
    if (filters.activeOnly && value.status !== "ACTIVE") {
      return false;
    }
    if (filters.tenantId && value.tenant_id !== filters.tenantId) {
      return false;
    }
    if (!matchesScope(value.scope_level, filters.scopeLevel)) {
      return false;
    }
    if (!matchesOptional(value.setting_id, filters.settingId)) {
      return false;
    }
    if (!matchesOptional(value.property_id, filters.propertyId)) {
      return false;
    }
    if (!matchesOptional(value.unit_id, filters.unitId)) {
      return false;
    }
    if (!matchesOptional(value.user_id, filters.userId)) {
      return false;
    }
    return true;
  });
};

export const createSeedValue = (input: CreateSeedValueInput): SettingsValue => {
  const now = new Date();
  const scope = SettingsScopeEnum.parse(input.scopeLevel);
  const record = SettingsValuesSchema.parse({
    id: randomUUID(),
    setting_id: input.settingId,
    scope_level: scope,
    tenant_id: input.tenantId,
    property_id: input.propertyId ?? undefined,
    unit_id: input.unitId ?? undefined,
    user_id: input.userId ?? undefined,
    value: input.value ?? null,
    is_overridden: scope !== SettingsScopeEnum.enum.TENANT,
    is_inherited: false,
    inheritance_path: undefined,
    inherited_from_value_id: undefined,
    locked_until: undefined,
    effective_from: input.effectiveFrom ?? now,
    effective_to: input.effectiveTo ?? undefined,
    source: "API",
    status: input.status ?? "ACTIVE",
    notes: input.notes ?? undefined,
    context: input.context ?? {},
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
    created_by: input.createdBy ?? undefined,
    updated_by: input.createdBy ?? undefined,
  });

  seedStore.unshift(record);
  return record;
};

export const updateSeedValue = (
  input: UpdateSeedValueInput,
): SettingsValue | null => {
  const index = seedStore.findIndex(
    (value) => value.id === input.valueId && value.tenant_id === input.tenantId,
  );
  if (index < 0) {
    return null;
  }

  const current = seedStore[index];
  const updated: SettingsValue = SettingsValuesSchema.parse({
    ...current,
    value: input.value ?? current.value,
    status: input.status ?? current.status,
    notes: input.notes ?? current.notes,
    effective_from: input.effectiveFrom ?? current.effective_from,
    effective_to: input.effectiveTo ?? current.effective_to,
    locked_until: input.lockedUntil ?? current.locked_until,
    context: input.context ?? current.context,
    metadata: input.metadata ?? current.metadata,
    updated_at: new Date(),
    updated_by: input.updatedBy ?? current.updated_by,
  });

  seedStore[index] = updated;
  return updated;
};
