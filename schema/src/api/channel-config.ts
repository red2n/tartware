/**
 * DEV DOC
 * Module: api/channel-config.ts
 * Purpose: The write half of the channel contract — what a property sends to
 *          onboard a channel, map its room types and map its rate plans.
 * Ownership: Schema package (single source of truth)
 *
 * **Why this exists.** `ota_configurations`, `channel_mappings` and
 * `ota_rate_plans` had list routes and no write route of any kind. Every route
 * under `/v1/ota-configurations`, `/v1/ota-connections` and
 * `/v1/channel-mappings` was `app.get`, and no command in `COMMAND_MIN_ROLE`
 * created one. So the outbound push handlers refused with
 * `CHANNEL_MAPPING_MISSING` / `CHANNEL_RATE_PLANS_MISSING` against
 * configuration that nothing in the product could create — a property could not
 * onboard Booking.com through Tartware at all.
 *
 * It is the shape A11 found four times over: a handler, a catalogue row, a
 * permission floor and no route. It surfaced here because the end-to-end suite
 * is API-only, so a seam with no API is a seam the suite cannot cross.
 *
 * **Why request schemas rather than the generated `Create*` stubs.**
 * `CreateOtaConfigurationsSchema` in `schemas/06-integrations/` is
 * `OtaConfigurationsSchema.omit({})` with a `TODO` — it omits nothing, so it
 * demands `id`, `created_at` and the audit columns from the caller. These
 * declare what a caller actually supplies, and the server owns the rest.
 *
 * **Credentials are write-only.** `api_key` and `api_secret` can be set here
 * and are never returned: the list route excludes them in the query itself so a
 * secret cannot reach the serialisation layer to be leaked by accident, and
 * `has_credentials` reports only whether a pair is stored.
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

import { ChannelTransportKindEnum } from "./channel-transport.js";

/**
 * Onboard a channel, or update one.
 *
 * `transport` defaults to `NONE` in the DDL and `NONE` refuses a push, so a
 * configuration created without one is inert until somebody chooses how it
 * reaches the channel. That is the intended default: before the column existed
 * every push recorded success against a channel that had never been contacted.
 */
export const ChannelConfigCreateSchema = z.object({
	property_id: uuid,
	/** Display name, e.g. "Booking.com". */
	ota_name: z.string().min(1).max(100),
	/** The channel's own code, e.g. "BOOKING_COM". Used by every push handler. */
	ota_code: z.string().min(2).max(50),
	api_endpoint: z.string().max(500).optional(),
	/** Write-only. Never returned by any read route. */
	api_key: z.string().max(500).optional(),
	/** Write-only. Also the HMAC secret inbound deliveries are verified against. */
	api_secret: z.string().max(500).optional(),
	hotel_id: z.string().max(100).optional(),
	channel_manager: z.string().max(100).optional(),
	transport: ChannelTransportKindEnum.optional(),
	is_active: z.boolean().optional(),
	sync_enabled: z.boolean().optional(),
});
export type ChannelConfigCreate = z.infer<typeof ChannelConfigCreateSchema>;

/**
 * Change an existing configuration.
 *
 * Every field optional, and `property_id` / `ota_code` are deliberately absent:
 * re-pointing a configuration at a different property or channel code would
 * silently re-parent its mappings and its sync history. That is a new
 * configuration, not an edit.
 */
export const ChannelConfigUpdateSchema = ChannelConfigCreateSchema.omit({
	property_id: true,
	ota_code: true,
}).partial();
export type ChannelConfigUpdate = z.infer<typeof ChannelConfigUpdateSchema>;

/**
 * Map one of the property's entities to the code the channel knows it by.
 *
 * `entity_type` is a closed set because the availability push joins on
 * `entity_type = 'room_type'` — a typo here is a mapping that exists and is
 * never read, which is indistinguishable from no mapping at the point the push
 * refuses.
 */
export const ChannelMappingEntityTypeEnum = z.enum([
	"room_type",
	"rate_plan",
	"property",
]);

export const ChannelMappingCreateSchema = z.object({
	property_id: uuid,
	/** Must match an `ota_configurations.ota_code` on this property. */
	channel_code: z.string().min(2).max(50),
	channel_name: z.string().min(1).max(100),
	entity_type: ChannelMappingEntityTypeEnum,
	/** The Tartware id being mapped — a room type id for `room_type`. */
	entity_id: uuid,
	/** The channel's identifier for it. */
	external_id: z.string().min(1).max(100),
	external_code: z.string().max(100).optional(),
	is_active: z.boolean().optional(),
});
export type ChannelMappingCreate = z.infer<typeof ChannelMappingCreateSchema>;

/**
 * Map one of the property's rates to a channel rate plan.
 *
 * Separate from `channel_mappings` because the rate push reads it with a join
 * to `rates` for the base rate and currency, and carries its own markup and
 * markdown. `ota_configuration_id` rather than a channel code: a rate plan
 * belongs to one connection, and the push resolves it by that id.
 */
export const OtaRatePlanCreateSchema = z.object({
	property_id: uuid,
	ota_configuration_id: uuid,
	/** The Tartware rate this maps. */
	rate_id: uuid,
	/** The channel's rate plan identifier. */
	ota_rate_plan_id: z.string().min(1).max(100),
	ota_rate_plan_name: z.string().max(200).optional(),
	markup_percentage: z.coerce.number().optional(),
	markdown_percentage: z.coerce.number().optional(),
	is_active: z.boolean().optional(),
});
export type OtaRatePlanCreate = z.infer<typeof OtaRatePlanCreateSchema>;
