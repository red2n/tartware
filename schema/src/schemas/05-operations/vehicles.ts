/**
 * DEV DOC
 * Module: schemas/05-operations/vehicles.ts
 * Description: Vehicles Schema
 * Table: vehicles
 * Category: 05-operations
 * Primary exports: VehiclesSchema, CreateVehiclesSchema, UpdateVehiclesSchema
 * @table vehicles
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * Vehicles Schema
 * @table vehicles
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete Vehicles schema
 */
export const VehiclesSchema = z.object({
	vehicle_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	vehicle_number: z.string(),
	vehicle_name: z.string().optional(),
	license_plate: z.string(),
	vin: z.string().optional(),
	registration_number: z.string().optional(),
	vehicle_type: z.string(),
	vehicle_category: z.string().optional(),
	passenger_capacity: z.number().int(),
	wheelchair_accessible: z.boolean().optional(),
	wheelchair_capacity: z.number().int().optional(),
	luggage_capacity: z.number().int().optional(),
	cargo_capacity_cubic_meters: money.optional(),
	manufacturer: z.string().optional(),
	model: z.string().optional(),
	model_year: z.number().int().optional(),
	trim_level: z.string().optional(),
	color: z.string().optional(),
	color_code: z.string().optional(),
	fuel_type: z.string().optional(),
	fuel_tank_capacity_liters: money.optional(),
	electric_range_km: z.number().int().optional(),
	battery_capacity_kwh: money.optional(),
	charging_time_minutes: z.number().int().optional(),
	vehicle_status: z.string(),
	operational: z.boolean().optional(),
	out_of_service_reason: z.string().optional(),
	out_of_service_since: z.coerce.date().optional(),
	ownership_type: z.string(),
	owner_name: z.string().optional(),
	lease_start_date: z.coerce.date().optional(),
	lease_end_date: z.coerce.date().optional(),
	lease_monthly_cost: money.optional(),
	insurance_company: z.string().optional(),
	insurance_policy_number: z.string().optional(),
	insurance_expiration_date: z.coerce.date().optional(),
	insurance_coverage_amount: money.optional(),
	insurance_deductible: money.optional(),
	registration_expiration_date: z.coerce.date().optional(),
	inspection_due_date: z.coerce.date().optional(),
	emissions_test_date: z.coerce.date().optional(),
	safety_certification_date: z.coerce.date().optional(),
	odometer_reading_km: z.number().int().optional(),
	last_odometer_update: z.coerce.date().optional(),
	total_km_driven: z.number().int().optional(),
	average_km_per_day: money.optional(),
	last_service_date: z.coerce.date().optional(),
	last_service_km: z.number().int().optional(),
	next_service_due_date: z.coerce.date().optional(),
	next_service_due_km: z.number().int().optional(),
	service_interval_km: z.number().int().optional(),
	service_interval_months: z.number().int().optional(),
	maintenance_notes: z.string().optional(),
	air_conditioning: z.boolean().optional(),
	gps_navigation: z.boolean().optional(),
	wifi_enabled: z.boolean().optional(),
	bluetooth_audio: z.boolean().optional(),
	usb_charging: z.boolean().optional(),
	leather_seats: z.boolean().optional(),
	sunroof: z.boolean().optional(),
	entertainment_system: z.boolean().optional(),
	child_seat_available: z.boolean().optional(),
	pet_friendly: z.boolean().optional(),
	abs_brakes: z.boolean().optional(),
	airbags_count: z.number().int().optional(),
	backup_camera: z.boolean().optional(),
	blind_spot_monitoring: z.boolean().optional(),
	lane_departure_warning: z.boolean().optional(),
	collision_avoidance: z.boolean().optional(),
	emergency_kit: z.boolean().optional(),
	fire_extinguisher: z.boolean().optional(),
	gps_tracker_installed: z.boolean().optional(),
	tracker_serial_number: z.string().optional(),
	telematics_provider: z.string().optional(),
	real_time_tracking: z.boolean().optional(),
	last_gps_location: z.record(z.unknown()).optional(),
	default_driver_id: uuid.optional(),
	current_driver_id: uuid.optional(),
	home_location: z.string().optional(),
	parking_spot: z.string().optional(),
	service_hours_start: z.string().optional(),
	service_hours_end: z.string().optional(),
	available_days: z.string().optional(),
	operates_24_7: z.boolean().optional(),
	base_rate_per_km: money.optional(),
	base_rate_per_hour: money.optional(),
	minimum_charge: money.optional(),
	airport_transfer_flat_rate: money.optional(),
	currency_code: z.string().optional(),
	purchase_price: money.optional(),
	purchase_date: z.coerce.date().optional(),
	current_value: money.optional(),
	depreciation_per_year: money.optional(),
	average_fuel_cost_per_km: money.optional(),
	maintenance_cost_ytd: money.optional(),
	total_operating_cost_ytd: money.optional(),
	accident_history_count: z.number().int().optional(),
	last_accident_date: z.coerce.date().optional(),
	last_accident_description: z.string().optional(),
	safety_inspection_dates: z.array(z.coerce.date()).optional(),
	emissions_test_dates: z.array(z.coerce.date()).optional(),
	mechanical_inspection_dates: z.array(z.coerce.date()).optional(),
	registration_document_url: z.string().optional(),
	insurance_document_url: z.string().optional(),
	inspection_certificate_url: z.string().optional(),
	vehicle_photo_url: z.string().optional(),
	manual_url: z.string().optional(),
	co2_emissions_per_km: money.optional(),
	euro_emissions_standard: z.string().optional(),
	green_vehicle: z.boolean().optional(),
	total_trips_ytd: z.number().int().optional(),
	total_hours_used_ytd: z.number().int().optional(),
	utilization_rate_percent: money.optional(),
	revenue_generated_ytd: money.optional(),
	maintenance_alert: z.boolean().optional(),
	insurance_expiry_alert: z.boolean().optional(),
	registration_expiry_alert: z.boolean().optional(),
	inspection_due_alert: z.boolean().optional(),
	internal_notes: z.string().optional(),
	driver_notes: z.string().optional(),
	guest_facing_description: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type Vehicles = z.infer<typeof VehiclesSchema>;

/**
 * Schema for creating a new vehicles
 */
export const CreateVehiclesSchema = VehiclesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateVehicles = z.infer<typeof CreateVehiclesSchema>;

/**
 * Schema for updating a vehicles
 */
export const UpdateVehiclesSchema = VehiclesSchema.partial();

export type UpdateVehicles = z.infer<typeof UpdateVehiclesSchema>;
