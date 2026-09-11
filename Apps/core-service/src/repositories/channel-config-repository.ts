/**
 * DEV DOC
 * Module: repositories/channel-config-repository.ts
 * Purpose: The only SQL that writes the three channel-configuration tables.
 * Ownership: core-service
 *
 * `ota_configurations`, `channel_mappings` and `ota_rate_plans` had list routes
 * and no write route at all, so a property could not onboard a channel through
 * the product. These are the writes that close that.
 *
 * `ota_rate_plans` upserts on its single natural key. The other two do not,
 * and that is deliberate rather than an omission: `channel_mappings` carries
 * *two* unique constraints — `(tenant_id, channel_code, external_id)` and
 * `(tenant_id, property_id, channel_code, entity_type, entity_id)` — so a
 * single `ON CONFLICT` cannot cover both, and picking one would silently
 * rewrite a mapping under the other. A duplicate is reported as a conflict and
 * left for a human to resolve.
 *
 * {@link isUniqueViolation} exists because the alternative is what this code
 * did first: the driver's error escaped the route as a 500 carrying the
 * constraint name to the caller, which is both a bad answer and an internals
 * leak.
 */

import type {
  ChannelConfigCreate,
  ChannelConfigUpdate,
  ChannelMappingCreate,
  OtaRatePlanCreate,
} from "@tartware/schemas";

import { query } from "../lib/db.js";

/**
 * A unique-constraint violation, as the driver reports it.
 *
 * `23505` is the SQLSTATE; the message carries the constraint name, which is
 * useful in a log and must not reach an API caller.
 */
export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";

/** Credentials are never selected back — see `channel-config.ts`. */
const CONFIG_RETURNING = `
  RETURNING id, tenant_id, property_id, ota_name, ota_code, api_endpoint,
            hotel_id, channel_manager, transport, is_active, sync_enabled,
            (api_key IS NOT NULL AND api_secret IS NOT NULL) AS has_credentials,
            created_at, updated_at
`;

const INSERT_CONFIG_SQL = `
  INSERT INTO public.ota_configurations (
    tenant_id, property_id, ota_name, ota_code, api_endpoint, api_key,
    api_secret, hotel_id, channel_manager, transport, is_active, sync_enabled,
    created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9,
    COALESCE($10, 'NONE'), COALESCE($11, TRUE), COALESCE($12, TRUE), $13, $13
  )
  ${CONFIG_RETURNING}
`;

export type ChannelConfigRecord = {
  id: string;
  tenant_id: string;
  property_id: string;
  ota_name: string;
  ota_code: string;
  transport: string;
  has_credentials: boolean;
  is_active: boolean;
};

export const insertChannelConfig = async (
  tenantId: string,
  actorId: string,
  input: ChannelConfigCreate,
): Promise<ChannelConfigRecord | null> => {
  const { rows } = await query<ChannelConfigRecord>(INSERT_CONFIG_SQL, [
    tenantId,
    input.property_id,
    input.ota_name,
    input.ota_code,
    input.api_endpoint ?? null,
    input.api_key ?? null,
    input.api_secret ?? null,
    input.hotel_id ?? null,
    input.channel_manager ?? null,
    input.transport ?? null,
    input.is_active ?? null,
    input.sync_enabled ?? null,
    actorId,
  ]);
  return rows[0] ?? null;
};

/**
 * Patch a configuration.
 *
 * `COALESCE($n, column)` per field rather than an assembled SET clause: the
 * shape is fixed and small, and a hand-built clause is the pattern the audit
 * left inline in three places precisely because it resists being read.
 */
const UPDATE_CONFIG_SQL = `
  UPDATE public.ota_configurations
     SET ota_name        = COALESCE($3, ota_name),
         api_endpoint    = COALESCE($4, api_endpoint),
         api_key         = COALESCE($5, api_key),
         api_secret      = COALESCE($6, api_secret),
         hotel_id        = COALESCE($7, hotel_id),
         channel_manager = COALESCE($8, channel_manager),
         transport       = COALESCE($9, transport),
         is_active       = COALESCE($10, is_active),
         sync_enabled    = COALESCE($11, sync_enabled),
         updated_at      = NOW(),
         updated_by      = $12
   WHERE id = $1::uuid AND tenant_id = $2::uuid
  ${CONFIG_RETURNING}
`;

export const updateChannelConfig = async (
  tenantId: string,
  configId: string,
  actorId: string,
  input: ChannelConfigUpdate,
): Promise<ChannelConfigRecord | null> => {
  const { rows } = await query<ChannelConfigRecord>(UPDATE_CONFIG_SQL, [
    configId,
    tenantId,
    input.ota_name ?? null,
    input.api_endpoint ?? null,
    input.api_key ?? null,
    input.api_secret ?? null,
    input.hotel_id ?? null,
    input.channel_manager ?? null,
    input.transport ?? null,
    input.is_active ?? null,
    input.sync_enabled ?? null,
    actorId,
  ]);
  return rows[0] ?? null;
};

const INSERT_MAPPING_SQL = `
  INSERT INTO public.channel_mappings (
    tenant_id, property_id, channel_name, channel_code, entity_type, entity_id,
    external_id, external_code, is_active, created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7, $8, COALESCE($9, TRUE), $10, $10
  )
  RETURNING id, tenant_id, property_id, channel_code, entity_type, entity_id,
            external_id, is_active
`;

export type ChannelMappingRecord = {
  id: string;
  channel_code: string;
  entity_type: string;
  entity_id: string;
  is_active: boolean;
};

export const insertChannelMapping = async (
  tenantId: string,
  actorId: string,
  input: ChannelMappingCreate,
): Promise<ChannelMappingRecord | null> => {
  const { rows } = await query<ChannelMappingRecord>(INSERT_MAPPING_SQL, [
    tenantId,
    input.property_id,
    input.channel_name,
    input.channel_code,
    input.entity_type,
    input.entity_id,
    input.external_id,
    input.external_code ?? null,
    input.is_active ?? null,
    actorId,
  ]);
  return rows[0] ?? null;
};

const INSERT_RATE_PLAN_SQL = `
  INSERT INTO public.ota_rate_plans (
    tenant_id, property_id, ota_configuration_id, rate_id, ota_rate_plan_id,
    ota_rate_plan_name, markup_percentage, markdown_percentage, is_active,
    created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8,
    COALESCE($9, TRUE), $10, $10
  )
  ON CONFLICT ON CONSTRAINT uq_ota_rate_plan_mapping DO UPDATE
     SET ota_rate_plan_name = EXCLUDED.ota_rate_plan_name,
         is_active          = EXCLUDED.is_active,
         updated_at         = NOW(),
         updated_by         = EXCLUDED.updated_by
  RETURNING id, tenant_id, property_id, ota_configuration_id, rate_id,
            ota_rate_plan_id, is_active
`;

export type OtaRatePlanRecord = {
  id: string;
  ota_configuration_id: string;
  rate_id: string;
  ota_rate_plan_id: string;
  is_active: boolean;
};

export const insertOtaRatePlan = async (
  tenantId: string,
  actorId: string,
  input: OtaRatePlanCreate,
): Promise<OtaRatePlanRecord | null> => {
  const { rows } = await query<OtaRatePlanRecord>(INSERT_RATE_PLAN_SQL, [
    tenantId,
    input.property_id,
    input.ota_configuration_id,
    input.rate_id,
    input.ota_rate_plan_id,
    input.ota_rate_plan_name ?? null,
    input.markup_percentage ?? null,
    input.markdown_percentage ?? null,
    input.is_active ?? null,
    actorId,
  ]);
  return rows[0] ?? null;
};
