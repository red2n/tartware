import { buildRouteSchema, type JsonSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { settingsCatalogData } from "../data/settings-catalog.js";
import { settingsValues } from "../data/settings-values.js";

const SETTINGS_CATALOG_TAG = "Settings Catalog";
const defaultSettingsResponseSchema = jsonObjectSchema;
const catalogParamsSchema = {
  type: "object",
  properties: {
    categoryCode: { type: "string" },
  },
  required: ["categoryCode"],
  additionalProperties: false,
} as const satisfies JsonSchema;

const notFoundSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
  additionalProperties: true,
} as const satisfies JsonSchema;

const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/v1/settings/catalog",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_CATALOG_TAG,
        summary: "List the full settings catalog definitions",
        response: {
          200: defaultSettingsResponseSchema,
        },
      }),
    },
    async () => ({
      data: settingsCatalogData,
      meta: {
        counts: {
          categories: settingsCatalogData.categories.length,
          sections: settingsCatalogData.sections.length,
          definitions: settingsCatalogData.definitions.length,
          options: settingsCatalogData.options.length,
        },
        lastUpdated: settingsCatalogData.definitions[0]?.updated_at ?? null,
      },
    }),
  );

  app.get(
    "/v1/settings/catalog/:categoryCode",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_CATALOG_TAG,
        summary: "Retrieve catalog metadata for a specific category",
        params: catalogParamsSchema,
        response: {
          200: defaultSettingsResponseSchema,
          404: notFoundSchema,
        },
      }),
    },
    async (request, reply) => {
      const { categoryCode } = request.params as { categoryCode: string };
      const category = settingsCatalogData.categories.find(
        (item) => item.code === categoryCode.toUpperCase(),
      );

      if (!category) {
        return reply.status(404).send({
          message: `Settings category ${categoryCode} not found`,
        });
      }

      const sections = settingsCatalogData.sections.filter(
        (section) => section.category_id === category.id,
      );
      const sectionIds = new Set(sections.map((section) => section.id));
      const definitions = settingsCatalogData.definitions.filter((definition) =>
        sectionIds.has(definition.section_id),
      );
      const definitionIds = new Set(definitions.map((definition) => definition.id));
      const options = settingsCatalogData.options.filter((option) =>
        definitionIds.has(option.setting_id),
      );

      return {
        data: {
          category,
          sections,
          definitions,
          options,
        },
        meta: {
          counts: {
            sections: sections.length,
            definitions: definitions.length,
            options: options.length,
          },
        },
      };
    },
  );

  app.get(
    "/v1/settings/values",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_CATALOG_TAG,
        summary: "Return snapshot of seeded settings values",
        response: {
          200: defaultSettingsResponseSchema,
        },
      }),
    },
    async () => ({
      data: settingsValues,
      meta: {
        count: settingsValues.length,
        sampleTenantId: settingsValues[0]?.tenant_id ?? null,
      },
    }),
  );
};

export default fp(catalogRoutes, {
  name: "settings-catalog-routes",
  dependencies: ["@fastify/jwt"],
});
