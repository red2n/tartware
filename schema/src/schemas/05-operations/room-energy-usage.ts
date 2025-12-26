/**
 * RoomEnergyUsage Schema
 * @table room_energy_usage
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete RoomEnergyUsage schema
 */
export const RoomEnergyUsageSchema = z.object({
	usage_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	room_id: uuid,
	measurement_date: z.coerce.date(),
	measurement_hour: z.number().int().optional(),
	is_occupied: z.boolean().optional(),
	guest_id: uuid.optional(),
	reservation_id: uuid.optional(),
	number_of_guests: z.number().int().optional(),
	total_energy_kwh: money.optional(),
	hvac_energy_kwh: money.optional(),
	lighting_energy_kwh: money.optional(),
	appliances_energy_kwh: money.optional(),
	other_energy_kwh: money.optional(),
	indoor_temperature: money.optional(),
	outdoor_temperature: money.optional(),
	indoor_humidity: money.optional(),
	outdoor_humidity: money.optional(),
	hvac_mode: z.string().optional(),
	target_temperature: money.optional(),
	fan_speed: z.string().optional(),
	hvac_runtime_minutes: z.number().int().optional(),
	lights_on_count: z.number().int().optional(),
	total_lighting_minutes: z.number().int().optional(),
	hot_water_liters: money.optional(),
	cold_water_liters: money.optional(),
	energy_cost: money.optional(),
	water_cost: money.optional(),
	total_cost: money.optional(),
	energy_per_guest: money.optional(),
	cost_per_guest: money.optional(),
	property_average_kwh: money.optional(),
	variance_from_average: money.optional(),
	efficiency_rating: z.string().optional(),
	over_consumption_alert: z.boolean().optional(),
	anomaly_detected: z.boolean().optional(),
	anomaly_type: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
});

export type RoomEnergyUsage = z.infer<typeof RoomEnergyUsageSchema>;

/**
 * Schema for creating a new room energy usage
 */
export const CreateRoomEnergyUsageSchema = RoomEnergyUsageSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateRoomEnergyUsage = z.infer<typeof CreateRoomEnergyUsageSchema>;

/**
 * Schema for updating a room energy usage
 */
export const UpdateRoomEnergyUsageSchema = RoomEnergyUsageSchema.partial();

export type UpdateRoomEnergyUsage = z.infer<typeof UpdateRoomEnergyUsageSchema>;
