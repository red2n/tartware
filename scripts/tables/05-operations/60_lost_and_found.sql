-- =====================================================
-- Lost and Found Table
-- =====================================================
-- Purpose: Track lost and found items at the property
-- Key Features:
--   - Item registration and description
--   - Guest matching and claims
--   - Storage and disposal tracking
--   - Return process management
-- =====================================================

CREATE TABLE IF NOT EXISTS lost_and_found (
    -- Primary Key
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Item Identification
    item_number VARCHAR(50) UNIQUE,
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT NOT NULL,

    -- Item Classification
    item_category VARCHAR(100) NOT NULL CHECK (item_category IN (
        'electronics', 'jewelry', 'clothing', 'accessories', 'documents',
        'keys', 'bags', 'wallets', 'phones', 'laptops', 'tablets',
        'watches', 'glasses', 'books', 'toys', 'medical', 'other'
    )),
    item_subcategory VARCHAR(100),

    -- Item Details
    brand VARCHAR(100),
    model VARCHAR(100),
    color VARCHAR(50),
    size VARCHAR(50),
    distinguishing_features TEXT,
    serial_number VARCHAR(100),

    -- Value
    estimated_value DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    is_valuable BOOLEAN DEFAULT FALSE,
    is_perishable BOOLEAN DEFAULT FALSE,

    -- Found Information
    found_date DATE NOT NULL,
    found_time TIME,
    found_by UUID,
    found_by_name VARCHAR(200),

    -- Location Details
    found_location VARCHAR(255) NOT NULL,
    room_number VARCHAR(20),
    room_id UUID,
    floor_number INTEGER,
    area_name VARCHAR(100),
    specific_location TEXT,

    -- Guest Information (if known)
    guest_id UUID,
    guest_name VARCHAR(200),
    guest_email VARCHAR(255),
    guest_phone VARCHAR(50),
    reservation_id UUID,
    checkout_date DATE,

    -- Status
    item_status VARCHAR(50) DEFAULT 'registered' CHECK (item_status IN (
        'registered', 'stored', 'claimed', 'returned', 'shipped',
        'donated', 'disposed', 'lost_again', 'pending_claim'
    )),

    -- Storage
    storage_location VARCHAR(255),
    storage_shelf VARCHAR(50),
    storage_bin VARCHAR(50),
    storage_date DATE,
    stored_by UUID,

    -- Security
    requires_secure_storage BOOLEAN DEFAULT FALSE,
    secure_storage_location VARCHAR(255),
    is_locked BOOLEAN DEFAULT FALSE,
    access_log JSONB, -- [{accessed_by, accessed_at, reason}]

    -- Photos & Documentation
    has_photos BOOLEAN DEFAULT FALSE,
    photo_urls TEXT[],
    photo_count INTEGER DEFAULT 0,

    has_documents BOOLEAN DEFAULT FALSE,
    document_urls TEXT[],

    -- Claim Process
    claim_count INTEGER DEFAULT 0,
    claimed BOOLEAN DEFAULT FALSE,
    claimed_by_guest_id UUID,
    claimed_by_name VARCHAR(200),
    claim_date DATE,
    claim_time TIME,

    -- Verification
    verification_questions JSONB, -- [{question, expected_answer}]
    verification_passed BOOLEAN,
    verified_by UUID,
    verification_notes TEXT,

    -- Return Details
    returned BOOLEAN DEFAULT FALSE,
    return_date DATE,
    return_time TIME,
    return_method VARCHAR(50) CHECK (return_method IN ('in_person', 'shipped', 'courier', 'picked_up', 'mailed')),
    returned_to_name VARCHAR(200),
    returned_by UUID,

    -- Shipping
    shipped BOOLEAN DEFAULT FALSE,
    shipping_address TEXT,
    shipping_cost DECIMAL(10,2),
    tracking_number VARCHAR(100),
    shipping_carrier VARCHAR(100),
    shipping_date DATE,
    delivery_confirmed BOOLEAN DEFAULT FALSE,
    delivery_date DATE,

    -- Guest Contact
    guest_notified BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    notification_method VARCHAR(50) CHECK (notification_method IN ('email', 'phone', 'sms', 'mail', 'in_person')),
    notification_count INTEGER DEFAULT 0,
    last_notification_at TIMESTAMP WITH TIME ZONE,

    guest_contacted BOOLEAN DEFAULT FALSE,
    contact_attempts INTEGER DEFAULT 0,
    last_contact_attempt_at TIMESTAMP WITH TIME ZONE,
    guest_response_received BOOLEAN DEFAULT FALSE,
    guest_response TEXT,

    -- Hold Period
    hold_until_date DATE,
    days_in_storage INTEGER,
    disposal_date DATE,
    disposal_method VARCHAR(100) CHECK (disposal_method IN ('donated', 'discarded', 'sold', 'destroyed', 'recycled', 'other')),

    -- Disposal/Donation
    disposed BOOLEAN DEFAULT FALSE,
    disposed_at TIMESTAMP WITH TIME ZONE,
    disposed_by UUID,
    disposal_reason TEXT,
    disposal_notes TEXT,

    donated BOOLEAN DEFAULT FALSE,
    donation_organization VARCHAR(255),
    donation_date DATE,
    donation_receipt_number VARCHAR(100),

    -- Claims Management
    pending_claims JSONB, -- [{claimant_name, contact, claim_date, verification_status}]
    false_claims INTEGER DEFAULT 0,
    multiple_claimants BOOLEAN DEFAULT FALSE,

    -- Financial
    handling_fee DECIMAL(10,2),
    storage_fee DECIMAL(10,2),
    return_fee DECIMAL(10,2),
    fees_collected DECIMAL(10,2),
    fees_waived BOOLEAN DEFAULT FALSE,

    -- Insurance
    insurance_claim_filed BOOLEAN DEFAULT FALSE,
    insurance_claim_number VARCHAR(100),
    insurance_payout DECIMAL(10,2),

    -- Special Handling
    requires_special_handling BOOLEAN DEFAULT FALSE,
    special_handling_instructions TEXT,
    hazardous_material BOOLEAN DEFAULT FALSE,
    fragile BOOLEAN DEFAULT FALSE,

    -- Notes & Comments
    internal_notes TEXT,
    staff_comments TEXT,
    guest_feedback TEXT,

    -- Manager Review
    requires_manager_approval BOOLEAN DEFAULT FALSE,
    manager_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Related Items
    related_items UUID[], -- Link to other items found together
    is_part_of_set BOOLEAN DEFAULT FALSE,
    set_description TEXT,

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Indexes for lost_and_found

-- Composite Indexes for Common Queries

-- Comments
COMMENT ON TABLE lost_and_found IS 'Tracks lost and found items with claim processing and disposal management';
COMMENT ON COLUMN lost_and_found.item_status IS 'Status: registered, stored, claimed, returned, shipped, donated, disposed';
COMMENT ON COLUMN lost_and_found.verification_questions IS 'JSON array of questions to verify legitimate claimant';
COMMENT ON COLUMN lost_and_found.hold_until_date IS 'Date until which item will be held before disposal';
COMMENT ON COLUMN lost_and_found.access_log IS 'JSON array tracking who accessed the item and when';
