-- =====================================================
-- 107_spa_treatments.sql
-- Spa & Wellness Treatment Catalog
--
-- Purpose: Define spa/wellness treatments, resources, and pricing.
-- Industry Standard: OPERA Spa & Leisure, Cloudbeds Spa add-ons
-- =====================================================

\c tartware

\echo 'Creating spa_treatments table...'

CREATE TABLE IF NOT EXISTS spa_treatments (
    -- Primary Key
    treatment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Treatment Definition
    treatment_code VARCHAR(50) NOT NULL,
    treatment_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('MASSAGE', 'FACIAL', 'BODY', 'WELLNESS', 'SALON', 'AYURVEDA', 'YOGA', 'THERAPY', 'OTHER')),
    description TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
    currency CHAR(3) DEFAULT 'USD',

    -- Resource Requirements
    default_room_id UUID,
    required_resources JSONB DEFAULT '[]'::jsonb, -- e.g. ["THERAPIST_LEVEL_2", "STEAM_ROOM"]
    gender_restriction VARCHAR(10) CHECK (gender_restriction IN ('MALE', 'FEMALE', 'NONE')),
    max_guests INTEGER DEFAULT 1 CHECK (max_guests >= 1),

    -- Scheduling Rules
    padding_before_minutes INTEGER DEFAULT 0,
    padding_after_minutes INTEGER DEFAULT 0,
    available_days VARCHAR(10)[] DEFAULT ARRAY['MON','TUE','WED','THU','FRI','SAT'],
    available_time_windows JSONB, -- [{"start":"09:00","end":"18:00"}]
    lead_time_hours INTEGER DEFAULT 2,
    cancellation_policy VARCHAR(100),

    -- Marketing & Metadata
    spa_menu_category VARCHAR(100),
    highlights TEXT,
    image_url VARCHAR(500),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE,
    end_date DATE,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT uq_spa_treatment_code UNIQUE (tenant_id, property_id, treatment_code),
    CONSTRAINT chk_spa_availability_dates CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

COMMENT ON TABLE spa_treatments IS 'Catalog of spa and wellness treatments offered by the property.';
COMMENT ON COLUMN spa_treatments.category IS 'Treatment category (MASSAGE, FACIAL, WELLNESS, etc.).';
COMMENT ON COLUMN spa_treatments.required_resources IS 'List of required staff skills/equipment.';
COMMENT ON COLUMN spa_treatments.available_time_windows IS 'JSON describing availability windows.';

\echo '✓ Table created: spa_treatments'
