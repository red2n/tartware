import {
  SettingsCategoriesSchema,
  SettingsDefinitionsSchema,
  SettingsOptionsSchema,
  SettingsSectionsSchema,
} from "@tartware/schemas";
import { z } from "zod";

import { query } from "../lib/db.js";

const SettingsCategoryArraySchema = z.array(SettingsCategoriesSchema);
const SettingsSectionArraySchema = z.array(SettingsSectionsSchema);
const SettingsDefinitionArraySchema = z.array(SettingsDefinitionsSchema);
const SettingsOptionArraySchema = z.array(SettingsOptionsSchema);

const escapeLike = (value: string) => value.replace(/([\\%_])/g, "\\$1");

export type CatalogFilters = {
  activeOnly: boolean;
  categoryId?: string;
  sectionId?: string;
  settingId?: string;
  search?: string;
};

export const listCategories = async (filters: CatalogFilters) => {
  const params: unknown[] = [];
  let where = "";
  if (filters.activeOnly) {
    params.push(true);
    where = "WHERE is_active = $1";
  }

  const { rows } = await query(
    `SELECT id, code, name, description, icon, color, sort_order, is_active, tags, metadata, created_at, updated_at
     FROM settings_categories ${where} ORDER BY sort_order ASC, name ASC`,
    params,
  );
  return SettingsCategoryArraySchema.parse(rows);
};

export const listSections = async (filters: CatalogFilters) => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.activeOnly) {
    params.push(true);
    conditions.push(`is_active = $${params.length}`);
  }
  if (filters.categoryId) {
    params.push(filters.categoryId);
    conditions.push(`category_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT id, category_id, code, name, description, icon, sort_order, is_active, tags, metadata, created_at, updated_at
     FROM settings_sections ${where} ORDER BY sort_order ASC, name ASC`,
    params,
  );
  return SettingsSectionArraySchema.parse(rows);
};

export const listDefinitions = async (filters: CatalogFilters) => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.activeOnly) {
    params.push(true);
    conditions.push(`is_active = $${params.length}`);
  }
  if (filters.categoryId) {
    params.push(filters.categoryId);
    conditions.push(`category_id = $${params.length}`);
  }
  if (filters.sectionId) {
    params.push(filters.sectionId);
    conditions.push(`section_id = $${params.length}`);
  }
  if (filters.search) {
    const escaped = escapeLike(filters.search.toLowerCase());
    params.push(`%${escaped}%`);
    const idx = params.length;
    conditions.push(
      `(LOWER(code) LIKE $${idx} ESCAPE '\\' OR LOWER(name) LIKE $${idx} ESCAPE '\\' OR LOWER(description) LIKE $${idx} ESCAPE '\\')`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT id, category_id, section_id, code, name, description, help_text, placeholder, tooltip,
            data_type, control_type, default_value, value_constraints, allowed_scopes, default_scope,
            override_scopes, is_required, is_advanced, is_readonly, is_deprecated, sensitivity,
            module_dependencies, feature_flag, compliance_tags, related_settings, labels, tags,
            sort_order, version, reference_docs, form_schema, metadata, created_at, updated_at,
            created_by, updated_by
     FROM settings_definitions ${where} ORDER BY sort_order ASC, name ASC`,
    params,
  );
  return SettingsDefinitionArraySchema.parse(rows);
};

export const listOptions = async (filters: CatalogFilters) => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.activeOnly) {
    params.push(true);
    conditions.push(`is_active = $${params.length}`);
  }
  if (filters.settingId) {
    params.push(filters.settingId);
    conditions.push(`setting_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT id, setting_id, value, label, description, icon, color, sort_order, is_default, is_active,
            metadata, created_at, updated_at, created_by, updated_by
     FROM settings_options ${where} ORDER BY sort_order ASC, label ASC`,
    params,
  );
  return SettingsOptionArraySchema.parse(rows);
};
