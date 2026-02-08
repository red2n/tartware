-- =====================================================
-- Table: charge_codes
-- Category: Reference Data
-- Purpose: Standard PMS charge codes with department
--          categorization following USALI guidelines
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
COMMENT ON COLUMN charge_codes.code IS 'Unique charge code identifier (e.g. ROOM, MINIBAR, SPA)';
COMMENT ON COLUMN charge_codes.department_code IS 'Department short code (ROOMS, FB, SPA, MISC, ADJ, FEES, HSKP)';
COMMENT ON COLUMN charge_codes.revenue_group IS 'Revenue classification (ROOMS, FB, FEES, TAXES, OTHER)';
COMMENT ON COLUMN charge_codes.is_taxable IS 'Whether this charge type is subject to tax';

-- Seed standard charge codes
INSERT INTO charge_codes (code, description, department_code, department_name, revenue_group, is_taxable, display_order)
VALUES
    ('ROOM',         'Room Charge',             'ROOMS', 'Rooms Division',     'ROOMS',  TRUE,  1),
    ('ROOM_TAX',     'Room Tax',                'ROOMS', 'Rooms Division',     'TAXES',  FALSE, 2),
    ('MINIBAR',      'Minibar',                 'FB',    'Food & Beverage',    'FB',     TRUE,  10),
    ('RESTAURANT',   'Restaurant',              'FB',    'Food & Beverage',    'FB',     TRUE,  11),
    ('BAR',          'Bar / Lounge',            'FB',    'Food & Beverage',    'FB',     TRUE,  12),
    ('ROOM_SVC',     'Room Service',            'FB',    'Food & Beverage',    'FB',     TRUE,  13),
    ('BANQUET',      'Banquet / Catering',      'FB',    'Food & Beverage',    'FB',     TRUE,  14),
    ('SPA',          'Spa Services',            'SPA',   'Spa & Wellness',     'OTHER',  TRUE,  20),
    ('GYM',          'Fitness Center',          'SPA',   'Spa & Wellness',     'OTHER',  TRUE,  21),
    ('LAUNDRY',      'Laundry / Dry Cleaning',  'HSKP',  'Housekeeping',      'OTHER',  TRUE,  30),
    ('PARKING',      'Parking',                 'MISC',  'Miscellaneous',      'OTHER',  TRUE,  40),
    ('PHONE',        'Telephone',               'MISC',  'Miscellaneous',      'OTHER',  TRUE,  41),
    ('INTERNET',     'Internet / Wi-Fi',        'MISC',  'Miscellaneous',      'OTHER',  TRUE,  42),
    ('TRANSPORT',    'Transportation',          'MISC',  'Miscellaneous',      'OTHER',  TRUE,  43),
    ('BUSINESS',     'Business Center',         'MISC',  'Miscellaneous',      'OTHER',  TRUE,  44),
    ('GIFT_SHOP',    'Gift Shop',               'MISC',  'Miscellaneous',      'OTHER',  TRUE,  45),
    ('DAMAGE',       'Damage Charge',           'MISC',  'Miscellaneous',      'OTHER',  FALSE, 50),
    ('CANCELLATION', 'Cancellation Fee',        'ADJ',   'Adjustments',        'FEES',   FALSE, 60),
    ('NO_SHOW',      'No-Show Fee',             'ADJ',   'Adjustments',        'FEES',   FALSE, 61),
    ('LATE_CHECKOUT','Late Checkout Fee',        'ADJ',   'Adjustments',        'FEES',   FALSE, 62),
    ('RESORT_FEE',   'Resort Fee',              'FEES',  'Mandatory Fees',     'FEES',   TRUE,  70),
    ('MISC',         'Miscellaneous Charge',    'MISC',  'Miscellaneous',      'OTHER',  TRUE,  99)
ON CONFLICT (code) DO NOTHING;

\echo '✓ charge_codes reference table created and seeded.'
