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

export type CatalogFilters = {
  activeOnly: boolean;
  categoryId?: string;
  sectionId?: string;
  settingId?: string;
  search?: string;
};

export const listCategories = async (
  filters: CatalogFilters,
) => {
  const params: unknown[] = [];
  let where = "";
  if (filters.activeOnly) {
    params.push(true);
    where = "WHERE is_active = $1";
  }

  const { rows } = await query(
    `SELECT * FROM settings_categories ${where} ORDER BY sort_order ASC, name ASC`,
    params,
  );
  return SettingsCategoryArraySchema.parse(rows);
};

export const listSections = async (
  filters: CatalogFilters,
) => {
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
    `SELECT * FROM settings_sections ${where} ORDER BY sort_order ASC, name ASC`,
    params,
  );
  return SettingsSectionArraySchema.parse(rows);
};

export const listDefinitions = async (
  filters: CatalogFilters,
) => {
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
    params.push(`%${filters.search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(
      `(LOWER(code) LIKE $${idx} OR LOWER(name) LIKE $${idx} OR LOWER(description) LIKE $${idx})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT * FROM settings_definitions ${where} ORDER BY sort_order ASC, name ASC`,
    params,
  );
  return SettingsDefinitionArraySchema.parse(rows);
};

export const listOptions = async (
  filters: CatalogFilters,
) => {
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
    `SELECT * FROM settings_options ${where} ORDER BY sort_order ASC, label ASC`,
    params,
  );
  return SettingsOptionArraySchema.parse(rows);
};
