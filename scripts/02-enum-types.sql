-- =====================================================
-- 02-enum-types.sql
-- ENUM Type Definitions
-- Industry Standard: Based on Oracle OPERA, Cloudbeds, Protel, RMS Cloud
-- Date: 2025-10-15
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

\echo 'ENUM types created successfully!'
\echo 'Total ENUM types: 20'
