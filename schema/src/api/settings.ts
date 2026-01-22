/**
 * DEV DOC
 * Module: api/settings.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import {
	SettingsCategoriesSchema,
	SettingsDefinitionsSchema,
	SettingsOptionsSchema,
	SettingsSectionsSchema,
	SettingsValuesSchema,
} from "../schemas/08-settings/index.js";

export const SettingsCatalogResponseSchema = z.object({
	data: z.object({
		categories: z.array(SettingsCategoriesSchema),
		sections: z.array(SettingsSectionsSchema),
		definitions: z.array(SettingsDefinitionsSchema),
		options: z.array(SettingsOptionsSchema),
	}),
	meta: z.object({
		counts: z.object({
			categories: z.number().int().nonnegative(),
			sections: z.number().int().nonnegative(),
			definitions: z.number().int().nonnegative(),
			options: z.number().int().nonnegative(),
		}),
		lastUpdated: z.string().nullable(),
	}),
});
export type SettingsCatalogResponse = z.infer<typeof SettingsCatalogResponseSchema>;

export const SettingsValuesResponseSchema = z.object({
	data: z.array(SettingsValuesSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
		sampleTenantId: z.string().nullable(),
	}),
});
export type SettingsValuesResponse = z.infer<typeof SettingsValuesResponseSchema>;
