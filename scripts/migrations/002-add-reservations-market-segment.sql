-- ============================================================================
-- Migration: add-reservations-market-segment
-- Version: 002
-- Created: 2026-08-09T00:00:00+00:00
-- ============================================================================
--
-- Why: market segment is a standard PMS/USALI reservation attribute — it is how
-- room nights and revenue are attributed to Corporate / Leisure / Group / OTA
-- for segment performance reporting. The segment-performance report already
-- selected reservations.market_segment, but no such column has ever existed, so
-- the report failed with 42703 on every call.
--
-- market_segments is already a first-class lookup (surrogate PK segment_id,
-- unique on tenant/property/segment_code). This adds the missing FK from the
-- reservation to that lookup, following the same shape as the existing
-- room_type_id / rate_id references on this table.
--
-- Nullable by design: segment is not known for every booking (walk-ins, legacy
-- rows), and the report attributes those to UNCLASSIFIED rather than guessing.
-- Additive and backward-compatible — no back-fill, because assigning a segment
-- to historical reservations would be fabricating business data.

BEGIN;

ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS market_segment_id UUID;

COMMENT ON COLUMN reservations.market_segment_id IS
    'Reference to market_segments.segment_id (USALI segment attribution; NULL = unclassified)';

-- RESTRICT matches fk_reservations_room_type_id / fk_reservations_rate_id:
-- a segment with reservations attributed to it must not be deleted, or the
-- historical revenue attribution silently changes.
ALTER TABLE reservations
    DROP CONSTRAINT IF EXISTS fk_reservations_market_segment_id;

ALTER TABLE reservations
    ADD CONSTRAINT fk_reservations_market_segment_id
    FOREIGN KEY (market_segment_id)
    REFERENCES market_segments(segment_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
    NOT VALID;

COMMENT ON CONSTRAINT fk_reservations_market_segment_id ON reservations IS
    'Ensures market segment exists if specified. RESTRICT preserves historical revenue attribution.';

-- Partial index: the column is sparse and only ever filtered/grouped on when
-- present, matching the reservations convention for optional FKs.
CREATE INDEX IF NOT EXISTS idx_reservations_market_segment
    ON reservations(market_segment_id)
    WHERE market_segment_id IS NOT NULL;

COMMIT;

-- Validate the FK outside the main transaction: VALIDATE CONSTRAINT takes only
-- a SHARE UPDATE EXCLUSIVE lock, so existing rows are checked without blocking
-- concurrent writes. Safe here because every existing row has a NULL segment.
ALTER TABLE reservations VALIDATE CONSTRAINT fk_reservations_market_segment_id;

-- ROLLBACK SQL:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_reservations_market_segment;
-- ALTER TABLE reservations DROP CONSTRAINT IF EXISTS fk_reservations_market_segment_id;
-- ALTER TABLE reservations DROP COLUMN IF EXISTS market_segment_id;
-- COMMIT;
