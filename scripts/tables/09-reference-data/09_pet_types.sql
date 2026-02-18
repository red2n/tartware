-- =====================================================
-- 09_pet_types.sql
-- Pet Management Reference Data
-- Industry Standard: OPERA Cloud (PET_POLICY),
--                    Mews (PET_CONFIGURATION)
-- Pattern: Configurable pet type catalog with charges
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- PET_TYPES TABLE
-- Defines accepted pet types, size limits, and charges
-- =====================================================

CREATE TABLE IF NOT EXISTS pet_types (
    -- Primary Key
    pet_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),    -- Unique pet type identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                    -- FK tenants.id
    property_id UUID,                                           -- FK properties.id (NULL = tenant-wide default)

    -- Pet Type
    pet_type_code VARCHAR(50) NOT NULL,                         -- Short code (e.g., 'DOG_SM', 'CAT', 'SERVICE')
    pet_type_name VARCHAR(100) NOT NULL,                        -- Display name (e.g., 'Small Dog')
    species VARCHAR(50) NOT NULL CHECK (
        species IN (
            'DOG', 'CAT', 'BIRD', 'FISH', 'REPTILE',
            'RABBIT', 'HAMSTER', 'SERVICE_ANIMAL', 'OTHER'
        )
    ),                                                          -- Animal species

    -- Size Restrictions
    size_category VARCHAR(20) CHECK (
        size_category IN ('SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE', 'ANY')
    ),                                                          -- Size classification
    max_weight_kg DECIMAL(5, 1),                                -- Maximum weight in kilograms
    max_weight_lbs DECIMAL(5, 1),                               -- Maximum weight in pounds

    -- Charges
    daily_fee DECIMAL(10, 2) DEFAULT 0,                        -- Daily pet fee
    one_time_cleaning_fee DECIMAL(10, 2) DEFAULT 0,            -- One-time cleaning surcharge
    refundable_deposit DECIMAL(10, 2) DEFAULT 0,               -- Refundable pet deposit
    currency_code CHAR(3) DEFAULT 'USD',                       -- Currency
    charge_code VARCHAR(50),                                   -- FK charge_codes.code for folio posting

    -- Policy
    is_allowed BOOLEAN DEFAULT TRUE,                           -- Whether this pet type is accepted
    max_per_room INTEGER DEFAULT 1,                            -- Maximum pets of this type per room
    requires_documentation BOOLEAN DEFAULT FALSE,              -- Vaccination records, etc.
    requires_crate BOOLEAN DEFAULT FALSE,                      -- Must be crated when unattended
    allowed_in_lobby BOOLEAN DEFAULT FALSE,                    -- Allowed in public areas
    allowed_in_restaurant BOOLEAN DEFAULT FALSE,               -- Allowed in dining areas (e.g. outdoor patio)
    weight_limit_enforced BOOLEAN DEFAULT TRUE,                -- Enforce weight limits
    breed_restrictions TEXT[],                                  -- Restricted breeds (if any)
    vaccination_required BOOLEAN DEFAULT FALSE,                -- Proof of vaccination needed

    -- Service Animals (ADA / accessibility)
    is_service_animal_type BOOLEAN DEFAULT FALSE,              -- Service animal exemption
    fee_waived_for_service BOOLEAN DEFAULT TRUE,               -- No fees for service animals

    -- Amenities
    pet_amenity_kit BOOLEAN DEFAULT FALSE,                     -- Welcome kit (bowl, treats, bed)
    pet_bed_available BOOLEAN DEFAULT FALSE,                   -- Pet bed provided
    pet_sitting_available BOOLEAN DEFAULT FALSE,               -- Pet-sitting service
    dog_walking_available BOOLEAN DEFAULT FALSE,               -- Dog walking service
    nearby_vet_info TEXT,                                       -- Nearest veterinarian info
    pet_relief_area_description TEXT,                           -- Pet relief area location

    -- Status
    is_active BOOLEAN DEFAULT TRUE,                            -- Active/inactive
    display_order INTEGER DEFAULT 0,                           -- Sort order in listings

    -- Notes
    policy_description TEXT,                                    -- Guest-facing pet policy text
    internal_notes TEXT,                                        -- Staff-only notes

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                        -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- Creation timestamp
    updated_at TIMESTAMP,                                      -- Last update timestamp
    created_by UUID,                                           -- Creator identifier
    updated_by UUID,                                           -- Modifier identifier

    -- Constraints
    CONSTRAINT pet_types_code_unique UNIQUE (tenant_id, property_id, pet_type_code),
    CONSTRAINT pet_types_fee_check CHECK (daily_fee >= 0 AND one_time_cleaning_fee >= 0 AND refundable_deposit >= 0)
);

-- =====================================================
-- PET_REGISTRATIONS TABLE
-- Tracks pets associated with reservations
-- =====================================================

CREATE TABLE IF NOT EXISTS pet_registrations (
    -- Primary Key
    registration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique registration identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                     -- FK tenants.id
    property_id UUID NOT NULL,                                   -- FK properties.id

    -- Links
    reservation_id UUID NOT NULL,                                -- FK reservations.id
    guest_id UUID NOT NULL,                                      -- FK guests.id
    pet_type_id UUID NOT NULL,                                   -- FK pet_types.pet_type_id
    room_id UUID,                                                -- FK rooms.id (assigned room)

    -- Pet Details
    pet_name VARCHAR(100) NOT NULL,                              -- Pet's name
    breed VARCHAR(100),                                           -- Breed
    color VARCHAR(50),                                            -- Color/markings
    weight_kg DECIMAL(5, 1),                                     -- Actual weight
    age_years INTEGER,                                            -- Approximate age
    is_service_animal BOOLEAN DEFAULT FALSE,                     -- Service animal flag

    -- Documentation
    vaccination_verified BOOLEAN DEFAULT FALSE,                  -- Vaccination proof on file
    vaccination_expiry DATE,                                      -- Vaccination expiry date
    health_certificate_url VARCHAR(500),                          -- Link to health certificate
    liability_waiver_signed BOOLEAN DEFAULT FALSE,               -- Liability waiver signed
    liability_waiver_date DATE,                                   -- When waiver was signed

    -- Financial
    deposit_collected DECIMAL(10, 2) DEFAULT 0,                  -- Deposit collected
    deposit_refunded DECIMAL(10, 2) DEFAULT 0,                   -- Deposit refunded
    fees_charged DECIMAL(10, 2) DEFAULT 0,                       -- Total fees charged
    damage_charges DECIMAL(10, 2) DEFAULT 0,                     -- Damage charges (if any)
    currency_code CHAR(3) DEFAULT 'USD',                         -- Currency

    -- Check-in/out
    checked_in_at TIMESTAMP,                                     -- When pet arrived
    checked_out_at TIMESTAMP,                                    -- When pet departed

    -- Status
    registration_status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (
        registration_status IN ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED')
    ),                                                            -- Registration lifecycle

    -- Notes
    special_instructions TEXT,                                   -- Feeding instructions, medications, etc.
    incident_notes TEXT,                                          -- Any incidents during stay
    internal_notes TEXT,                                          -- Staff-only notes

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                          -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,     -- Creation timestamp
    updated_at TIMESTAMP,                                        -- Last update timestamp
    created_by UUID,                                             -- Creator identifier
    updated_by UUID,                                             -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                            -- Soft delete flag
    deleted_at TIMESTAMP,                                        -- Deletion timestamp
    deleted_by UUID                                              -- Deleter identifier
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE pet_types IS 'Configurable pet type catalog with species, size limits, charges, and policies per property';
COMMENT ON COLUMN pet_types.pet_type_id IS 'Unique pet type identifier (UUID)';
COMMENT ON COLUMN pet_types.pet_type_code IS 'Short code for the pet type (e.g., DOG_SM, CAT, SERVICE)';
COMMENT ON COLUMN pet_types.species IS 'Animal species: DOG, CAT, BIRD, SERVICE_ANIMAL, etc.';
COMMENT ON COLUMN pet_types.max_weight_kg IS 'Maximum allowed weight in kilograms';
COMMENT ON COLUMN pet_types.daily_fee IS 'Per-night pet fee charged to folio';
COMMENT ON COLUMN pet_types.is_service_animal_type IS 'TRUE for service animal types (ADA exemptions apply)';
COMMENT ON COLUMN pet_types.breed_restrictions IS 'Array of restricted breeds not accepted';
COMMENT ON COLUMN pet_types.charge_code IS 'Charge code used for folio posting';

COMMENT ON TABLE pet_registrations IS 'Tracks individual pets associated with guest reservations including documentation and charges';
COMMENT ON COLUMN pet_registrations.registration_id IS 'Unique pet registration identifier (UUID)';
COMMENT ON COLUMN pet_registrations.pet_name IS 'Name of the pet';
COMMENT ON COLUMN pet_registrations.is_service_animal IS 'TRUE if this specific pet is a registered service animal';
COMMENT ON COLUMN pet_registrations.vaccination_verified IS 'TRUE if vaccination proof has been verified by staff';
COMMENT ON COLUMN pet_registrations.deposit_collected IS 'Refundable deposit amount collected at check-in';
COMMENT ON COLUMN pet_registrations.registration_status IS 'Lifecycle: PENDING, ACTIVE, COMPLETED, CANCELLED';

\echo 'pet_types and pet_registrations tables created successfully!'
