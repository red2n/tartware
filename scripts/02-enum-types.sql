-- =====================================================
-- 02-enum-types.sql
-- ENUM Type Definitions
-- Industry Standard: Based on Oracle OPERA, Cloudbeds, Protel, RMS Cloud
-- Updated: 2025-10-23 (ENUM coverage aligned to 128 tables across 7 domains)
-- =====================================================

\c tartware

\echo 'Creating ENUM types...'

-- =====================================================
-- MULTI-TENANCY ENUMS
-- =====================================================

-- Tenant Type (Organization Type)
-- Standard: OPERA Cloud supports CHAIN, FRANCHISE, INDEPENDENT
CREATE TYPE tenant_type AS ENUM (
    'INDEPENDENT',          -- Single property owner
    'CHAIN',               -- Hotel chain (e.g., Marriott, Hilton)
    'FRANCHISE',           -- Franchise operator
    'MANAGEMENT_COMPANY'   -- Third-party management
);

-- Tenant Status (Subscription Status)
-- Standard: SaaS subscription lifecycle
CREATE TYPE tenant_status AS ENUM (
    'TRIAL',        -- Free trial period
    'ACTIVE',       -- Active paying customer
    'SUSPENDED',    -- Payment failed or violation
    'INACTIVE',     -- Voluntarily paused
    'CANCELLED'     -- Account closed
);

-- User Role within Tenant (RBAC)
-- Standard: Hierarchical role-based access control
CREATE TYPE tenant_role AS ENUM (
    'OWNER',        -- Full access including billing
    'ADMIN',        -- All operations, no billing
    'MANAGER',      -- Property management
    'STAFF',        -- Daily operations
    'VIEWER'        -- Read-only access
);

-- =====================================================
-- PROPERTY & ROOM ENUMS
-- =====================================================

-- Room Status (Operational Status)
-- Standard: OPERA Cloud room status model
CREATE TYPE room_status AS ENUM (
    'AVAILABLE',        -- Ready for booking
    'OCCUPIED',         -- Guest checked in
    'DIRTY',           -- Needs cleaning
    'CLEAN',           -- Cleaned and ready
    'INSPECTED',       -- Quality checked
    'OUT_OF_ORDER',    -- Maintenance required
    'OUT_OF_SERVICE'   -- Long-term unavailable
);

-- Room Category (Room Type Classification)
-- Standard: Global hotel classification
CREATE TYPE room_category AS ENUM (
    'STANDARD',        -- Standard room
    'DELUXE',         -- Deluxe/superior room
    'SUITE',          -- Suite
    'EXECUTIVE',      -- Executive room
    'PRESIDENTIAL'    -- Presidential suite
);

-- Housekeeping Status
-- Standard: Housekeeping management status
CREATE TYPE housekeeping_status AS ENUM (
    'CLEAN',           -- Room is clean
    'DIRTY',          -- Needs cleaning
    'INSPECTED',      -- QA passed
    'IN_PROGRESS',    -- Currently being cleaned
    'DO_NOT_DISTURB'  -- Guest requested privacy
);

-- Maintenance Status
-- Standard: Maintenance tracking
CREATE TYPE maintenance_status AS ENUM (
    'OPERATIONAL',         -- Working normally
    'NEEDS_REPAIR',       -- Repair needed but usable
    'UNDER_MAINTENANCE',  -- Currently being fixed
    'OUT_OF_ORDER'        -- Not usable
);

-- =====================================================
-- RATE MANAGEMENT ENUMS
-- =====================================================

-- Rate Strategy (Pricing Strategy)
-- Standard: RMS Cloud dynamic pricing strategies
CREATE TYPE rate_strategy AS ENUM (
    'FIXED',        -- Static pricing
    'DYNAMIC',      -- Demand-based pricing
    'SEASONAL',     -- Time-period pricing
    'WEEKEND',      -- Day-of-week pricing
    'LASTMINUTE',   -- Last-minute deals
    'EARLYBIRD'     -- Advance booking discounts
);

-- Rate Status (Rate Plan Status)
-- Standard: Rate lifecycle management
CREATE TYPE rate_status AS ENUM (
    'ACTIVE',       -- Currently available
    'INACTIVE',     -- Temporarily disabled
    'EXPIRED',      -- Past validity period
    'FUTURE'        -- Not yet active
);

-- Season Type (Seasonal Classification)
-- Standard: Revenue management seasons
CREATE TYPE season_type AS ENUM (
    'LOW',          -- Low season
    'SHOULDER',     -- Shoulder season
    'HIGH',         -- High season
    'PEAK',         -- Peak season
    'SPECIAL_EVENT' -- Special events
);

-- =====================================================
-- RESERVATION ENUMS
-- =====================================================

-- Reservation Status (Booking Lifecycle)
-- Standard: OPERA Cloud reservation status workflow
CREATE TYPE reservation_status AS ENUM (
    'PENDING',      -- Initial booking
    'CONFIRMED',    -- Payment received
    'CHECKED_IN',   -- Guest arrived
    'CHECKED_OUT',  -- Guest departed
    'CANCELLED',    -- Booking cancelled
    'NO_SHOW'       -- Guest didn't arrive
);

-- Reservation Source (Distribution Channel)
-- Standard: Channel management sources
CREATE TYPE reservation_source AS ENUM (
    'DIRECT',       -- Direct booking
    'WEBSITE',      -- Hotel website
    'PHONE',        -- Phone reservation
    'WALKIN',       -- Walk-in guest
    'OTA',          -- Online travel agency (Booking.com, Expedia)
    'CORPORATE',    -- Corporate booking
    'GROUP'         -- Group booking
);

-- =====================================================
-- PAYMENT ENUMS
-- =====================================================

-- Payment Method
-- Standard: Global payment methods (Protel PMS supports all)
CREATE TYPE payment_method AS ENUM (
    'CASH',             -- Cash payment
    'CREDIT_CARD',      -- Credit card
    'DEBIT_CARD',       -- Debit card
    'BANK_TRANSFER',    -- Bank transfer (SEPA, ACH)
    'CHECK',            -- Check/cheque
    'DIGITAL_WALLET',   -- PayPal, Apple Pay, Google Pay
    'CRYPTOCURRENCY'    -- Bitcoin, Ethereum
);

-- Payment Status (Transaction Status)
-- Standard: Payment processing lifecycle
CREATE TYPE payment_status AS ENUM (
    'PENDING',              -- Awaiting processing
    'PROCESSING',           -- Being processed
    'COMPLETED',            -- Successfully completed
    'FAILED',              -- Payment failed
    'CANCELLED',           -- Cancelled by user
    'REFUNDED',            -- Full refund
    'PARTIALLY_REFUNDED'   -- Partial refund
);

-- Transaction Type (Payment Operation)
-- Standard: Payment gateway operations
CREATE TYPE transaction_type AS ENUM (
    'CHARGE',           -- Charge customer
    'AUTHORIZATION',    -- Pre-authorization
    'CAPTURE',          -- Capture authorized amount
    'REFUND',           -- Full refund
    'PARTIAL_REFUND',   -- Partial refund
    'VOID'              -- Void transaction
);

-- =====================================================
-- AVAILABILITY ENUMS
-- =====================================================

-- Availability Status (Inventory Status)
-- Standard: Real-time availability tracking
CREATE TYPE availability_status AS ENUM (
    'AVAILABLE',    -- Available for booking
    'BOOKED',       -- Reserved
    'BLOCKED',      -- Manually blocked
    'MAINTENANCE',  -- Under maintenance
    'HOLD'          -- Temporary hold
);

-- =====================================================
-- ANALYTICS ENUMS
-- =====================================================

-- Metric Type (KPI Types)
-- Standard: STR Global and OPERA Analytics KPIs
CREATE TYPE metric_type AS ENUM (
    'OCCUPANCY_RATE',      -- (Occupied / Total) * 100
    'ADR',                 -- Average Daily Rate
    'REVPAR',              -- Revenue Per Available Room
    'TOTAL_REVENUE',       -- Total revenue
    'BOOKING_COUNT',       -- Number of bookings
    'CANCELLATION_RATE',   -- Cancellation percentage
    'LENGTH_OF_STAY',      -- Average stay duration
    'LEAD_TIME'            -- Booking advance time
);

-- Time Granularity (Reporting Periods)
-- Standard: Analytics time dimensions
CREATE TYPE time_granularity AS ENUM (
    'HOURLY',      -- Hour by hour
    'DAILY',       -- Day by day
    'WEEKLY',      -- Week by week
    'MONTHLY',     -- Month by month
    'QUARTERLY',   -- Quarter by quarter
    'YEARLY'       -- Year by year
);

-- Analytics Status (Calculation Status)
-- Standard: Metric calculation lifecycle
CREATE TYPE analytics_status AS ENUM (
    'PENDING',      -- Scheduled for calculation
    'PROCESSING',   -- Currently calculating
    'COMPLETED',    -- Calculation done
    'FAILED',       -- Calculation failed
    'EXPIRED'       -- Data expired
);

-- =====================================================
-- FINANCIAL ENUMS
-- =====================================================

-- Invoice Status (Billing Status)
-- Standard: Invoicing lifecycle
CREATE TYPE invoice_status AS ENUM (
    'DRAFT',            -- Draft invoice
    'SENT',             -- Sent to customer
    'VIEWED',           -- Customer viewed
    'PAID',             -- Fully paid
    'PARTIALLY_PAID',   -- Partial payment
    'OVERDUE',          -- Payment overdue
    'CANCELLED',        -- Invoice cancelled
    'REFUNDED'          -- Invoice refunded
);

-- =====================================================
-- B2B & CORPORATE ENUMS (NEW - Tables 90-93)
-- =====================================================

-- Company Type (Business Partners)
-- Standard: B2B relationship management
CREATE TYPE company_type AS ENUM (
    'CORPORATE',           -- Corporate client
    'TRAVEL_AGENCY',       -- Travel agency/TMC
    'WHOLESALER',          -- Tour operator/wholesaler
    'OTA',                 -- Online travel agency
    'EVENT_PLANNER',       -- Event management company
    'AIRLINE',             -- Airline crew/contracts
    'GOVERNMENT',          -- Government entity
    'EDUCATIONAL',         -- School/university
    'CONSORTIUM',          -- Hotel consortium
    'PARTNER'              -- General business partner
);

-- Credit Status
-- Standard: Credit management for B2B clients
CREATE TYPE credit_status AS ENUM (
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'BLOCKED',
    'UNDER_REVIEW',
    'EXPIRED',
    'REVOKED',
    'CANCELLED'
);

-- Group Booking Type
-- Standard: Group and event classification
CREATE TYPE group_booking_type AS ENUM (
    'CONFERENCE',
    'WEDDING',
    'CORPORATE',
    'TOUR_GROUP',
    'SPORTS_TEAM',
    'REUNION',
    'CONVENTION',
    'GOVERNMENT',
    'AIRLINE_CREW',
    'EDUCATIONAL',
    'OTHER'
);

-- Group Block Status
-- Standard: Group inventory management
CREATE TYPE group_block_status AS ENUM (
    'INQUIRY',
    'TENTATIVE',
    'DEFINITE',
    'CONFIRMED',
    'PARTIAL',
    'CANCELLED',
    'COMPLETED'
);

-- =====================================================
-- AI/ML & REVENUE MANAGEMENT ENUMS (NEW - Tables 94-97)
-- =====================================================

-- ML Model Type
-- Standard: Machine learning model classification
CREATE TYPE ml_model_type AS ENUM (
    'LINEAR_REGRESSION',
    'RANDOM_FOREST',
    'GRADIENT_BOOSTING',
    'NEURAL_NETWORK',
    'LSTM',
    'ENSEMBLE',
    'PROPHET',
    'ARIMA',
    'OTHER'
);

-- Pricing Action
-- Standard: Automated pricing decisions
CREATE TYPE pricing_action AS ENUM (
    'INCREASE',
    'DECREASE',
    'HOLD',
    'MANUAL_OVERRIDE',
    'NONE'
);

-- Scenario Type
-- Standard: What-if analysis scenarios
CREATE TYPE scenario_type AS ENUM (
    'BEST_CASE',
    'WORST_CASE',
    'MOST_LIKELY',
    'CUSTOM'
);

-- =====================================================
-- SUSTAINABILITY & ESG ENUMS (NEW - Table 98)
-- =====================================================

-- Measurement Period
-- Standard: Sustainability reporting periods
CREATE TYPE measurement_period AS ENUM (
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'YEARLY'
);

-- Regulatory Compliance Status
-- Standard: ESG compliance tracking
CREATE TYPE regulatory_compliance_status AS ENUM (
    'COMPLIANT',
    'NON_COMPLIANT',
    'PENDING_REVIEW',
    'NOT_APPLICABLE'
);

-- Certification Status
-- Standard: Green certification lifecycle
CREATE TYPE certification_status AS ENUM (
    'PURSUING',
    'IN_PROGRESS',
    'CERTIFIED',
    'RECERTIFYING',
    'LAPSED',
    'DENIED'
);

-- Certification Type
-- Standard: Types of green certifications
CREATE TYPE certification_type AS ENUM (
    'BUILDING',
    'OPERATIONS',
    'FOOD_SERVICE',
    'MEETINGS',
    'SPA',
    'OVERALL'
);

-- Carbon Offset Program Type
-- Standard: Carbon offset classifications
CREATE TYPE carbon_offset_program_type AS ENUM (
    'REFORESTATION',
    'RENEWABLE_ENERGY',
    'METHANE_CAPTURE',
    'OCEAN_CLEANUP',
    'WILDLIFE_CONSERVATION',
    'COMMUNITY_PROJECT',
    'OTHER'
);

-- Sustainability Initiative Category
-- Standard: ESG initiative classification
CREATE TYPE sustainability_initiative_category AS ENUM (
    'ENERGY',
    'WATER',
    'WASTE',
    'CARBON',
    'BIODIVERSITY',
    'COMMUNITY',
    'PROCUREMENT',
    'TRANSPORTATION',
    'EDUCATION',
    'OTHER'
);

-- Initiative Status
-- Standard: Project lifecycle
CREATE TYPE initiative_status AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'ON_HOLD',
    'CANCELLED'
);

-- =====================================================
-- IOT & SMART ROOMS ENUMS (NEW - Table 99)
-- =====================================================

-- Smart Device Type
-- Standard: IoT device classification
CREATE TYPE smart_device_type AS ENUM (
    'SMART_THERMOSTAT',
    'SMART_LOCK',
    'LIGHTING_CONTROL',
    'CURTAIN_CONTROL',
    'TV',
    'VOICE_ASSISTANT',
    'OCCUPANCY_SENSOR',
    'MOTION_SENSOR',
    'DOOR_SENSOR',
    'WINDOW_SENSOR',
    'SMOKE_DETECTOR',
    'CO_DETECTOR',
    'LEAK_DETECTOR',
    'AIR_QUALITY_MONITOR',
    'SMART_MIRROR',
    'SMART_SHOWER',
    'MINI_BAR_SENSOR',
    'SAFE',
    'ENERGY_MONITOR',
    'HUB',
    'OTHER'
);

-- Device Category
-- Standard: IoT functional grouping
CREATE TYPE device_category AS ENUM (
    'CLIMATE_CONTROL',
    'ACCESS_CONTROL',
    'LIGHTING',
    'ENTERTAINMENT',
    'SECURITY',
    'ENVIRONMENTAL',
    'CONVENIENCE',
    'ENERGY_MANAGEMENT'
);

-- Network Type
-- Standard: IoT connectivity protocols
CREATE TYPE network_type AS ENUM (
    'WIFI',
    'ETHERNET',
    'ZIGBEE',
    'Z_WAVE',
    'BLUETOOTH',
    'THREAD',
    'MATTER',
    'PROPRIETARY'
);

-- Device Status
-- Standard: IoT device operational status
CREATE TYPE device_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'MAINTENANCE',
    'OFFLINE',
    'ERROR',
    'DECOMMISSIONED'
);

-- Operational Status
-- Standard: Device health status
CREATE TYPE operational_status AS ENUM (
    'NORMAL',
    'WARNING',
    'ERROR',
    'CRITICAL'
);

-- Energy Efficiency Rating
-- Standard: Asset efficiency classification
CREATE TYPE efficiency_rating AS ENUM (
    'EXCELLENT',
    'GOOD',
    'AVERAGE',
    'POOR',
    'VERY_POOR'
);

-- HVAC Mode
-- Standard: Climate control modes
CREATE TYPE hvac_mode AS ENUM (
    'COOL',
    'HEAT',
    'AUTO',
    'ECO',
    'OFF'
);

-- Device Event Type
-- Standard: IoT event classification
CREATE TYPE device_event_type AS ENUM (
    'STATE_CHANGE',
    'ACTIVATION',
    'DEACTIVATION',
    'ERROR',
    'WARNING',
    'MAINTENANCE',
    'UPDATE',
    'CONNECTION',
    'DISCONNECTION',
    'ALERT',
    'GUEST_INTERACTION',
    'AUTOMATION_TRIGGERED'
);

-- Event Trigger
-- Standard: Event origin classification
CREATE TYPE event_trigger AS ENUM (
    'GUEST',
    'STAFF',
    'AUTOMATION',
    'SCHEDULE',
    'SENSOR',
    'SYSTEM',
    'API',
    'VOICE_COMMAND'
);

-- Event Severity
-- Standard: Alert severity levels
CREATE TYPE event_severity AS ENUM (
    'INFO',
    'WARNING',
    'ERROR',
    'CRITICAL'
);

-- =====================================================
-- ASSET MANAGEMENT ENUMS (NEW - Table 101)
-- =====================================================

-- Asset Type
-- Standard: Physical asset classification
CREATE TYPE asset_type AS ENUM (
    'FURNITURE',
    'APPLIANCE',
    'HVAC_EQUIPMENT',
    'ELECTRONICS',
    'KITCHEN_EQUIPMENT',
    'LAUNDRY_EQUIPMENT',
    'FITNESS_EQUIPMENT',
    'POOL_EQUIPMENT',
    'VEHICLE',
    'IT_EQUIPMENT',
    'LIGHTING_FIXTURE',
    'PLUMBING_FIXTURE',
    'ARTWORK',
    'OTHER'
);

-- Asset Category
-- Standard: Asset location/purpose grouping
CREATE TYPE asset_category AS ENUM (
    'GUEST_ROOM',
    'PUBLIC_AREA',
    'BACK_OF_HOUSE',
    'FACILITY',
    'GROUNDS',
    'VEHICLE_FLEET'
);

-- Location Type
-- Standard: Asset location classification
CREATE TYPE location_type AS ENUM (
    'ROOM',
    'PUBLIC_SPACE',
    'STORAGE',
    'MAINTENANCE_AREA',
    'KITCHEN',
    'LAUNDRY',
    'POOL',
    'GYM',
    'PARKING',
    'OFFICE',
    'OTHER'
);

-- Asset Condition
-- Standard: Physical condition assessment
CREATE TYPE asset_condition AS ENUM (
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR',
    'BROKEN',
    'DECOMMISSIONED'
);

-- Depreciation Method
-- Standard: Accounting depreciation methods
CREATE TYPE depreciation_method AS ENUM (
    'STRAIGHT_LINE',
    'DECLINING_BALANCE',
    'SUM_OF_YEARS_DIGITS',
    'NONE'
);

-- Maintenance Schedule
-- Standard: Maintenance frequency
CREATE TYPE maintenance_schedule AS ENUM (
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'SEMI_ANNUAL',
    'ANNUAL',
    'AS_NEEDED'
);

-- Criticality Level
-- Standard: Asset criticality assessment
CREATE TYPE criticality_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- Asset Status
-- Standard: Asset lifecycle status
CREATE TYPE asset_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'IN_MAINTENANCE',
    'OUT_OF_SERVICE',
    'DISPOSED',
    'LOST',
    'STOLEN'
);

-- Disposal Method
-- Standard: Asset disposal tracking
CREATE TYPE disposal_method AS ENUM (
    'SOLD',
    'DONATED',
    'RECYCLED',
    'TRASHED',
    'RETURNED_TO_VENDOR'
);

-- Predictive Alert Type
-- Standard: Maintenance alert classification
CREATE TYPE predictive_alert_type AS ENUM (
    'PREDICTIVE_FAILURE',
    'PERFORMANCE_DEGRADATION',
    'ANOMALY_DETECTED',
    'MAINTENANCE_DUE',
    'WARRANTY_EXPIRING',
    'CERTIFICATION_EXPIRING',
    'END_OF_LIFE',
    'EXCESSIVE_USAGE'
);

-- Alert Severity
-- Standard: Alert priority levels
CREATE TYPE alert_severity AS ENUM (
    'INFO',
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- Impact Level
-- Standard: Business impact assessment
CREATE TYPE impact_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- Action Urgency
-- Standard: Response time requirements
CREATE TYPE action_urgency AS ENUM (
    'IMMEDIATE',
    'WITHIN_24_HOURS',
    'WITHIN_WEEK',
    'WITHIN_MONTH',
    'MONITOR'
);

-- Alert Status
-- Standard: Alert lifecycle
CREATE TYPE alert_status AS ENUM (
    'ACTIVE',
    'ACKNOWLEDGED',
    'SCHEDULED',
    'IN_PROGRESS',
    'RESOLVED',
    'FALSE_POSITIVE',
    'DISMISSED'
);

-- Maintenance Type
-- Standard: Maintenance classification
CREATE TYPE maintenance_type AS ENUM (
    'PREVENTIVE',
    'CORRECTIVE',
    'PREDICTIVE',
    'EMERGENCY',
    'ROUTINE_INSPECTION',
    'CALIBRATION',
    'UPGRADE',
    'REPLACEMENT'
);

-- Service Provider Type
-- Standard: Maintenance provider classification
CREATE TYPE service_provider_type AS ENUM (
    'INTERNAL_STAFF',
    'EXTERNAL_VENDOR',
    'MANUFACTURER',
    'WARRANTY_SERVICE'
);

-- Prediction Accuracy
-- Standard: ML prediction validation
CREATE TYPE prediction_accuracy AS ENUM (
    'ACCURATE',
    'EARLY',
    'LATE',
    'FALSE_POSITIVE'
);

\echo 'ENUM types created successfully!'
\echo 'Total ENUM types: 20 (original) + 41 (new) = 61 types'
\echo 'Coverage: 128 tables across 7 business domains'
