import {
  buildRouteSchema,
  type JsonSchema,
  jsonObjectSchema,
  schemaFromZod,
} from "@tartware/openapi";
import {
  ActiveOnlyQuerySchema,
  CreateValueSchema,
  DefinitionsQuerySchema,
  OptionsQuerySchema,
  SectionsQuerySchema,
  SettingsCategoryListSchema,
  SettingsDefinitionListSchema,
  SettingsOptionListSchema,
  SettingsSectionListSchema,
  UpdateValueSchema,
  ValuesQuerySchema,
} from "@tartware/schemas";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";

import { config } from "../config.js";
import { settingsCatalogData } from "../data/settings-catalog.js";
import { createSeedValue, listSeedValues, updateSeedValue } from "../data/settings-values-store.js";
import {
  listCategories as listDbCategories,
  listDefinitions as listDbDefinitions,
  listOptions as listDbOptions,
  listSections as listDbSections,
} from "../repositories/settings-catalog-repository.js";
import {
  createValue as createDbValue,
  listValues as listDbValues,
  updateValue as updateDbValue,
} from "../repositories/settings-values-repository.js";

const SETTINGS_CATALOG_TAG = "Settings Catalog";
const defaultSettingsResponseSchema = jsonObjectSchema;

const SettingsCategoryListJson = schemaFromZod(
  SettingsCategoryListSchema,
  "SettingsCategoryListResponse",
);
const SettingsSectionListJson = schemaFromZod(
  SettingsSectionListSchema,
  "SettingsSectionListResponse",
);
const SettingsDefinitionListJson = schemaFromZod(
  SettingsDefinitionListSchema,
  "SettingsDefinitionListResponse",
);
const SettingsOptionListJson = schemaFromZod(
  SettingsOptionListSchema,
  "SettingsOptionListResponse",
);

const ActiveOnlyQueryJson = schemaFromZod(ActiveOnlyQuerySchema, "SettingsActiveOnlyQuery");
const SectionsQueryJson = schemaFromZod(SectionsQuerySchema, "SettingsSectionsQuery");
const DefinitionsQueryJson = schemaFromZod(DefinitionsQuerySchema, "SettingsDefinitionsQuery");
const OptionsQueryJson = schemaFromZod(OptionsQuerySchema, "SettingsOptionsQuery");
const ValuesQueryJson = schemaFromZod(ValuesQuerySchema, "SettingsValuesQuery");
const CreateValueJson = schemaFromZod(CreateValueSchema, "SettingsValueCreate");
const UpdateValueJson = schemaFromZod(UpdateValueSchema, "SettingsValueUpdate");
const isDbEnabled = () => config.settings.dataSource === "db";
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
    async () => {
      if (!isDbEnabled()) {
        return {
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
        };
      }

      const [categories, sections, definitions, options] = await Promise.all([
        listDbCategories({ activeOnly: false }),
        listDbSections({ activeOnly: false }),
        listDbDefinitions({ activeOnly: false }),
        listDbOptions({ activeOnly: false }),
      ]);
      const lastUpdated =
        definitions
          .map((item) => item.updated_at ?? item.created_at)
          .sort((a, b) => Number(b) - Number(a))[0] ?? null;
      return {
        data: {
          categories,
          sections,
          definitions,
          options,
        },
        meta: {
          counts: {
            categories: categories.length,
            sections: sections.length,
            definitions: definitions.length,
            options: options.length,
          },
          lastUpdated,
        },
      };
    },
  );

  app.get(
    "/v1/settings/categories",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_CATALOG_TAG,
        summary: "List settings categories",
        querystring: ActiveOnlyQueryJson,
        response: { 200: SettingsCategoryListJson },
      }),
    },
    async (request) => {
      const { active_only } = ActiveOnlyQuerySchema.parse(request.query ?? {});
      const categories = isDbEnabled()
        ? await listDbCategories({ activeOnly: active_only })
        : active_only
          ? settingsCatalogData.categories.filter((item) => item.is_active)
          : settingsCatalogData.categories;
      return SettingsCategoryListSchema.parse({
        data: categories,
        meta: { count: categories.length },
      });
    },
  );

  app.get(
    "/v1/settings/sections",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_CATALOG_TAG,
        summary: "List settings sections",
        querystring: SectionsQueryJson,
        response: { 200: SettingsSectionListJson },
      }),
    },
    async (request) => {
      const { active_only, category_id, category_code } = SectionsQuerySchema.parse(
        request.query ?? {},
      );
      let sections = isDbEnabled()
        ? await listDbSections({ activeOnly: active_only, categoryId: category_id })
        : settingsCatalogData.sections;
      if (active_only) {
        sections = sections.filter((item) => item.is_active);
      }
      if (category_id) {
        sections = sections.filter((item) => item.category_id === category_id);
      }
      if (category_code) {
        const category = settingsCatalogData.categories.find(
          (item) => item.code === category_code.toUpperCase(),
        );
        sections = category ? sections.filter((item) => item.category_id === category.id) : [];
      }
      return SettingsSectionListSchema.parse({
        data: sections,
        meta: { count: sections.length },
      });
    },
  );

  app.get(
    "/v1/settings/definitions",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_CATALOG_TAG,
        summary: "List settings definitions",
        querystring: DefinitionsQueryJson,
        response: { 200: SettingsDefinitionListJson },
      }),
    },
    async (request) => {
      const { active_only, category_id, section_id, category_code, section_code, search } =
        DefinitionsQuerySchema.parse(request.query ?? {});
      let definitions = isDbEnabled()
        ? await listDbDefinitions({
            activeOnly: active_only,
            categoryId: category_id,
            sectionId: section_id,
            search,
          })
        : settingsCatalogData.definitions;
      if (active_only) {
        definitions = definitions.filter((item) => !item.is_deprecated);
      }
      if (category_id) {
        definitions = definitions.filter((item) => item.category_id === category_id);
      }
      if (section_id) {
        definitions = definitions.filter((item) => item.section_id === section_id);
      }
      if (category_code) {
        const category = settingsCatalogData.categories.find(
          (item) => item.code === category_code.toUpperCase(),
        );
        definitions = category
          ? definitions.filter((item) => item.category_id === category.id)
          : [];
      }
      if (section_code) {
        const section = settingsCatalogData.sections.find(
          (item) => item.code === section_code.toUpperCase(),
        );
        definitions = section ? definitions.filter((item) => item.section_id === section.id) : [];
      }
      if (search) {
        const needle = search.toLowerCase();
        definitions = definitions.filter((item) =>
          [item.code, item.name, item.description].some((field) =>
            field?.toLowerCase().includes(needle),
          ),
        );
      }
      return SettingsDefinitionListSchema.parse({
        data: definitions,
        meta: { count: definitions.length },
      });
    },
  );

  app.get(
    "/v1/settings/options",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_CATALOG_TAG,
        summary: "List settings options",
        querystring: OptionsQueryJson,
        response: { 200: SettingsOptionListJson },
      }),
    },
    async (request) => {
      const { active_only, setting_id, setting_code } = OptionsQuerySchema.parse(
        request.query ?? {},
      );
      let options = isDbEnabled()
        ? await listDbOptions({ activeOnly: active_only, settingId: setting_id })
        : settingsCatalogData.options;
      if (active_only) {
        options = options.filter((item) => item.is_active);
      }
      if (setting_id) {
        options = options.filter((item) => item.setting_id === setting_id);
      }
      if (setting_code) {
        const definition = settingsCatalogData.definitions.find(
          (item) => item.code === setting_code,
        );
        options = definition ? options.filter((item) => item.setting_id === definition.id) : [];
      }
      return SettingsOptionListSchema.parse({
        data: options,
        meta: { count: options.length },
      });
    },
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
      const normalized = categoryCode.toUpperCase();
      const category = isDbEnabled()
        ? (await listDbCategories({ activeOnly: false })).find((item) => item.code === normalized)
        : settingsCatalogData.categories.find((item) => item.code === normalized);

      if (!category) {
        return reply.status(404).send({
          message: `Settings category ${categoryCode} not found`,
        });
      }

      const sections = isDbEnabled()
        ? await listDbSections({ activeOnly: false, categoryId: category.id })
        : settingsCatalogData.sections.filter((section) => section.category_id === category.id);
      const sectionIds = new Set(sections.map((section) => section.id));
      const definitions = isDbEnabled()
        ? (await listDbDefinitions({ activeOnly: false, categoryId: category.id })).filter(
            (definition) => sectionIds.has(definition.section_id),
          )
        : settingsCatalogData.definitions.filter((definition) =>
            sectionIds.has(definition.section_id),
          );
      const definitionIds = new Set(definitions.map((definition) => definition.id));
      const options = isDbEnabled()
        ? (await listDbOptions({ activeOnly: false })).filter((option) =>
            definitionIds.has(option.setting_id),
          )
        : settingsCatalogData.options.filter((option) => definitionIds.has(option.setting_id));

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
        querystring: ValuesQueryJson,
        response: {
          200: defaultSettingsResponseSchema,
        },
      }),
    },
    async (request) => {
      if (!isDbEnabled()) {
        const { scope_level, setting_id, property_id, unit_id, user_id, active_only } =
          ValuesQuerySchema.parse(request.query ?? {});
        const seedValues = listSeedValues({
          scopeLevel: scope_level,
          settingId: setting_id,
          propertyId: property_id,
          unitId: unit_id,
          userId: user_id,
          activeOnly: active_only,
        });
        return {
          data: seedValues,
          meta: {
            count: seedValues.length,
            sampleTenantId: seedValues[0]?.tenant_id ?? null,
          },
        };
      }

      const { scope_level, setting_id, property_id, unit_id, user_id, active_only } =
        ValuesQuerySchema.parse(request.query ?? {});
      const tenantId = request.authUser?.tenantId;
      if (!tenantId) {
        return {
          data: [],
          meta: {
            count: 0,
            sampleTenantId: null,
          },
        };
      }
      const values = await listDbValues({
        tenantId,
        scopeLevel: scope_level,
        settingId: setting_id,
        propertyId: property_id,
        unitId: unit_id,
        userId: user_id,
        activeOnly: active_only,
      });
      return {
        data: values,
        meta: {
          count: values.length,
          sampleTenantId: values[0]?.tenant_id ?? null,
        },
      };
    },
  );

  app.post(
    "/v1/settings/values",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_CATALOG_TAG,
        summary: "Create a settings value",
        body: CreateValueJson,
        response: {
          201: defaultSettingsResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      if (!isDbEnabled()) {
        const tenantId = request.authUser?.tenantId;
        if (!tenantId) {
          reply.status(403).send({ message: "Tenant context required" });
          return;
        }
        const body = CreateValueSchema.parse(request.body);
        const created = createSeedValue({
          tenantId,
          settingId: body.setting_id,
          scopeLevel: body.scope_level,
          value: body.value,
          propertyId: body.property_id ?? null,
          unitId: body.unit_id ?? null,
          userId: body.user_id ?? null,
          status: body.status ?? null,
          notes: body.notes ?? null,
          effectiveFrom: body.effective_from ?? null,
          effectiveTo: body.effective_to ?? null,
          context: body.context ?? null,
          metadata: body.metadata ?? null,
          createdBy: request.authUser?.sub ?? null,
        });
        reply.status(201).send({ data: created });
        return;
      }
      const tenantId = request.authUser?.tenantId;
      if (!tenantId) {
        reply.status(403).send({ message: "Tenant context required" });
        return;
      }
      const body = CreateValueSchema.parse(request.body);
      const created = await createDbValue({
        tenantId,
        settingId: body.setting_id,
        scopeLevel: body.scope_level,
        value: body.value,
        propertyId: body.property_id ?? null,
        unitId: body.unit_id ?? null,
        userId: body.user_id ?? null,
        status: body.status ?? null,
        notes: body.notes ?? null,
        effectiveFrom: body.effective_from ?? null,
        effectiveTo: body.effective_to ?? null,
        context: body.context ?? null,
        metadata: body.metadata ?? null,
        createdBy: request.authUser?.sub ?? null,
      });
      reply.status(201).send({ data: created });
    },
  );

  app.patch(
    "/v1/settings/values/:valueId",
    {
      schema: buildRouteSchema({
        tag: SETTINGS_CATALOG_TAG,
        summary: "Update a settings value",
        params: schemaFromZod(z.object({ valueId: z.string().uuid() }), "SettingsValueIdParams"),
        body: UpdateValueJson,
        response: {
          200: defaultSettingsResponseSchema,
          404: defaultSettingsResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      if (!isDbEnabled()) {
        const tenantId = request.authUser?.tenantId;
        if (!tenantId) {
          reply.status(403).send({ message: "Tenant context required" });
          return;
        }
        const { valueId } = z.object({ valueId: z.string().uuid() }).parse(request.params);
        const body = UpdateValueSchema.parse(request.body);
        const updated = updateSeedValue({
          valueId,
          tenantId,
          value: body.value ?? null,
          status: body.status ?? null,
          notes: body.notes ?? null,
          effectiveFrom: body.effective_from ?? null,
          effectiveTo: body.effective_to ?? null,
          lockedUntil: body.locked_until ?? null,
          context: body.context ?? null,
          metadata: body.metadata ?? null,
          updatedBy: request.authUser?.sub ?? null,
        });
        if (!updated) {
          reply.status(404).send({ message: "Settings value not found" });
          return;
        }
        reply.send({ data: updated });
        return;
      }
      const tenantId = request.authUser?.tenantId;
      if (!tenantId) {
        reply.status(403).send({ message: "Tenant context required" });
        return;
      }
      const { valueId } = z.object({ valueId: z.string().uuid() }).parse(request.params);
      const body = UpdateValueSchema.parse(request.body);
      const updated = await updateDbValue({
        valueId,
        tenantId,
        value: body.value,
        status: body.status ?? null,
        notes: body.notes ?? null,
        effectiveFrom: body.effective_from ?? null,
        effectiveTo: body.effective_to ?? null,
        lockedUntil: body.locked_until ?? null,
        context: body.context ?? null,
        metadata: body.metadata ?? null,
        updatedBy: request.authUser?.sub ?? null,
      });
      if (!updated) {
        reply.status(404).send({ message: "Settings value not found" });
        return;
      }
      reply.send({ data: updated });
    },
  );
};

export default fp(catalogRoutes, {
  name: "settings-catalog-routes",
});
