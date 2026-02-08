-- =====================================================
-- Tier 1 PMS Industry Standards Migration
-- Date: 2026-02-08
-- Purpose: Add reservation_type, wire cancellation fees,
--          and supporting schema changes
-- =====================================================

\c tartware

-- 1. Add reservation_type enum (PMS industry standard: 9 types)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_type') THEN
        CREATE TYPE reservation_type AS ENUM (
            'TRANSIENT',       -- Individual guest booking (most common)
            'CORPORATE',       -- Company-negotiated rate
            'GROUP',           -- 10+ rooms, common arrival
            'WHOLESALE',       -- Tour operator pre-purchased
            'PACKAGE',         -- Room + services bundled
            'COMPLIMENTARY',   -- Comp stay (no charge)
            'HOUSE_USE',       -- Internal use (staff, maintenance)
            'DAY_USE',         -- Same-day check-in/out
            'WAITLIST'         -- Pending availability
        );
        RAISE NOTICE 'Created reservation_type enum';
    END IF;
END $$;

-- 2. Add reservation_type column to reservations table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reservations' AND column_name = 'reservation_type'
    ) THEN
        ALTER TABLE reservations
            ADD COLUMN reservation_type reservation_type NOT NULL DEFAULT 'TRANSIENT';
        RAISE NOTICE 'Added reservation_type column to reservations';
    END IF;
END $$;

-- 3. Add index on reservation_type for segmentation queries
CREATE INDEX IF NOT EXISTS idx_reservations_type
    ON reservations (tenant_id, property_id, reservation_type)
    WHERE is_deleted = false;

\echo 'Tier 1 PMS standards migration complete'
