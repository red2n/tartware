/**
 * DEV DOC
 * Module: schemas/07-analytics/sustainability-metrics.ts
 * Description: SustainabilityMetrics Schema
 * Table: sustainability_metrics
 * Category: 07-analytics
 * Primary exports: SustainabilityMetricsSchema, CreateSustainabilityMetricsSchema, UpdateSustainabilityMetricsSchema
 * @table sustainability_metrics
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * SustainabilityMetrics Schema
 * @table sustainability_metrics
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete SustainabilityMetrics schema
 */
export const SustainabilityMetricsSchema = z.object({
	metric_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid,
	measurement_period: z.string(),
	period_start_date: z.coerce.date(),
	period_end_date: z.coerce.date(),
	total_energy_kwh: money.optional(),
	electricity_kwh: money.optional(),
	natural_gas_kwh: money.optional(),
	renewable_energy_kwh: money.optional(),
	renewable_energy_percentage: money.optional(),
	energy_per_occupied_room: money.optional(),
	energy_per_guest: money.optional(),
	energy_cost: money.optional(),
	total_water_liters: money.optional(),
	hot_water_liters: money.optional(),
	cold_water_liters: money.optional(),
	recycled_water_liters: money.optional(),
	water_per_occupied_room: money.optional(),
	water_per_guest: money.optional(),
	water_cost: money.optional(),
	total_waste_kg: money.optional(),
	recycled_waste_kg: money.optional(),
	composted_waste_kg: money.optional(),
	landfill_waste_kg: money.optional(),
	hazardous_waste_kg: money.optional(),
	waste_diversion_rate: money.optional(),
	waste_per_occupied_room: money.optional(),
	waste_per_guest: money.optional(),
	food_waste_kg: money.optional(),
	food_donated_kg: money.optional(),
	food_composted_kg: money.optional(),
	total_carbon_emissions_kg: money.optional(),
	scope_1_emissions_kg: money.optional(),
	scope_2_emissions_kg: money.optional(),
	scope_3_emissions_kg: money.optional(),
	carbon_offset_kg: money.optional(),
	net_carbon_emissions_kg: money.optional(),
	carbon_per_occupied_room: money.optional(),
	carbon_per_guest: money.optional(),
	linen_reuse_program_participation_rate: money.optional(),
	towel_reuse_program_participation_rate: money.optional(),
	paperless_checkin_rate: money.optional(),
	digital_key_usage_rate: money.optional(),
	locally_sourced_food_percentage: money.optional(),
	organic_food_percentage: money.optional(),
	sustainable_seafood_percentage: money.optional(),
	fair_trade_products_percentage: money.optional(),
	eco_friendly_cleaning_products_percentage: money.optional(),
	biodegradable_amenities_percentage: money.optional(),
	led_lighting_percentage: money.optional(),
	low_flow_fixtures_percentage: money.optional(),
	smart_thermostat_coverage_percentage: money.optional(),
	motion_sensor_coverage_percentage: money.optional(),
	electric_vehicle_charging_sessions: z.number().int().optional(),
	bike_rental_count: z.number().int().optional(),
	public_transport_vouchers_issued: z.number().int().optional(),
	shuttle_trips: z.number().int().optional(),
	shuttle_occupancy_rate: money.optional(),
	sustainability_program_participation_rate: money.optional(),
	eco_conscious_room_requests: z.number().int().optional(),
	carbon_offset_donations_received: money.optional(),
	total_occupied_rooms: z.number().int(),
	total_guests: z.number().int(),
	occupancy_percentage: money.optional(),
	energy_cost_savings: money.optional(),
	water_cost_savings: money.optional(),
	waste_management_cost_savings: money.optional(),
	total_sustainability_cost_savings: money.optional(),
	energy_reduction_target_percentage: money.optional(),
	water_reduction_target_percentage: money.optional(),
	waste_diversion_target_percentage: money.optional(),
	carbon_neutral_target_date: z.coerce.date().optional(),
	regulatory_compliance_status: z.string().optional(),
	achievements: z.array(z.string()).optional(),
	challenges: z.array(z.string()).optional(),
	action_items: z.array(z.string()).optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type SustainabilityMetrics = z.infer<typeof SustainabilityMetricsSchema>;

/**
 * Schema for creating a new sustainability metrics
 */
export const CreateSustainabilityMetricsSchema =
	SustainabilityMetricsSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateSustainabilityMetrics = z.infer<
	typeof CreateSustainabilityMetricsSchema
>;

/**
 * Schema for updating a sustainability metrics
 */
export const UpdateSustainabilityMetricsSchema =
	SustainabilityMetricsSchema.partial();

export type UpdateSustainabilityMetrics = z.infer<
	typeof UpdateSustainabilityMetricsSchema
>;
