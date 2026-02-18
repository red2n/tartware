/**
 * DEV DOC
 * Module: shared/enums.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

/**
 * Zod ENUM definitions for Tartware PMS
 * Synchronized with PostgreSQL ENUMs in scripts/02-enum-types.sql
 *
 * ⚠️ CRITICAL: Any change to database ENUMs must be reflected here
 * See: docs/ZOD_SCHEMA_IMPLEMENTATION_PLAN.md#d-schema-synchronization-protocol
 *
 * Total ENUMs: 70 types
 * Last synced: 2025-11-03
 */

import { z } from "zod";

// =====================================================
// MULTI-TENANCY ENUMS
// =====================================================

/**
 * Tenant Type - Organization classification
 * @database tenant_type
 */
export const TenantTypeEnum = z.enum([
	"INDEPENDENT",
	"CHAIN",
	"FRANCHISE",
	"MANAGEMENT_COMPANY",
]);
export type TenantType = z.infer<typeof TenantTypeEnum>;

/**
 * Tenant Status - Subscription lifecycle
 * @database tenant_status
 */
export const TenantStatusEnum = z.enum([
	"TRIAL",
	"ACTIVE",
	"SUSPENDED",
	"INACTIVE",
	"CANCELLED",
]);
export type TenantStatus = z.infer<typeof TenantStatusEnum>;

/**
 * Tenant Role - Role-based access control
 * @database tenant_role
 */
export const TenantRoleEnum = z.enum([
	"OWNER",
	"ADMIN",
	"MANAGER",
	"STAFF",
	"VIEWER",
]);
export type TenantRole = z.infer<typeof TenantRoleEnum>;

// =====================================================
// PLATFORM ADMIN ENUMS
// =====================================================

/**
 * System Administrator Roles - Platform-wide RBAC
 * @database system_admin_role
 */
export const SystemAdminRoleEnum = z.enum([
	"SYSTEM_ADMIN",
	"SYSTEM_OPERATOR",
	"SYSTEM_AUDITOR",
	"SYSTEM_SUPPORT",
]);
export type SystemAdminRole = z.infer<typeof SystemAdminRoleEnum>;

/**
 * Outbox Status - Delivery lifecycle
 * @database outbox_status
 */
export const OutboxStatusEnum = z.enum([
	"PENDING",
	"IN_PROGRESS",
	"DELIVERED",
	"FAILED",
	"DLQ",
]);
export type OutboxStatus = z.infer<typeof OutboxStatusEnum>;

/**
 * Command Route Status - Routing policy lifecycle
 * @database command_route_status
 */
export const CommandRouteStatusEnum = z.enum(["active", "disabled"]);
export type CommandRouteStatus = z.infer<typeof CommandRouteStatusEnum>;

/**
 * Command Feature Status - Feature flags for commands
 * @database command_feature_status
 */
export const CommandFeatureStatusEnum = z.enum([
	"enabled",
	"disabled",
	"observation",
]);
export type CommandFeatureStatus = z.infer<typeof CommandFeatureStatusEnum>;

/**
 * Command Dispatch Status - Tracking ingress lifecycle
 * @database command_dispatch_status
 */
export const CommandDispatchStatusEnum = z.enum([
	"ACCEPTED",
	"PUBLISHED",
	"FAILED",
	"DLQ",
]);
export type CommandDispatchStatus = z.infer<typeof CommandDispatchStatusEnum>;

/**
 * Reservation Command Lifecycle State
 * @database reservation_command_lifecycle_state
 */
export const ReservationCommandLifecycleStateEnum = z.enum([
	"RECEIVED",
	"PERSISTED",
	"IN_PROGRESS",
	"PUBLISHED",
	"CONSUMED",
	"APPLIED",
	"FAILED",
	"DLQ",
]);
export type ReservationCommandLifecycleState = z.infer<
	typeof ReservationCommandLifecycleStateEnum
>;

// =====================================================
// PROPERTY & ROOM ENUMS
// =====================================================

/**
 * Room Status - Operational status
 * @database room_status
 */
export const RoomStatusEnum = z.enum([
	"AVAILABLE",
	"OCCUPIED",
	"DIRTY",
	"CLEAN",
	"INSPECTED",
	"OUT_OF_ORDER",
	"OUT_OF_SERVICE",
]);
export type RoomStatus = z.infer<typeof RoomStatusEnum>;

/**
 * Room Category - Room type classification
 * @database room_category
 */
export const RoomCategoryEnum = z.enum([
	"STANDARD",
	"DELUXE",
	"SUITE",
	"EXECUTIVE",
	"PRESIDENTIAL",
]);
export type RoomCategory = z.infer<typeof RoomCategoryEnum>;

/**
 * Housekeeping Status
 * @database housekeeping_status
 */
export const HousekeepingStatusEnum = z.enum([
	"CLEAN",
	"DIRTY",
	"INSPECTED",
	"IN_PROGRESS",
	"DO_NOT_DISTURB",
]);
export type HousekeepingStatus = z.infer<typeof HousekeepingStatusEnum>;

/**
 * Maintenance Status
 * @database maintenance_status
 */
export const MaintenanceStatusEnum = z.enum([
	"OPERATIONAL",
	"NEEDS_REPAIR",
	"UNDER_MAINTENANCE",
	"OUT_OF_ORDER",
]);
export type MaintenanceStatus = z.infer<typeof MaintenanceStatusEnum>;

// =====================================================
// RATE MANAGEMENT ENUMS
// =====================================================

/**
 * Rate Type - Rate classification for pricing priority
 * @database rate_type
 */
export const RateTypeEnum = z.enum([
	"RACK", // Default/published rate (highest price, lowest priority)
	"BAR", // Best Available Rate
	"COMP", // Complimentary (free)
	"HOUSE", // House use (internal)
	"CORPORATE", // Corporate negotiated rate
	"GOVERNMENT", // Government rate
	"TRAVEL_AGENT", // Travel agent commission rate
	"PROMO", // Promotional rate
	"COUPON", // Coupon/discount code rate
	"EARLYBIRD", // Early booking discount
	"LASTMINUTE", // Last-minute deal
	"NON_REFUNDABLE", // Non-refundable discounted rate
	"FLEXIBLE", // Flexible cancellation rate
	"LOS", // Length of stay rate
	"DERIVED", // Derived from parent rate
	"MANUAL_OVERRIDE", // Manual price override
]);
export type RateType = z.infer<typeof RateTypeEnum>;

/**
 * Rate Strategy - Pricing strategy
 * @database rate_strategy
 */
export const RateStrategyEnum = z.enum([
	"FIXED",
	"DYNAMIC",
	"SEASONAL",
	"WEEKEND",
	"LASTMINUTE",
	"EARLYBIRD",
]);
export type RateStrategy = z.infer<typeof RateStrategyEnum>;

/**
 * Rate Status - Rate plan lifecycle
 * @database rate_status
 */
export const RateStatusEnum = z.enum([
	"ACTIVE",
	"INACTIVE",
	"EXPIRED",
	"FUTURE",
]);
export type RateStatus = z.infer<typeof RateStatusEnum>;

/**
 * Season Type - Seasonal classification
 * @database season_type
 */
export const SeasonTypeEnum = z.enum([
	"LOW",
	"SHOULDER",
	"HIGH",
	"PEAK",
	"SPECIAL_EVENT",
]);
export type SeasonType = z.infer<typeof SeasonTypeEnum>;

// =====================================================
// RESERVATION ENUMS
// =====================================================

/**
 * Reservation Status - Booking lifecycle
 * @database reservation_status
 */
export const ReservationStatusEnum = z.enum([
	"INQUIRY",
	"QUOTED",
	"PENDING",
	"CONFIRMED",
	"WAITLISTED",
	"CHECKED_IN",
	"CHECKED_OUT",
	"CANCELLED",
	"NO_SHOW",
	"EXPIRED",
]);
export type ReservationStatus = z.infer<typeof ReservationStatusEnum>;

/**
 * Reservation Source - Distribution channel
 * @database reservation_source
 */
export const ReservationSourceEnum = z.enum([
	"DIRECT",
	"WEBSITE",
	"PHONE",
	"WALKIN",
	"OTA",
	"CORPORATE",
	"GROUP",
]);
export type ReservationSource = z.infer<typeof ReservationSourceEnum>;

/**
 * Reservation Type - Booking category classification
 * @database reservation_type
 */
export const ReservationTypeEnum = z.enum([
	"TRANSIENT",
	"CORPORATE",
	"GROUP",
	"WHOLESALE",
	"PACKAGE",
	"COMPLIMENTARY",
	"HOUSE_USE",
	"DAY_USE",
	"WAITLIST",
]);
export type ReservationType = z.infer<typeof ReservationTypeEnum>;

// =====================================================
// PAYMENT ENUMS
// =====================================================

/**
 * Payment Method
 * @database payment_method
 */
export const PaymentMethodEnum = z.enum([
	"CASH",
	"CREDIT_CARD",
	"DEBIT_CARD",
	"BANK_TRANSFER",
	"CHECK",
	"DIGITAL_WALLET",
	"CRYPTOCURRENCY",
]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

/**
 * Payment Status - Transaction lifecycle
 * @database payment_status
 */
export const PaymentStatusEnum = z.enum([
	"PENDING",
	"AUTHORIZED",
	"PROCESSING",
	"COMPLETED",
	"FAILED",
	"CANCELLED",
	"REFUNDED",
	"PARTIALLY_REFUNDED",
]);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

/**
 * Transaction Type
 * @database transaction_type
 */
export const TransactionTypeEnum = z.enum([
	"CHARGE",
	"AUTHORIZATION",
	"CAPTURE",
	"REFUND",
	"PARTIAL_REFUND",
	"VOID",
]);
export type TransactionType = z.infer<typeof TransactionTypeEnum>;

// =====================================================
// SETTINGS ENUMS
// =====================================================

/**
 * Settings Scope Level - Determines where a setting is applied
 * @database settings_scope
 */
export const SettingsScopeEnum = z.enum([
	"GLOBAL",
	"TENANT",
	"TENANT_TEMPLATE",
	"PROPERTY",
	"UNIT",
	"USER",
]);
export type SettingsScope = z.infer<typeof SettingsScopeEnum>;

/**
 * Settings Data Type - Underlying value type for a setting
 * @database settings_data_type
 */
export const SettingsDataTypeEnum = z.enum([
	"STRING",
	"TEXT",
	"INTEGER",
	"DECIMAL",
	"BOOLEAN",
	"JSON",
	"DATE",
	"TIME",
	"DATETIME",
	"ENUM",
	"MULTI_ENUM",
	"PERCENTAGE",
	"CURRENCY",
	"DURATION",
]);
export type SettingsDataType = z.infer<typeof SettingsDataTypeEnum>;

/**
 * Settings Control Type - UI control used to edit a setting
 * @database settings_control_type
 */
export const SettingsControlTypeEnum = z.enum([
	"TOGGLE",
	"TEXT_INPUT",
	"TEXT_AREA",
	"NUMBER_INPUT",
	"SELECT",
	"MULTI_SELECT",
	"RADIO_GROUP",
	"SLIDER",
	"DATE_PICKER",
	"TIME_PICKER",
	"DATETIME_PICKER",
	"JSON_EDITOR",
	"TAGS",
	"FILE_UPLOAD",
]);
export type SettingsControlType = z.infer<typeof SettingsControlTypeEnum>;

/**
 * Settings Sensitivity - Data classification for a setting
 * @database settings_sensitivity
 */
export const SettingsSensitivityEnum = z.enum([
	"PUBLIC",
	"INTERNAL",
	"SENSITIVE",
	"CONFIDENTIAL",
]);
export type SettingsSensitivity = z.infer<typeof SettingsSensitivityEnum>;

// =====================================================
// AVAILABILITY ENUMS
// =====================================================

/**
 * Availability Status - Inventory status
 * @database availability_status
 */
export const AvailabilityStatusEnum = z.enum([
	"AVAILABLE",
	"BOOKED",
	"BLOCKED",
	"MAINTENANCE",
	"HOLD",
]);
export type AvailabilityStatus = z.infer<typeof AvailabilityStatusEnum>;

// =====================================================
// ANALYTICS ENUMS
// =====================================================

/**
 * Metric Type - KPI classification
 * @database metric_type
 */
export const MetricTypeEnum = z.enum([
	"OCCUPANCY_RATE",
	"ADR",
	"REVPAR",
	"TOTAL_REVENUE",
	"BOOKING_COUNT",
	"CANCELLATION_RATE",
	"LENGTH_OF_STAY",
	"LEAD_TIME",
]);
export type MetricType = z.infer<typeof MetricTypeEnum>;

/**
 * Time Granularity - Reporting periods
 * @database time_granularity
 */
export const TimeGranularityEnum = z.enum([
	"HOURLY",
	"DAILY",
	"WEEKLY",
	"MONTHLY",
	"QUARTERLY",
	"YEARLY",
]);
export type TimeGranularity = z.infer<typeof TimeGranularityEnum>;

/**
 * Analytics Status - Calculation status
 * @database analytics_status
 */
export const AnalyticsStatusEnum = z.enum([
	"PENDING",
	"PROCESSING",
	"COMPLETED",
	"FAILED",
	"EXPIRED",
]);
export type AnalyticsStatus = z.infer<typeof AnalyticsStatusEnum>;

// =====================================================
// FINANCIAL ENUMS
// =====================================================

/**
 * Invoice Status - Billing lifecycle
 * @database invoice_status
 */
export const InvoiceStatusEnum = z.enum([
	"DRAFT",
	"SENT",
	"VIEWED",
	"PAID",
	"PARTIALLY_PAID",
	"OVERDUE",
	"CANCELLED",
	"REFUNDED",
	"FINALIZED",
]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum>;

// =====================================================
// B2B & CORPORATE ENUMS
// =====================================================

/**
 * Company Type - Business partner classification
 * @database company_type
 */
export const CompanyTypeEnum = z.enum([
	"CORPORATE",
	"TRAVEL_AGENCY",
	"WHOLESALER",
	"OTA",
	"EVENT_PLANNER",
	"AIRLINE",
	"GOVERNMENT",
	"EDUCATIONAL",
	"CONSORTIUM",
	"PARTNER",
]);
export type CompanyType = z.infer<typeof CompanyTypeEnum>;

/**
 * Credit Status - Credit management
 * @database credit_status
 */
export const CreditStatusEnum = z.enum([
	"PENDING",
	"ACTIVE",
	"SUSPENDED",
	"BLOCKED",
	"UNDER_REVIEW",
	"EXPIRED",
	"REVOKED",
	"CANCELLED",
]);
export type CreditStatus = z.infer<typeof CreditStatusEnum>;

/**
 * Group Booking Type
 * @database group_booking_type
 */
export const GroupBookingTypeEnum = z.enum([
	"CONFERENCE",
	"WEDDING",
	"CORPORATE",
	"TOUR_GROUP",
	"SPORTS_TEAM",
	"REUNION",
	"CONVENTION",
	"GOVERNMENT",
	"AIRLINE_CREW",
	"EDUCATIONAL",
	"OTHER",
]);
export type GroupBookingType = z.infer<typeof GroupBookingTypeEnum>;

/**
 * Group Block Status - Group inventory management
 * @database group_block_status
 */
export const GroupBlockStatusEnum = z.enum([
	"INQUIRY",
	"TENTATIVE",
	"DEFINITE",
	"CONFIRMED",
	"PARTIAL",
	"CANCELLED",
	"COMPLETED",
]);
export type GroupBlockStatus = z.infer<typeof GroupBlockStatusEnum>;

// =====================================================
// AI/ML & REVENUE MANAGEMENT ENUMS
// =====================================================

/**
 * ML Model Type
 * @database ml_model_type
 */
export const MLModelTypeEnum = z.enum([
	"LINEAR_REGRESSION",
	"RANDOM_FOREST",
	"GRADIENT_BOOSTING",
	"NEURAL_NETWORK",
	"LSTM",
	"ENSEMBLE",
	"PROPHET",
	"ARIMA",
	"OTHER",
]);
export type MLModelType = z.infer<typeof MLModelTypeEnum>;

/**
 * Pricing Action - Automated pricing decisions
 * @database pricing_action
 */
export const PricingActionEnum = z.enum([
	"INCREASE",
	"DECREASE",
	"HOLD",
	"MANUAL_OVERRIDE",
	"NONE",
]);
export type PricingAction = z.infer<typeof PricingActionEnum>;

/**
 * Scenario Type - What-if analysis
 * @database scenario_type
 */
export const ScenarioTypeEnum = z.enum([
	"BEST_CASE",
	"WORST_CASE",
	"MOST_LIKELY",
	"CUSTOM",
]);
export type ScenarioType = z.infer<typeof ScenarioTypeEnum>;

// =====================================================
// SUSTAINABILITY & ESG ENUMS
// =====================================================

/**
 * Measurement Period
 * @database measurement_period
 */
export const MeasurementPeriodEnum = z.enum([
	"DAILY",
	"WEEKLY",
	"MONTHLY",
	"QUARTERLY",
	"YEARLY",
]);
export type MeasurementPeriod = z.infer<typeof MeasurementPeriodEnum>;

/**
 * Regulatory Compliance Status
 * @database regulatory_compliance_status
 */
export const RegulatoryComplianceStatusEnum = z.enum([
	"COMPLIANT",
	"NON_COMPLIANT",
	"PENDING_REVIEW",
	"NOT_APPLICABLE",
]);
export type RegulatoryComplianceStatus = z.infer<
	typeof RegulatoryComplianceStatusEnum
>;

/**
 * Certification Status
 * @database certification_status
 */
export const CertificationStatusEnum = z.enum([
	"PURSUING",
	"IN_PROGRESS",
	"CERTIFIED",
	"RECERTIFYING",
	"LAPSED",
	"DENIED",
]);
export type CertificationStatus = z.infer<typeof CertificationStatusEnum>;

/**
 * Certification Type
 * @database certification_type
 */
export const CertificationTypeEnum = z.enum([
	"BUILDING",
	"OPERATIONS",
	"FOOD_SERVICE",
	"MEETINGS",
	"SPA",
	"OVERALL",
]);
export type CertificationType = z.infer<typeof CertificationTypeEnum>;

/**
 * Carbon Offset Program Type
 * @database carbon_offset_program_type
 */
export const CarbonOffsetProgramTypeEnum = z.enum([
	"REFORESTATION",
	"RENEWABLE_ENERGY",
	"METHANE_CAPTURE",
	"OCEAN_CLEANUP",
	"WILDLIFE_CONSERVATION",
	"COMMUNITY_PROJECT",
	"OTHER",
]);
export type CarbonOffsetProgramType = z.infer<
	typeof CarbonOffsetProgramTypeEnum
>;

/**
 * Sustainability Initiative Category
 * @database sustainability_initiative_category
 */
export const SustainabilityInitiativeCategoryEnum = z.enum([
	"ENERGY",
	"WATER",
	"WASTE",
	"CARBON",
	"BIODIVERSITY",
	"COMMUNITY",
	"PROCUREMENT",
	"TRANSPORTATION",
	"EDUCATION",
	"OTHER",
]);
export type SustainabilityInitiativeCategory = z.infer<
	typeof SustainabilityInitiativeCategoryEnum
>;

/**
 * Initiative Status
 * @database initiative_status
 */
export const InitiativeStatusEnum = z.enum([
	"PLANNED",
	"IN_PROGRESS",
	"COMPLETED",
	"ON_HOLD",
	"CANCELLED",
]);
export type InitiativeStatus = z.infer<typeof InitiativeStatusEnum>;

// =====================================================
// IOT & SMART ROOMS ENUMS
// =====================================================

/**
 * Smart Device Type
 * @database smart_device_type
 */
export const SmartDeviceTypeEnum = z.enum([
	"SMART_THERMOSTAT",
	"SMART_LOCK",
	"LIGHTING_CONTROL",
	"CURTAIN_CONTROL",
	"TV",
	"VOICE_ASSISTANT",
	"OCCUPANCY_SENSOR",
	"MOTION_SENSOR",
	"DOOR_SENSOR",
	"WINDOW_SENSOR",
	"SMOKE_DETECTOR",
	"CO_DETECTOR",
	"LEAK_DETECTOR",
	"AIR_QUALITY_MONITOR",
	"SMART_MIRROR",
	"SMART_SHOWER",
	"MINI_BAR_SENSOR",
	"SAFE",
	"ENERGY_MONITOR",
	"HUB",
	"OTHER",
]);
export type SmartDeviceType = z.infer<typeof SmartDeviceTypeEnum>;

/**
 * Device Category
 * @database device_category
 */
export const DeviceCategoryEnum = z.enum([
	"CLIMATE_CONTROL",
	"ACCESS_CONTROL",
	"LIGHTING",
	"ENTERTAINMENT",
	"SECURITY",
	"ENVIRONMENTAL",
	"CONVENIENCE",
	"ENERGY_MANAGEMENT",
]);
export type DeviceCategory = z.infer<typeof DeviceCategoryEnum>;

/**
 * Network Type - IoT connectivity
 * @database network_type
 */
export const NetworkTypeEnum = z.enum([
	"WIFI",
	"ETHERNET",
	"ZIGBEE",
	"Z_WAVE",
	"BLUETOOTH",
	"THREAD",
	"MATTER",
	"PROPRIETARY",
]);
export type NetworkType = z.infer<typeof NetworkTypeEnum>;

/**
 * Device Status
 * @database device_status
 */
export const DeviceStatusEnum = z.enum([
	"ACTIVE",
	"INACTIVE",
	"MAINTENANCE",
	"OFFLINE",
	"ERROR",
	"DECOMMISSIONED",
]);
export type DeviceStatus = z.infer<typeof DeviceStatusEnum>;

/**
 * Operational Status - Device health
 * @database operational_status
 */
export const OperationalStatusEnum = z.enum([
	"NORMAL",
	"WARNING",
	"ERROR",
	"CRITICAL",
]);
export type OperationalStatus = z.infer<typeof OperationalStatusEnum>;

/**
 * Energy Efficiency Rating
 * @database efficiency_rating
 */
export const EfficiencyRatingEnum = z.enum([
	"EXCELLENT",
	"GOOD",
	"AVERAGE",
	"POOR",
	"VERY_POOR",
]);
export type EfficiencyRating = z.infer<typeof EfficiencyRatingEnum>;

/**
 * HVAC Mode
 * @database hvac_mode
 */
export const HVACModeEnum = z.enum(["COOL", "HEAT", "AUTO", "ECO", "OFF"]);
export type HVACMode = z.infer<typeof HVACModeEnum>;

/**
 * Device Event Type
 * @database device_event_type
 */
export const DeviceEventTypeEnum = z.enum([
	"STATE_CHANGE",
	"ACTIVATION",
	"DEACTIVATION",
	"ERROR",
	"WARNING",
	"MAINTENANCE",
	"UPDATE",
	"CONNECTION",
	"DISCONNECTION",
	"ALERT",
	"GUEST_INTERACTION",
	"AUTOMATION_TRIGGERED",
]);
export type DeviceEventType = z.infer<typeof DeviceEventTypeEnum>;

/**
 * Event Trigger
 * @database event_trigger
 */
export const EventTriggerEnum = z.enum([
	"GUEST",
	"STAFF",
	"AUTOMATION",
	"SCHEDULE",
	"SENSOR",
	"SYSTEM",
	"API",
	"VOICE_COMMAND",
]);
export type EventTrigger = z.infer<typeof EventTriggerEnum>;

/**
 * Event Severity
 * @database event_severity
 */
export const EventSeverityEnum = z.enum([
	"INFO",
	"WARNING",
	"ERROR",
	"CRITICAL",
]);
export type EventSeverity = z.infer<typeof EventSeverityEnum>;

// =====================================================
// ASSET MANAGEMENT ENUMS
// =====================================================

/**
 * Asset Type
 * @database asset_type
 */
export const AssetTypeEnum = z.enum([
	"FURNITURE",
	"APPLIANCE",
	"HVAC_EQUIPMENT",
	"ELECTRONICS",
	"KITCHEN_EQUIPMENT",
	"LAUNDRY_EQUIPMENT",
	"FITNESS_EQUIPMENT",
	"POOL_EQUIPMENT",
	"VEHICLE",
	"IT_EQUIPMENT",
	"LIGHTING_FIXTURE",
	"PLUMBING_FIXTURE",
	"ARTWORK",
	"OTHER",
]);
export type AssetType = z.infer<typeof AssetTypeEnum>;

/**
 * Asset Category
 * @database asset_category
 */
export const AssetCategoryEnum = z.enum([
	"GUEST_ROOM",
	"PUBLIC_AREA",
	"BACK_OF_HOUSE",
	"FACILITY",
	"GROUNDS",
	"VEHICLE_FLEET",
]);
export type AssetCategory = z.infer<typeof AssetCategoryEnum>;

/**
 * Location Type
 * @database location_type
 */
export const LocationTypeEnum = z.enum([
	"ROOM",
	"PUBLIC_SPACE",
	"STORAGE",
	"MAINTENANCE_AREA",
	"KITCHEN",
	"LAUNDRY",
	"POOL",
	"GYM",
	"PARKING",
	"OFFICE",
	"OTHER",
]);
export type LocationType = z.infer<typeof LocationTypeEnum>;

/**
 * Asset Condition
 * @database asset_condition
 */
export const AssetConditionEnum = z.enum([
	"EXCELLENT",
	"GOOD",
	"FAIR",
	"POOR",
	"BROKEN",
	"DECOMMISSIONED",
]);
export type AssetCondition = z.infer<typeof AssetConditionEnum>;

/**
 * Depreciation Method
 * @database depreciation_method
 */
export const DepreciationMethodEnum = z.enum([
	"STRAIGHT_LINE",
	"DECLINING_BALANCE",
	"SUM_OF_YEARS_DIGITS",
	"NONE",
]);
export type DepreciationMethod = z.infer<typeof DepreciationMethodEnum>;

/**
 * Maintenance Schedule
 * @database maintenance_schedule
 */
export const MaintenanceScheduleEnum = z.enum([
	"DAILY",
	"WEEKLY",
	"MONTHLY",
	"QUARTERLY",
	"SEMI_ANNUAL",
	"ANNUAL",
	"AS_NEEDED",
]);
export type MaintenanceSchedule = z.infer<typeof MaintenanceScheduleEnum>;

/**
 * Criticality Level
 * @database criticality_level
 */
export const CriticalityLevelEnum = z.enum([
	"LOW",
	"MEDIUM",
	"HIGH",
	"CRITICAL",
]);
export type CriticalityLevel = z.infer<typeof CriticalityLevelEnum>;

/**
 * Asset Status
 * @database asset_status
 */
export const AssetStatusEnum = z.enum([
	"ACTIVE",
	"INACTIVE",
	"IN_MAINTENANCE",
	"OUT_OF_SERVICE",
	"DISPOSED",
	"LOST",
	"STOLEN",
]);
export type AssetStatus = z.infer<typeof AssetStatusEnum>;

/**
 * Disposal Method
 * @database disposal_method
 */
export const DisposalMethodEnum = z.enum([
	"SOLD",
	"DONATED",
	"RECYCLED",
	"TRASHED",
	"RETURNED_TO_VENDOR",
]);
export type DisposalMethod = z.infer<typeof DisposalMethodEnum>;

/**
 * Predictive Alert Type
 * @database predictive_alert_type
 */
export const PredictiveAlertTypeEnum = z.enum([
	"PREDICTIVE_FAILURE",
	"PERFORMANCE_DEGRADATION",
	"ANOMALY_DETECTED",
	"MAINTENANCE_DUE",
	"WARRANTY_EXPIRING",
	"CERTIFICATION_EXPIRING",
	"END_OF_LIFE",
	"EXCESSIVE_USAGE",
]);
export type PredictiveAlertType = z.infer<typeof PredictiveAlertTypeEnum>;

/**
 * Alert Severity
 * @database alert_severity
 */
export const AlertSeverityEnum = z.enum([
	"INFO",
	"LOW",
	"MEDIUM",
	"HIGH",
	"CRITICAL",
]);
export type AlertSeverity = z.infer<typeof AlertSeverityEnum>;

/**
 * Impact Level
 * @database impact_level
 */
export const ImpactLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type ImpactLevel = z.infer<typeof ImpactLevelEnum>;

/**
 * Action Urgency
 * @database action_urgency
 */
export const ActionUrgencyEnum = z.enum([
	"IMMEDIATE",
	"WITHIN_24_HOURS",
	"WITHIN_WEEK",
	"WITHIN_MONTH",
	"MONITOR",
]);
export type ActionUrgency = z.infer<typeof ActionUrgencyEnum>;

/**
 * Alert Status
 * @database alert_status
 */
export const AlertStatusEnum = z.enum([
	"ACTIVE",
	"ACKNOWLEDGED",
	"SCHEDULED",
	"IN_PROGRESS",
	"RESOLVED",
	"FALSE_POSITIVE",
	"DISMISSED",
]);
export type AlertStatus = z.infer<typeof AlertStatusEnum>;

/**
 * Maintenance Type
 * @database maintenance_type
 */
export const MaintenanceTypeEnum = z.enum([
	"PREVENTIVE",
	"CORRECTIVE",
	"PREDICTIVE",
	"EMERGENCY",
	"ROUTINE_INSPECTION",
	"CALIBRATION",
	"UPGRADE",
	"REPLACEMENT",
]);
export type MaintenanceType = z.infer<typeof MaintenanceTypeEnum>;

/**
 * Service Provider Type
 * @database service_provider_type
 */
export const ServiceProviderTypeEnum = z.enum([
	"INTERNAL_STAFF",
	"EXTERNAL_VENDOR",
	"MANUFACTURER",
	"WARRANTY_SERVICE",
]);
export type ServiceProviderType = z.infer<typeof ServiceProviderTypeEnum>;

/**
 * Prediction Accuracy
 * @database prediction_accuracy
 */
export const PredictionAccuracyEnum = z.enum([
	"ACCURATE",
	"EARLY",
	"LATE",
	"FALSE_POSITIVE",
]);
export type PredictionAccuracy = z.infer<typeof PredictionAccuracyEnum>;

// =====================================================
// ENUM COLLECTIONS FOR VALIDATION
// =====================================================

/**
 * All ENUM schemas exported as a collection
 * Useful for dynamic validation and introspection
 */
export const AllEnums = {
	TenantTypeEnum,
	TenantStatusEnum,
	TenantRoleEnum,
	RoomStatusEnum,
	RoomCategoryEnum,
	HousekeepingStatusEnum,
	MaintenanceStatusEnum,
	RateTypeEnum,
	RateStrategyEnum,
	RateStatusEnum,
	SeasonTypeEnum,
	ReservationStatusEnum,
	ReservationSourceEnum,
	ReservationTypeEnum,
	PaymentMethodEnum,
	PaymentStatusEnum,
	TransactionTypeEnum,
	SettingsScopeEnum,
	SettingsDataTypeEnum,
	SettingsControlTypeEnum,
	SettingsSensitivityEnum,
	AvailabilityStatusEnum,
	MetricTypeEnum,
	TimeGranularityEnum,
	AnalyticsStatusEnum,
	InvoiceStatusEnum,
	CompanyTypeEnum,
	CreditStatusEnum,
	GroupBookingTypeEnum,
	GroupBlockStatusEnum,
	MLModelTypeEnum,
	PricingActionEnum,
	ScenarioTypeEnum,
	MeasurementPeriodEnum,
	RegulatoryComplianceStatusEnum,
	CertificationStatusEnum,
	CertificationTypeEnum,
	CarbonOffsetProgramTypeEnum,
	SustainabilityInitiativeCategoryEnum,
	InitiativeStatusEnum,
	SmartDeviceTypeEnum,
	DeviceCategoryEnum,
	NetworkTypeEnum,
	DeviceStatusEnum,
	OperationalStatusEnum,
	EfficiencyRatingEnum,
	HVACModeEnum,
	DeviceEventTypeEnum,
	EventTriggerEnum,
	EventSeverityEnum,
	AssetTypeEnum,
	AssetCategoryEnum,
	LocationTypeEnum,
	AssetConditionEnum,
	DepreciationMethodEnum,
	MaintenanceScheduleEnum,
	CriticalityLevelEnum,
	AssetStatusEnum,
	DisposalMethodEnum,
	PredictiveAlertTypeEnum,
	AlertSeverityEnum,
	ImpactLevelEnum,
	ActionUrgencyEnum,
	AlertStatusEnum,
	MaintenanceTypeEnum,
	ServiceProviderTypeEnum,
	PredictionAccuracyEnum,
} as const;

/**
 * Total count of defined ENUMs
 */
export const ENUM_COUNT = Object.keys(AllEnums).length;
