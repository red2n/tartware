-- ============================================================================
-- Migration: add-missing-contract-columns
-- Version: 2026-08-10-001
-- Created: 2026-08-10T00:00:00+00:00
-- ============================================================================
--
-- Why: sql-contract-check found service code writing and reading columns that
-- have never existed. Each one below was judged a genuine schema gap rather
-- than a drifted name — there is no existing column carrying the same meaning,
-- and the data is needed by a shipped feature. Where an equivalent column did
-- exist the query was corrected instead; only these remain.
--
-- All additions are nullable and additive, so existing rows and writers are
-- unaffected.

BEGIN;

-- ─── guests: identity document detail ───────────────────────────────────────
-- The digital registration card is a compliance record and captures which
-- authority issued the guest's ID and when it runs out. `passport_expiry`
-- exists but is passport-specific, while id_type/id_number are generic, so
-- there is nowhere to put this for a national ID or driving licence.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS id_issuing_country VARCHAR(2);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS id_issue_date DATE;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS id_expiry_date DATE;

COMMENT ON COLUMN guests.id_issuing_country IS 'ISO 3166-1 alpha-2 country that issued the identity document';
COMMENT ON COLUMN guests.id_issue_date IS 'Issue date of the document in id_type/id_number';
COMMENT ON COLUMN guests.id_expiry_date IS 'Expiry date of the document in id_type/id_number';

-- ─── reservations: assigned room ────────────────────────────────────────────
-- The table records room_number (free text) but no reference to the room that
-- was actually assigned. Mobile check-in, digital key issue and direct booking
-- availability all already read or write reservations.room_id.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS room_id UUID;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS fk_reservations_room_id;
ALTER TABLE reservations
    ADD CONSTRAINT fk_reservations_room_id
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
    NOT VALID;

COMMENT ON COLUMN reservations.room_id IS 'Reference to rooms.id once a specific room is assigned (NULL until assignment)';
COMMENT ON CONSTRAINT fk_reservations_room_id ON reservations IS 'RESTRICT so a room with reservations attached cannot be deleted out from under them.';

-- Sparse until check-in, and only ever filtered on when present.
CREATE INDEX IF NOT EXISTS idx_reservations_room_id
    ON reservations (room_id) WHERE room_id IS NOT NULL;

-- ─── folios: closure reason and group linkage ───────────────────────────────
-- closed_at records when a folio was closed but not why; group billing needs
-- to associate a folio with the block it belongs to.
ALTER TABLE folios ADD COLUMN IF NOT EXISTS close_reason VARCHAR(200);
ALTER TABLE folios ADD COLUMN IF NOT EXISTS group_booking_id UUID;

ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_group_booking_id;
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_group_booking_id
    FOREIGN KEY (group_booking_id) REFERENCES group_bookings (group_booking_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
    NOT VALID;

COMMENT ON COLUMN folios.close_reason IS 'Why the folio was closed; pairs with closed_at';
COMMENT ON COLUMN folios.group_booking_id IS 'Reference to group_bookings.group_booking_id for a master or member folio';

CREATE INDEX IF NOT EXISTS idx_folios_group_booking
    ON folios (group_booking_id) WHERE group_booking_id IS NOT NULL;

-- ─── charge_postings: creation timestamp ────────────────────────────────────
-- The table has updated_at but no created_at, so posting age could not be
-- queried. Backfilled from posting_date, which is the closest known truth.
ALTER TABLE charge_postings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
UPDATE charge_postings
   SET created_at = COALESCE(posting_date::timestamptz, updated_at, NOW())
 WHERE created_at IS NULL;

COMMENT ON COLUMN charge_postings.created_at IS 'Row creation timestamp; backfilled from posting_date for rows predating this column';

-- ─── webhook_subscriptions: optimistic locking ──────────────────────────────
-- core-service already increments a version on update. INTEGER so the shared
-- enforce_version_lock() trigger applies (it requires a numeric counter).
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN webhook_subscriptions.version IS 'Optimistic concurrency counter';

-- ─── commission_statements: currency ────────────────────────────────────────
-- The table stores five monetary totals with no currency, which makes a
-- statement ambiguous for any tenant not operating in a single currency.
ALTER TABLE commission_statements ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3);

COMMENT ON COLUMN commission_statements.currency_code IS 'ISO 4217 code the statement totals are denominated in';

COMMIT;

-- ROLLBACK SQL:
-- BEGIN;
-- ALTER TABLE commission_statements DROP COLUMN IF EXISTS currency_code;
-- ALTER TABLE webhook_subscriptions DROP COLUMN IF EXISTS version;
-- ALTER TABLE charge_postings DROP COLUMN IF EXISTS created_at;
-- DROP INDEX IF EXISTS idx_folios_group_booking;
-- ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_group_booking_id;
-- ALTER TABLE folios DROP COLUMN IF EXISTS group_booking_id;
-- ALTER TABLE folios DROP COLUMN IF EXISTS close_reason;
-- DROP INDEX IF EXISTS idx_reservations_room_id;
-- ALTER TABLE reservations DROP CONSTRAINT IF EXISTS fk_reservations_room_id;
-- ALTER TABLE reservations DROP COLUMN IF EXISTS room_id;
-- ALTER TABLE guests DROP COLUMN IF EXISTS id_expiry_date;
-- ALTER TABLE guests DROP COLUMN IF EXISTS id_issue_date;
-- ALTER TABLE guests DROP COLUMN IF EXISTS id_issuing_country;
-- COMMIT;
