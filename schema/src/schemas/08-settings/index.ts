/**
 * DEV DOC
 * Module: schemas/08-settings/index.ts
 * Description: Settings Catalog Schemas (Category 08)
 * Category: 08-settings
 * Primary exports: settings-categories, settings-sections, settings-definitions, settings-options, settings-values
 * @table n/a
 * @category 08-settings
 * Ownership: Schema package
 */

/**
 * Settings Catalog Schemas (Category 08)
 * Hierarchical catalog and value storage for configuration settings
 *
 * Tables: 5
 * - settings_categories
 * - settings_sections
 * - settings_definitions
 * - settings_options
 * - settings_values
 */

export * from "./settings-categories.js";
export * from "./settings-definitions.js";
export * from "./settings-options.js";
export * from "./settings-sections.js";
export * from "./settings-values.js";
