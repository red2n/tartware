-- =====================================================
-- Migration: Add rate_type and priority columns to rates table
-- Date: 2026-01-29
-- Description: Extends rates table with rate classification and priority
--              for rate resolution algorithm
-- =====================================================

\c tartware

\echo 'Adding rate_type enum and priority column to rates table...'

-- Create rate_type enum if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rate_type') THEN
        CREATE TYPE rate_type AS ENUM (
            'RACK',           -- Default/published rate (highest price, lowest priority)
            'BAR',            -- Best Available Rate
            'COMP',           -- Complimentary (free)
            'HOUSE',          -- House use (internal)
            'CORPORATE',      -- Corporate negotiated rate
            'GOVERNMENT',     -- Government rate
            'TRAVEL_AGENT',   -- Travel agent commission rate
            'PROMO',          -- Promotional rate
            'COUPON',         -- Coupon/discount code rate
            'EARLYBIRD',      -- Early booking discount
            'LASTMINUTE',     -- Last-minute deal
            'NON_REFUNDABLE', -- Non-refundable discounted rate
            'FLEXIBLE',       -- Flexible cancellation rate
            'LOS',            -- Length of stay rate
            'DERIVED',        -- Derived from parent rate
            'MANUAL_OVERRIDE' -- Manual price override
        );
    END IF;
END
$$;

-- Add rate_type column to rates table
ALTER TABLE public.rates
  ADD COLUMN IF NOT EXISTS rate_type rate_type NOT NULL DEFAULT 'BAR';

-- Add priority column for rate resolution ordering (lower = higher priority)
ALTER TABLE public.rates
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100;

-- Add constraint for priority (0-999 range) - idempotent check
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'rates_priority_check'
          AND conrelid = 'public.rates'::regclass
    ) THEN
        ALTER TABLE public.rates
          ADD CONSTRAINT rates_priority_check CHECK (priority >= 0 AND priority <= 999);
    END IF;
END
$$;

-- Create index for rate resolution queries (priority-based ordering)
CREATE INDEX IF NOT EXISTS idx_rates_priority
  ON public.rates (property_id, room_type_id, status, priority)
  WHERE COALESCE(is_deleted, false) = false AND deleted_at IS NULL;

-- Create index for rate_type filtering
CREATE INDEX IF NOT EXISTS idx_rates_rate_type
  ON public.rates (property_id, rate_type)
  WHERE COALESCE(is_deleted, false) = false AND deleted_at IS NULL;

-- Add comments
COMMENT ON COLUMN public.rates.rate_type IS 'Rate classification: RACK, BAR, COMP, HOUSE, CORPORATE, GOVERNMENT, TRAVEL_AGENT, PROMO, COUPON, EARLYBIRD, LASTMINUTE, NON_REFUNDABLE, FLEXIBLE, LOS, DERIVED, MANUAL_OVERRIDE';
COMMENT ON COLUMN public.rates.priority IS 'Priority for rate resolution (0-999, lower = higher priority). Default priorities: COMP/HOUSE=1-5, CORPORATE/GOVT=10-30, PROMO=40-50, BAR=100, RACK=200';

\echo 'Migration completed: rate_type and priority columns added to rates table'
