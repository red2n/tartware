localhost:9092-- =====================================================
-- High-Priority Gap Fixes Migration
-- Date: 2026-02-08
-- Gaps: Status history trigger, charge codes, tax seed,
--       folio close command, payment void command
-- =====================================================

\c tartware

-- =====================================================
-- 1. Status History Trigger (Gap 4)
-- Auto-writes to reservation_status_history on any
-- status change on the reservations table.
-- =====================================================

CREATE OR REPLACE FUNCTION track_reservation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO reservation_status_history (
      reservation_id, tenant_id,
      previous_status, new_status,
      change_reason, changed_by, changed_at
    ) VALUES (
      NEW.id, NEW.tenant_id,
      OLD.status, NEW.status,
      COALESCE(NEW.cancellation_reason, NULL),
      COALESCE(NEW.updated_by, 'system'),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservation_status_history ON reservations;
CREATE TRIGGER trg_reservation_status_history
  AFTER UPDATE OF status ON reservations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION track_reservation_status_change();

\echo 'Gap 4: Reservation status history trigger created.'

-- =====================================================
-- 2. Charge codes reference data (Gap 6)
-- Standard hotel charge/department codes
-- =====================================================

CREATE TABLE IF NOT EXISTS charge_codes (
  code VARCHAR(50) PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  department_code VARCHAR(20) NOT NULL,
  department_name VARCHAR(100) NOT NULL,
  revenue_group VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE charge_codes IS 'Standard PMS charge codes with department categorization (USALI)';

INSERT INTO charge_codes (code, description, department_code, department_name, revenue_group, is_taxable, display_order)
VALUES
  ('ROOM',       'Room Charge',             'ROOMS', 'Rooms Division',       'ROOMS',    TRUE,  1),
  ('ROOM_TAX',   'Room Tax',                'ROOMS', 'Rooms Division',       'TAXES',    FALSE, 2),
  ('MINIBAR',    'Minibar',                 'FB',    'Food & Beverage',      'FB',       TRUE,  10),
  ('RESTAURANT', 'Restaurant',              'FB',    'Food & Beverage',      'FB',       TRUE,  11),
  ('BAR',        'Bar / Lounge',            'FB',    'Food & Beverage',      'FB',       TRUE,  12),
  ('ROOM_SVC',   'Room Service',            'FB',    'Food & Beverage',      'FB',       TRUE,  13),
  ('BANQUET',    'Banquet / Catering',       'FB',    'Food & Beverage',      'FB',       TRUE,  14),
  ('SPA',        'Spa Services',            'SPA',   'Spa & Wellness',       'OTHER',    TRUE,  20),
  ('GYM',        'Fitness Center',          'SPA',   'Spa & Wellness',       'OTHER',    TRUE,  21),
  ('LAUNDRY',    'Laundry / Dry Cleaning',  'HSKP',  'Housekeeping',        'OTHER',    TRUE,  30),
  ('PARKING',    'Parking',                 'MISC',  'Miscellaneous',        'OTHER',    TRUE,  40),
  ('PHONE',      'Telephone',               'MISC',  'Miscellaneous',        'OTHER',    TRUE,  41),
  ('INTERNET',   'Internet / Wi-Fi',        'MISC',  'Miscellaneous',        'OTHER',    TRUE,  42),
  ('TRANSPORT',  'Transportation',          'MISC',  'Miscellaneous',        'OTHER',    TRUE,  43),
  ('BUSINESS',   'Business Center',         'MISC',  'Miscellaneous',        'OTHER',    TRUE,  44),
  ('GIFT_SHOP',  'Gift Shop',               'MISC',  'Miscellaneous',        'OTHER',    TRUE,  45),
  ('DAMAGE',     'Damage Charge',           'MISC',  'Miscellaneous',        'OTHER',    FALSE, 50),
  ('CANCELLATION','Cancellation Fee',       'ADJ',   'Adjustments',          'FEES',     FALSE, 60),
  ('NO_SHOW',    'No-Show Fee',             'ADJ',   'Adjustments',          'FEES',     FALSE, 61),
  ('LATE_CHECKOUT','Late Checkout Fee',     'ADJ',   'Adjustments',          'FEES',     FALSE, 62),
  ('RESORT_FEE', 'Resort Fee',              'FEES',  'Mandatory Fees',       'FEES',     TRUE,  70),
  ('MISC',       'Miscellaneous Charge',    'MISC',  'Miscellaneous',        'OTHER',    TRUE, 99)
ON CONFLICT (code) DO NOTHING;

\echo 'Gap 6: Charge codes reference table created and seeded.'

-- =====================================================
-- 3. Tax seed data for default property (Gap 7)
-- =====================================================

INSERT INTO tax_configurations (
  tenant_id, property_id, tax_code, tax_name, tax_type,
  country_code, tax_rate, is_percentage, effective_from,
  calculation_method, calculation_base, applies_to, is_active
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'US-OCCUPANCY-DEFAULT',
    'Occupancy Tax',
    'occupancy_tax',
    'US',
    8.875,
    TRUE,
    '2020-01-01',
    'exclusive',
    'room_only',
    ARRAY['rooms'],
    TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'US-SALES-DEFAULT',
    'Sales Tax',
    'sales_tax',
    'US',
    4.5,
    TRUE,
    '2020-01-01',
    'exclusive',
    'subtotal',
    ARRAY['rooms', 'services', 'food_beverage'],
    TRUE
  )
ON CONFLICT (tax_code) DO NOTHING;

\echo 'Gap 7: Tax configurations seeded for default property.'

-- =====================================================
-- 4. Command templates/routes for new commands (Gaps 3, 8)
-- billing.folio.close, billing.payment.void
-- =====================================================

INSERT INTO command_templates (command_name, description, target_service, payload_schema, is_active, created_by)
VALUES
  ('billing.folio.close',   'Close/settle a folio',           'billing-service', '{}', TRUE, '33333333-3333-3333-3333-333333333333'),
  ('billing.payment.void',  'Void an authorized payment',     'billing-service', '{}', TRUE, '33333333-3333-3333-3333-333333333333')
ON CONFLICT (command_name) DO NOTHING;

INSERT INTO command_routes (command_name, target_topic, target_service, is_active, created_by)
VALUES
  ('billing.folio.close',   'command-center-billing-service',  'billing-service', TRUE, '33333333-3333-3333-3333-333333333333'),
  ('billing.payment.void',  'command-center-billing-service',  'billing-service', TRUE, '33333333-3333-3333-3333-333333333333')
ON CONFLICT (command_name) DO NOTHING;

\echo 'Gaps 3, 8: Command templates and routes for folio.close and payment.void.'

\echo 'All high-priority gap migrations complete.'
