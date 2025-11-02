-- =====================================================
-- 106_minibar_consumption.sql
-- Minibar Consumption Tracking
--
-- Purpose: Track guest consumption of minibar items with automatic folio posting
-- Industry Standard: OPERA (MINIBAR_TRANSACTIONS), Protel (MINIBAR_VERBRAUCH),
--                    RMS (MINIBAR_CHARGES), Infor HMS (MINIBAR_CONSUMPTION)
--
-- Use Cases:
-- - Track what guests consume from minibar
-- - Automatic charge posting to guest folio
-- - Inventory depletion tracking
-- - Reconciliation with housekeeping checks
-- - Dispute resolution and adjustments
--
-- Note: This table tracks WHO consumed WHAT and WHEN
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS minibar_consumption CASCADE;

CREATE TABLE minibar_consumption (
    -- Primary Key
    consumption_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Transaction Context
    consumption_date DATE NOT NULL DEFAULT CURRENT_DATE,
    consumption_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_number VARCHAR(50), -- Unique transaction reference

    -- Guest & Reservation
    reservation_id UUID NOT NULL,
    guest_id UUID,
    room_id UUID NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    folio_id UUID, -- Target folio for charges

    -- Consumed Item
    item_id UUID NOT NULL, -- Reference to minibar_items
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    item_category VARCHAR(50),

    -- Quantity & Units
    quantity_consumed INTEGER NOT NULL DEFAULT 1,
    unit_of_measure VARCHAR(20) DEFAULT 'EACH',

    -- Pricing at Time of Consumption
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_rate DECIMAL(5, 2),
    tax_amount DECIMAL(10, 2),
    service_charge_rate DECIMAL(5, 2),
    service_charge_amount DECIMAL(10, 2),
    total_amount DECIMAL(10, 2) NOT NULL,
    currency_code CHAR(3) DEFAULT 'USD',

    -- Detection Method
    detection_method VARCHAR(50) NOT NULL DEFAULT 'MANUAL'
        CHECK (detection_method IN (
            'MANUAL', -- Housekeeping manual count
            'BARCODE_SCAN', -- Scanned by housekeeper
            'RFID', -- RFID tag detection
            'WEIGHT_SENSOR', -- Smart minibar sensor
            'GUEST_REPORTED', -- Guest self-reported
            'CHECKOUT_INSPECTION' -- Discovered at checkout
        )),

    -- Detection Details
    detected_by UUID, -- Staff member who recorded consumption
    detected_by_name VARCHAR(200),
    detected_by_role VARCHAR(50), -- HOUSEKEEPER, FRONT_DESK, MANAGER
    detection_device VARCHAR(100), -- Scanner, sensor, or manual

    -- Housekeeping Context
    housekeeping_date DATE,
    service_type VARCHAR(50), -- DAILY_SERVICE, TURNDOWN, CHECKOUT, INSPECTION
    hk_report_id UUID, -- Link to housekeeping report if available

    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMP,
    verification_notes TEXT,

    -- Guest Confirmation
    guest_acknowledged BOOLEAN DEFAULT FALSE,
    guest_signature_url VARCHAR(500),
    acknowledged_at TIMESTAMP,

    -- Dispute Handling
    disputed BOOLEAN DEFAULT FALSE,
    dispute_reason TEXT,
    dispute_date TIMESTAMP,
    dispute_resolved BOOLEAN DEFAULT FALSE,
    dispute_resolution TEXT,
    dispute_resolved_date TIMESTAMP,
    dispute_resolved_by UUID,

    -- Adjustment
    adjustment_applied BOOLEAN DEFAULT FALSE,
    adjustment_type VARCHAR(50), -- VOID, PARTIAL_REFUND, FULL_REFUND, PRICE_CHANGE
    adjustment_amount DECIMAL(10, 2),
    adjustment_reason TEXT,
    adjusted_by UUID,
    adjusted_at TIMESTAMP,

    -- Posting Status
    posting_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (posting_status IN (
            'PENDING', 'POSTED', 'FAILED', 'VOIDED', 'ADJUSTED'
        )),
    posted_to_folio BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP,
    folio_transaction_id UUID, -- Link to actual folio transaction

    -- Settlement
    settled BOOLEAN DEFAULT FALSE,
    settled_date TIMESTAMP,
    payment_method VARCHAR(50),

    -- Inventory Impact
    inventory_updated BOOLEAN DEFAULT FALSE,
    inventory_updated_at TIMESTAMP,
    stock_depleted INTEGER, -- Quantity depleted from property stock

    -- Replenishment Tracking
    replenishment_required BOOLEAN DEFAULT TRUE,
    replenished BOOLEAN DEFAULT FALSE,
    replenished_at TIMESTAMP,
    replenished_by UUID,

    -- Alcohol Compliance
    is_alcoholic BOOLEAN DEFAULT FALSE,
    age_verified BOOLEAN DEFAULT FALSE,
    age_verification_method VARCHAR(50), -- ID_CHECK, SYSTEM_FLAG, NONE
    age_verified_by UUID,

    -- Room Change Handling
    original_room_id UUID, -- If guest moved rooms
    consumption_room_match BOOLEAN DEFAULT TRUE, -- Did consumption occur in correct room?

    -- Package/Promotion
    complimentary BOOLEAN DEFAULT FALSE,
    complimentary_reason TEXT,
    package_included BOOLEAN DEFAULT FALSE,
    package_id UUID,
    promotional_discount_percent DECIMAL(5, 2),
    promotional_discount_amount DECIMAL(10, 2),

    -- Revenue Allocation
    revenue_date DATE, -- Accounting revenue date
    revenue_center VARCHAR(50), -- ROOMS, F&B, MINIBAR
    revenue_category VARCHAR(50),
    department_code VARCHAR(50),
    gl_account VARCHAR(50),

    -- Integration
    pos_transaction_id VARCHAR(100), -- POS system reference
    accounting_posted BOOLEAN DEFAULT FALSE,
    accounting_posted_at TIMESTAMP,
    external_system_id VARCHAR(100),

    -- Batch Processing
    batch_id UUID, -- Group multiple consumptions together
    batch_date DATE,
    bulk_posted BOOLEAN DEFAULT FALSE,

    -- Guest Experience
    guest_notes TEXT,
    special_requests TEXT,
    preference_recorded BOOLEAN DEFAULT FALSE, -- Track guest preferences

    -- Quality Control
    item_condition VARCHAR(50), -- NEW, OPENED, DAMAGED, EXPIRED
    item_expiration_date DATE,
    quality_issue BOOLEAN DEFAULT FALSE,
    quality_issue_description TEXT,

    -- Photos/Evidence
    photo_url VARCHAR(500), -- Photo of consumed items
    photo_timestamp TIMESTAMP,

    -- Notes
    internal_notes TEXT,
    housekeeper_notes TEXT,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT minibar_consumption_quantity_check CHECK (quantity_consumed > 0),
    CONSTRAINT minibar_consumption_amount_check CHECK (total_amount >= 0),
    CONSTRAINT minibar_consumption_dispute_check CHECK (
        NOT disputed OR dispute_reason IS NOT NULL
    ),
    CONSTRAINT minibar_consumption_alcohol_check CHECK (
        NOT is_alcoholic OR age_verified = TRUE
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE minibar_consumption IS 'Guest minibar consumption tracking with automatic folio posting';
COMMENT ON COLUMN minibar_consumption.consumption_id IS 'Unique consumption transaction identifier (UUID)';
COMMENT ON COLUMN minibar_consumption.detection_method IS 'How consumption was detected: MANUAL, BARCODE_SCAN, RFID, WEIGHT_SENSOR, etc.';
COMMENT ON COLUMN minibar_consumption.detected_by IS 'Staff member (typically housekeeper) who recorded the consumption';
COMMENT ON COLUMN minibar_consumption.disputed IS 'TRUE if guest disputes the charge';
COMMENT ON COLUMN minibar_consumption.posting_status IS 'Charge posting status: PENDING, POSTED, FAILED, VOIDED, ADJUSTED';
COMMENT ON COLUMN minibar_consumption.folio_transaction_id IS 'Link to the actual folio charge transaction';
COMMENT ON COLUMN minibar_consumption.replenishment_required IS 'TRUE if item needs to be restocked in the minibar';
COMMENT ON COLUMN minibar_consumption.age_verified IS 'TRUE if guest age was verified for alcoholic items';
COMMENT ON COLUMN minibar_consumption.complimentary IS 'TRUE if charge is waived (e.g., VIP amenity)';
COMMENT ON COLUMN minibar_consumption.metadata IS 'Custom fields for property-specific tracking';

\echo 'Minibar consumption table created successfully!'
