-- ============================================================================
-- Migration: add-reservation-reversal-commands
-- Version: 2026-08-28-001
-- Created: 2026-08-28T00:00:00+00:00
-- ============================================================================
--
-- Why: WS-04 adds three lifecycle reversals — undo check-in, undo check-out and
-- reinstate a cancellation. Until now there was no way to undo any of them, and
-- the only recovery from a mis-keyed arrival was direct database work.
--
-- The command catalogue lives in scripts/tables/01-core/10_command_center.sql
-- and is only applied on a fresh database, so an existing install needs the
-- three rows added here. The registry insert is corrective on conflict, exactly
-- like the catalogue's own, so re-running is safe.
--
-- `reason_codes` is seeded separately by scripts/data/defaults/seed-default-data.mjs.
-- A reversal cannot be performed without a code, so an install that skips that
-- seed will have the commands registered and every reversal refused — which is
-- the correct failure, not a silent one.
-- ============================================================================

BEGIN;

-- `reason_codes.reason_category` is a closed enumeration and had no value for
-- undoing a lifecycle event. CANCELLATION is about cancelling, not un-cancelling,
-- and OTHER would defeat the category check the reversal commands perform — so
-- the enumeration gains the kind it was missing.
ALTER TABLE reason_codes DROP CONSTRAINT IF EXISTS reason_codes_reason_category_check;
ALTER TABLE reason_codes ADD CONSTRAINT reason_codes_reason_category_check CHECK (
    reason_category IN (
        'ROOM_MOVE', 'RATE_OVERRIDE', 'DEPOSIT_OVERRIDE', 'CANCELLATION',
        'COMP', 'REFUND', 'WALK', 'OVERBOOKING', 'EARLY_DEPARTURE',
        'LATE_CHECKOUT', 'MAINTENANCE', 'COMPLAINT', 'WRITE_OFF',
        'REVERSAL',
        'OTHER'
    )
);

INSERT INTO command_templates (
    command_name, description, default_target_service, required_modules, metadata
)
VALUES
    ('reservation.reverse_check_in',
     'Undo a check-in and void what it posted',
     'reservations-command-service', ARRAY['core'], jsonb_build_object('seeded', true)),
    ('reservation.reverse_check_out',
     'Undo a check-out and reopen the folio',
     'reservations-command-service', ARRAY['core'], jsonb_build_object('seeded', true)),
    ('reservation.reinstate',
     'Reinstate a cancelled reservation',
     'reservations-command-service', ARRAY['core'], jsonb_build_object('seeded', true))
ON CONFLICT (command_name) DO UPDATE SET
    description = EXCLUDED.description,
    default_target_service = EXCLUDED.default_target_service,
    required_modules = EXCLUDED.required_modules;

-- Routes, matching how the catalogue derives them from the template.
INSERT INTO command_routes (command_name, environment, tenant_id, service_id, topic, metadata)
SELECT
    ct.command_name,
    'development',
    NULL,
    ct.default_target_service,
    ct.default_topic,
    jsonb_build_object('seeded', true)
FROM command_templates ct
WHERE ct.command_name IN (
        'reservation.reverse_check_in',
        'reservation.reverse_check_out',
        'reservation.reinstate'
      )
  AND NOT EXISTS (
        SELECT 1 FROM command_routes cr
        WHERE cr.command_name = ct.command_name
          AND cr.environment = 'development'
          AND cr.tenant_id IS NULL
      );

-- Ship disabled, like every other command in the catalogue. A reversal voids
-- money, so it is the last thing that should arrive switched on by default.
INSERT INTO command_features (command_name, environment, tenant_id, status, metadata)
SELECT
    ct.command_name,
    'development',
    NULL,
    'disabled',
    jsonb_build_object('seeded', true, 'requires_activation', true)
FROM command_templates ct
WHERE ct.command_name IN (
        'reservation.reverse_check_in',
        'reservation.reverse_check_out',
        'reservation.reinstate'
      )
  AND NOT EXISTS (
        SELECT 1 FROM command_features cf
        WHERE cf.command_name = ct.command_name
          AND cf.environment = 'development'
          AND cf.tenant_id IS NULL
      );

COMMIT;
