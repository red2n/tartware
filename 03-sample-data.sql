-- =====================================================
-- 03-sample-data.sql
-- Sample Data Generation for Property Management System
-- Generates 500+ entries for each table
-- Date: 2025-10-14
-- =====================================================

-- =====================================================
-- HELPER FUNCTION FOR RANDOM SELECTION
-- =====================================================

CREATE OR REPLACE FUNCTION random_between(low INT, high INT)
RETURNS INT AS $$
BEGIN
   RETURN floor(random() * (high - low + 1) + low);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. TENANTS (500 organizations)
-- =====================================================

INSERT INTO tenants (
    id, name, slug, type, status, email, phone, website,
    address_line1, city, state, postal_code, country,
    tax_id, business_license, registration_number
)
SELECT
    uuid_generate_v4(),
    'Hotel Chain ' || i || ' Inc',
    'hotel-chain-' || i,
    CASE (i % 4)
        WHEN 0 THEN 'INDEPENDENT'::tenant_type
        WHEN 1 THEN 'CHAIN'::tenant_type
        WHEN 2 THEN 'FRANCHISE'::tenant_type
        ELSE 'MANAGEMENT_COMPANY'::tenant_type
    END,
    CASE (i % 5)
        WHEN 0 THEN 'TRIAL'::tenant_status
        WHEN 1 THEN 'ACTIVE'::tenant_status
        WHEN 2 THEN 'ACTIVE'::tenant_status
        WHEN 3 THEN 'ACTIVE'::tenant_status
        ELSE 'SUSPENDED'::tenant_status
    END,
    'contact' || i || '@hotelchain' || i || '.com',
    '+1-555-' || LPAD(i::TEXT, 7, '0'),
    'https://www.hotelchain' || i || '.com',
    i || ' Main Street',
    CASE (i % 10)
        WHEN 0 THEN 'New York'
        WHEN 1 THEN 'Los Angeles'
        WHEN 2 THEN 'Chicago'
        WHEN 3 THEN 'Houston'
        WHEN 4 THEN 'Phoenix'
        WHEN 5 THEN 'Philadelphia'
        WHEN 6 THEN 'San Antonio'
        WHEN 7 THEN 'San Diego'
        WHEN 8 THEN 'Dallas'
        ELSE 'San Jose'
    END,
    CASE (i % 10)
        WHEN 0 THEN 'NY'
        WHEN 1 THEN 'CA'
        WHEN 2 THEN 'IL'
        WHEN 3 THEN 'TX'
        WHEN 4 THEN 'AZ'
        WHEN 5 THEN 'PA'
        WHEN 6 THEN 'TX'
        WHEN 7 THEN 'CA'
        WHEN 8 THEN 'TX'
        ELSE 'CA'
    END,
    LPAD((10000 + i)::TEXT, 5, '0'),
    'US',
    'TAX-' || LPAD(i::TEXT, 9, '0'),
    'BL-' || LPAD(i::TEXT, 8, '0'),
    'REG-' || LPAD(i::TEXT, 10, '0')
FROM generate_series(1, 500) AS i;

-- =====================================================
-- 2. USERS (1000 users)
-- =====================================================

INSERT INTO users (
    id, username, email, password_hash, first_name, last_name,
    phone, title, department, is_active, is_verified, email_verified,
    two_factor_enabled
)
SELECT
    uuid_generate_v4(),
    'user' || i,
    'user' || i || '@example.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMye1L5gNnD3fQxH6Qp.zQh0xmPq4YNqjO6', -- hashed 'password123'
    CASE (i % 20)
        WHEN 0 THEN 'James' WHEN 1 THEN 'Mary' WHEN 2 THEN 'John' WHEN 3 THEN 'Patricia'
        WHEN 4 THEN 'Robert' WHEN 5 THEN 'Jennifer' WHEN 6 THEN 'Michael' WHEN 7 THEN 'Linda'
        WHEN 8 THEN 'William' WHEN 9 THEN 'Barbara' WHEN 10 THEN 'David' WHEN 11 THEN 'Elizabeth'
        WHEN 12 THEN 'Richard' WHEN 13 THEN 'Susan' WHEN 14 THEN 'Joseph' WHEN 15 THEN 'Jessica'
        WHEN 16 THEN 'Thomas' WHEN 17 THEN 'Sarah' WHEN 18 THEN 'Charles' ELSE 'Karen'
    END,
    CASE (i % 20)
        WHEN 0 THEN 'Smith' WHEN 1 THEN 'Johnson' WHEN 2 THEN 'Williams' WHEN 3 THEN 'Brown'
        WHEN 4 THEN 'Jones' WHEN 5 THEN 'Garcia' WHEN 6 THEN 'Miller' WHEN 7 THEN 'Davis'
        WHEN 8 THEN 'Rodriguez' WHEN 9 THEN 'Martinez' WHEN 10 THEN 'Hernandez' WHEN 11 THEN 'Lopez'
        WHEN 12 THEN 'Gonzalez' WHEN 13 THEN 'Wilson' WHEN 14 THEN 'Anderson' WHEN 15 THEN 'Thomas'
        WHEN 16 THEN 'Taylor' WHEN 17 THEN 'Moore' WHEN 18 THEN 'Jackson' ELSE 'Martin'
    END,
    '+1-555-' || LPAD(i::TEXT, 7, '0'),
    CASE (i % 5)
        WHEN 0 THEN 'Front Desk Manager'
        WHEN 1 THEN 'Reservation Agent'
        WHEN 2 THEN 'Housekeeping Supervisor'
        WHEN 3 THEN 'Revenue Manager'
        ELSE 'General Manager'
    END,
    CASE (i % 5)
        WHEN 0 THEN 'Front Office'
        WHEN 1 THEN 'Reservations'
        WHEN 2 THEN 'Housekeeping'
        WHEN 3 THEN 'Revenue Management'
        ELSE 'Administration'
    END,
    (i % 10) != 0,
    (i % 10) != 0,
    (i % 10) != 0,
    (i % 5) = 0
FROM generate_series(1, 1000) AS i;

-- =====================================================
-- 3. USER-TENANT ASSOCIATIONS (2000 associations)
-- =====================================================

INSERT INTO user_tenant_associations (
    id, user_id, tenant_id, role, is_active, is_primary
)
SELECT
    uuid_generate_v4(),
    u.id,
    t.id,
    CASE (random() * 4)::INT
        WHEN 0 THEN 'OWNER'::tenant_role
        WHEN 1 THEN 'ADMIN'::tenant_role
        WHEN 2 THEN 'MANAGER'::tenant_role
        WHEN 3 THEN 'STAFF'::tenant_role
        ELSE 'VIEWER'::tenant_role
    END,
    random() > 0.1,
    random() > 0.7
FROM (SELECT id, ROW_NUMBER() OVER () as rn FROM users LIMIT 1000) u
CROSS JOIN LATERAL (
    SELECT id FROM tenants
    ORDER BY random()
    LIMIT (1 + (random() * 2)::INT)
) t;

-- =====================================================
-- 4. PROPERTIES (1000 properties)
-- =====================================================

INSERT INTO properties (
    id, tenant_id, property_code, property_name, property_type,
    description, email, phone, website,
    address_line1, city, state, postal_code, country,
    total_rooms, total_floors, currency, timezone, is_active
)
SELECT
    uuid_generate_v4(),
    t.id,
    'PROP-' || LPAD(i::TEXT, 6, '0'),
    CASE (i % 10)
        WHEN 0 THEN 'Grand Hotel ' || i
        WHEN 1 THEN 'Luxury Resort ' || i
        WHEN 2 THEN 'Business Inn ' || i
        WHEN 3 THEN 'Ocean View Hotel ' || i
        WHEN 4 THEN 'Mountain Lodge ' || i
        WHEN 5 THEN 'City Center Suites ' || i
        WHEN 6 THEN 'Airport Hotel ' || i
        WHEN 7 THEN 'Boutique Hotel ' || i
        WHEN 8 THEN 'Executive Suites ' || i
        ELSE 'Resort & Spa ' || i
    END,
    CASE (i % 5)
        WHEN 0 THEN 'HOTEL'
        WHEN 1 THEN 'RESORT'
        WHEN 2 THEN 'MOTEL'
        WHEN 3 THEN 'APARTMENT'
        ELSE 'VILLA'
    END,
    'A premium property offering exceptional service and amenities.',
    'info' || i || '@property.com',
    '+1-555-' || LPAD((2000000 + i)::TEXT, 7, '0'),
    'https://www.property' || i || '.com',
    (100 + i) || ' Hotel Boulevard',
    CASE (i % 15)
        WHEN 0 THEN 'New York' WHEN 1 THEN 'Los Angeles' WHEN 2 THEN 'Chicago'
        WHEN 3 THEN 'Houston' WHEN 4 THEN 'Phoenix' WHEN 5 THEN 'Philadelphia'
        WHEN 6 THEN 'San Antonio' WHEN 7 THEN 'San Diego' WHEN 8 THEN 'Dallas'
        WHEN 9 THEN 'San Jose' WHEN 10 THEN 'Austin' WHEN 11 THEN 'Jacksonville'
        WHEN 12 THEN 'Fort Worth' WHEN 13 THEN 'Columbus' ELSE 'Charlotte'
    END,
    CASE (i % 15)
        WHEN 0 THEN 'NY' WHEN 1 THEN 'CA' WHEN 2 THEN 'IL'
        WHEN 3 THEN 'TX' WHEN 4 THEN 'AZ' WHEN 5 THEN 'PA'
        WHEN 6 THEN 'TX' WHEN 7 THEN 'CA' WHEN 8 THEN 'TX'
        WHEN 9 THEN 'CA' WHEN 10 THEN 'TX' WHEN 11 THEN 'FL'
        WHEN 12 THEN 'TX' WHEN 13 THEN 'OH' ELSE 'NC'
    END,
    LPAD((30000 + i)::TEXT, 5, '0'),
    'US',
    50 + (i % 200),
    5 + (i % 15),
    'USD',
    'America/New_York',
    (i % 20) != 0
FROM generate_series(1, 1000) AS i
CROSS JOIN LATERAL (
    SELECT id FROM tenants ORDER BY random() LIMIT 1
) t;

-- =====================================================
-- 5. GUESTS (2000 guests)
-- =====================================================

INSERT INTO guests (
    id, tenant_id, first_name, last_name, email, phone,
    address_line1, city, state, postal_code, country,
    date_of_birth, nationality, id_type, id_number,
    guest_type, vip_status, blacklisted, loyalty_points
)
SELECT
    uuid_generate_v4(),
    t.id,
    CASE (i % 30)
        WHEN 0 THEN 'James' WHEN 1 THEN 'Mary' WHEN 2 THEN 'John' WHEN 3 THEN 'Patricia'
        WHEN 4 THEN 'Robert' WHEN 5 THEN 'Jennifer' WHEN 6 THEN 'Michael' WHEN 7 THEN 'Linda'
        WHEN 8 THEN 'William' WHEN 9 THEN 'Barbara' WHEN 10 THEN 'David' WHEN 11 THEN 'Elizabeth'
        WHEN 12 THEN 'Richard' WHEN 13 THEN 'Susan' WHEN 14 THEN 'Joseph' WHEN 15 THEN 'Jessica'
        WHEN 16 THEN 'Thomas' WHEN 17 THEN 'Sarah' WHEN 18 THEN 'Charles' WHEN 19 THEN 'Karen'
        WHEN 20 THEN 'Christopher' WHEN 21 THEN 'Nancy' WHEN 22 THEN 'Daniel' WHEN 23 THEN 'Lisa'
        WHEN 24 THEN 'Matthew' WHEN 25 THEN 'Betty' WHEN 26 THEN 'Anthony' WHEN 27 THEN 'Margaret'
        WHEN 28 THEN 'Mark' ELSE 'Sandra'
    END,
    CASE (i % 30)
        WHEN 0 THEN 'Smith' WHEN 1 THEN 'Johnson' WHEN 2 THEN 'Williams' WHEN 3 THEN 'Brown'
        WHEN 4 THEN 'Jones' WHEN 5 THEN 'Garcia' WHEN 6 THEN 'Miller' WHEN 7 THEN 'Davis'
        WHEN 8 THEN 'Rodriguez' WHEN 9 THEN 'Martinez' WHEN 10 THEN 'Hernandez' WHEN 11 THEN 'Lopez'
        WHEN 12 THEN 'Gonzalez' WHEN 13 THEN 'Wilson' WHEN 14 THEN 'Anderson' WHEN 15 THEN 'Thomas'
        WHEN 16 THEN 'Taylor' WHEN 17 THEN 'Moore' WHEN 18 THEN 'Jackson' WHEN 19 THEN 'Martin'
        WHEN 20 THEN 'Lee' WHEN 21 THEN 'Perez' WHEN 22 THEN 'Thompson' WHEN 23 THEN 'White'
        WHEN 24 THEN 'Harris' WHEN 25 THEN 'Sanchez' WHEN 26 THEN 'Clark' WHEN 27 THEN 'Ramirez'
        WHEN 28 THEN 'Lewis' ELSE 'Robinson'
    END,
    'guest' || i || '@email.com',
    '+1-555-' || LPAD((3000000 + i)::TEXT, 7, '0'),
    (200 + i) || ' Guest Street',
    CASE (i % 10)
        WHEN 0 THEN 'New York' WHEN 1 THEN 'Los Angeles' WHEN 2 THEN 'Chicago'
        WHEN 3 THEN 'Houston' WHEN 4 THEN 'Phoenix' WHEN 5 THEN 'Philadelphia'
        WHEN 6 THEN 'San Antonio' WHEN 7 THEN 'San Diego' WHEN 8 THEN 'Dallas'
        ELSE 'San Jose'
    END,
    CASE (i % 10)
        WHEN 0 THEN 'NY' WHEN 1 THEN 'CA' WHEN 2 THEN 'IL'
        WHEN 3 THEN 'TX' WHEN 4 THEN 'AZ' WHEN 5 THEN 'PA'
        WHEN 6 THEN 'TX' WHEN 7 THEN 'CA' WHEN 8 THEN 'TX'
        ELSE 'CA'
    END,
    LPAD((40000 + i)::TEXT, 5, '0'),
    'US',
    CURRENT_DATE - INTERVAL '25 years' - (i % 365 || ' days')::INTERVAL - ((i % 40) || ' years')::INTERVAL,
    'USA',
    CASE (i % 3)
        WHEN 0 THEN 'PASSPORT'
        WHEN 1 THEN 'DRIVER_LICENSE'
        ELSE 'NATIONAL_ID'
    END,
    'ID-' || LPAD(i::TEXT, 9, '0'),
    CASE (i % 4)
        WHEN 0 THEN 'INDIVIDUAL'
        WHEN 1 THEN 'CORPORATE'
        WHEN 2 THEN 'GROUP'
        ELSE 'INDIVIDUAL'
    END,
    (i % 10) = 0,
    (i % 100) = 0,
    (i % 10) * 1000 + (i % 100) * 10
FROM generate_series(1, 2000) AS i
CROSS JOIN LATERAL (
    SELECT id FROM tenants ORDER BY random() LIMIT 1
) t;

-- =====================================================
-- 6. ROOM TYPES (2000 room types)
-- =====================================================

INSERT INTO room_types (
    id, tenant_id, property_id, type_code, type_name, description,
    base_occupancy, max_occupancy, max_adults, max_children,
    size_sqm, size_sqft, is_active, display_order
)
SELECT
    uuid_generate_v4(),
    p.tenant_id,
    p.id,
    CASE (i % 10)
        WHEN 0 THEN 'STD'
        WHEN 1 THEN 'DLX'
        WHEN 2 THEN 'STE'
        WHEN 3 THEN 'EXE'
        WHEN 4 THEN 'FAM'
        WHEN 5 THEN 'KNG'
        WHEN 6 THEN 'TWN'
        WHEN 7 THEN 'JNR'
        WHEN 8 THEN 'PRE'
        ELSE 'PEN'
    END || '-' || (i % 5)::TEXT,
    CASE (i % 10)
        WHEN 0 THEN 'Standard Room'
        WHEN 1 THEN 'Deluxe Room'
        WHEN 2 THEN 'Suite'
        WHEN 3 THEN 'Executive Room'
        WHEN 4 THEN 'Family Room'
        WHEN 5 THEN 'King Room'
        WHEN 6 THEN 'Twin Room'
        WHEN 7 THEN 'Junior Suite'
        WHEN 8 THEN 'Presidential Suite'
        ELSE 'Penthouse'
    END,
    'Comfortable and well-appointed room with modern amenities.',
    2 + (i % 3),
    4 + (i % 4),
    2 + (i % 3),
    (i % 4),
    25.0 + (i % 50),
    269.0 + (i % 500),
    (i % 15) != 0,
    (i % 10)
FROM generate_series(1, 2000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id FROM properties ORDER BY random() LIMIT 1
) p;

-- =====================================================
-- 7. ROOMS (5000 rooms)
-- =====================================================

INSERT INTO rooms (
    id, tenant_id, property_id, room_type_id, room_number,
    floor, building, view_type, status, housekeeping_status,
    maintenance_status, is_smoking, is_accessible
)
SELECT
    uuid_generate_v4(),
    rt.tenant_id,
    rt.property_id,
    rt.id,
    LPAD(i::TEXT, 4, '0'),
    1 + ((i - 1) / 20),
    CASE (i % 3)
        WHEN 0 THEN 'Main Building'
        WHEN 1 THEN 'West Wing'
        ELSE 'East Wing'
    END,
    CASE (i % 5)
        WHEN 0 THEN 'City View'
        WHEN 1 THEN 'Ocean View'
        WHEN 2 THEN 'Garden View'
        WHEN 3 THEN 'Mountain View'
        ELSE 'Pool View'
    END,
    CASE (i % 10)
        WHEN 0 THEN 'OCCUPIED'::room_status
        WHEN 1 THEN 'DIRTY'::room_status
        WHEN 2 THEN 'OUT_OF_ORDER'::room_status
        ELSE 'CLEAN'::room_status
    END,
    CASE (i % 5)
        WHEN 0 THEN 'DIRTY'::housekeeping_status
        WHEN 1 THEN 'IN_PROGRESS'::housekeeping_status
        ELSE 'CLEAN'::housekeeping_status
    END,
    CASE (i % 20)
        WHEN 0 THEN 'NEEDS_REPAIR'::maintenance_status
        WHEN 1 THEN 'UNDER_MAINTENANCE'::maintenance_status
        ELSE 'OPERATIONAL'::maintenance_status
    END,
    (i % 20) = 0,
    (i % 10) = 0
FROM generate_series(1, 5000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, property_id
    FROM room_types
    ORDER BY random()
    LIMIT 1
) rt;

-- =====================================================
-- 8. RATES (3000 rate plans)
-- =====================================================

INSERT INTO rates (
    id, tenant_id, property_id, room_type_id, rate_code, rate_name,
    description, rate_strategy, rate_status, season_type,
    base_rate, current_rate, minimum_rate, maximum_rate,
    currency, effective_date, expiry_date,
    minimum_stay, maximum_stay, is_refundable, is_modifiable,
    cancellation_hours, tax_inclusive, service_fee_inclusive,
    priority_order, is_active, created_by
)
SELECT
    uuid_generate_v4(),
    rt.tenant_id,
    rt.property_id,
    rt.id,
    'RATE-' || LPAD(i::TEXT, 6, '0'),
    CASE (i % 6)
        WHEN 0 THEN 'Standard Rate'
        WHEN 1 THEN 'Early Bird Special'
        WHEN 2 THEN 'Last Minute Deal'
        WHEN 3 THEN 'Weekend Package'
        WHEN 4 THEN 'Corporate Rate'
        ELSE 'Seasonal Special'
    END,
    'Competitive pricing with great value.',
    CASE (i % 6)
        WHEN 0 THEN 'FIXED'::rate_strategy
        WHEN 1 THEN 'EARLYBIRD'::rate_strategy
        WHEN 2 THEN 'LASTMINUTE'::rate_strategy
        WHEN 3 THEN 'WEEKEND'::rate_strategy
        WHEN 4 THEN 'DYNAMIC'::rate_strategy
        ELSE 'SEASONAL'::rate_strategy
    END,
    CASE (i % 4)
        WHEN 0 THEN 'ACTIVE'::rate_status
        WHEN 1 THEN 'ACTIVE'::rate_status
        WHEN 2 THEN 'INACTIVE'::rate_status
        ELSE 'ACTIVE'::rate_status
    END,
    CASE (i % 5)
        WHEN 0 THEN 'LOW'::season_type
        WHEN 1 THEN 'SHOULDER'::season_type
        WHEN 2 THEN 'HIGH'::season_type
        WHEN 3 THEN 'PEAK'::season_type
        ELSE 'SPECIAL_EVENT'::season_type
    END,
    100.00 + (i % 400),
    100.00 + (i % 400) + ((i % 50) - 25),
    80.00 + (i % 300),
    150.00 + (i % 500),
    'USD',
    CURRENT_DATE - ((i % 365) || ' days')::INTERVAL,
    CURRENT_DATE + ((365 - (i % 365)) || ' days')::INTERVAL,
    1 + (i % 3),
    7 + (i % 7),
    (i % 5) != 0,
    (i % 3) != 0,
    24 + (i % 48),
    (i % 2) = 0,
    (i % 3) = 0,
    (i % 10),
    (i % 10) != 0,
    'system'
FROM generate_series(1, 3000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, property_id
    FROM room_types
    ORDER BY random()
    LIMIT 1
) rt;

-- =====================================================
-- 9. RESERVATIONS (4000 reservations)
-- =====================================================

INSERT INTO reservations (
    id, tenant_id, confirmation_number, property_id, guest_id,
    guest_first_name, guest_last_name, guest_email, guest_phone,
    check_in_date, check_out_date, nights, room_type_id, room_number,
    adults, children, infants, room_rate, taxes, fees, total_amount,
    currency, status, source, special_requests, booking_date
)
SELECT
    uuid_generate_v4(),
    g.tenant_id,
    'CNF-' || LPAD(i::TEXT, 10, '0'),
    rt.property_id,
    g.id,
    g.first_name,
    g.last_name,
    g.email,
    g.phone,
    CURRENT_DATE - ((365 - (i % 730)) || ' days')::INTERVAL,
    CURRENT_DATE - ((365 - (i % 730) - (2 + (i % 5))) || ' days')::INTERVAL,
    2 + (i % 5),
    rt.id,
    CASE WHEN (i % 3) = 0 THEN LPAD((i % 500)::TEXT, 4, '0') ELSE NULL END,
    1 + (i % 3),
    (i % 3),
    (i % 2),
    150.00 + (i % 300),
    (150.00 + (i % 300)) * 0.12,
    25.00,
    (150.00 + (i % 300)) * (2 + (i % 5)) * 1.12 + 25.00,
    'USD',
    CASE (i % 6)
        WHEN 0 THEN 'PENDING'::reservation_status
        WHEN 1 THEN 'CONFIRMED'::reservation_status
        WHEN 2 THEN 'CHECKED_IN'::reservation_status
        WHEN 3 THEN 'CHECKED_OUT'::reservation_status
        WHEN 4 THEN 'CANCELLED'::reservation_status
        ELSE 'CONFIRMED'::reservation_status
    END,
    CASE (i % 7)
        WHEN 0 THEN 'DIRECT'::reservation_source
        WHEN 1 THEN 'WEBSITE'::reservation_source
        WHEN 2 THEN 'PHONE'::reservation_source
        WHEN 3 THEN 'WALKIN'::reservation_source
        WHEN 4 THEN 'OTA'::reservation_source
        WHEN 5 THEN 'CORPORATE'::reservation_source
        ELSE 'GROUP'::reservation_source
    END,
    CASE WHEN (i % 5) = 0 THEN 'Early check-in requested' ELSE NULL END,
    CURRENT_DATE - ((370 - (i % 730)) || ' days')::INTERVAL
FROM generate_series(1, 4000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, first_name, last_name, email, phone
    FROM guests
    ORDER BY random()
    LIMIT 1
) g
CROSS JOIN LATERAL (
    SELECT id, property_id
    FROM room_types
    WHERE tenant_id = g.tenant_id
    ORDER BY random()
    LIMIT 1
) rt;

-- =====================================================
-- 10. RESERVATION STATUS HISTORY (8000 entries)
-- =====================================================

INSERT INTO reservation_status_history (
    id, tenant_id, reservation_id, old_status, new_status,
    reason, notes, changed_by, changed_at
)
SELECT
    uuid_generate_v4(),
    r.tenant_id,
    r.id,
    CASE (i % 5)
        WHEN 0 THEN 'PENDING'::reservation_status
        WHEN 1 THEN 'CONFIRMED'::reservation_status
        WHEN 2 THEN 'CHECKED_IN'::reservation_status
        WHEN 3 THEN 'CHECKED_OUT'::reservation_status
        ELSE NULL
    END,
    CASE (i % 5)
        WHEN 0 THEN 'CONFIRMED'::reservation_status
        WHEN 1 THEN 'CHECKED_IN'::reservation_status
        WHEN 2 THEN 'CHECKED_OUT'::reservation_status
        WHEN 3 THEN 'CANCELLED'::reservation_status
        ELSE 'PENDING'::reservation_status
    END,
    CASE (i % 5)
        WHEN 0 THEN 'Payment received'
        WHEN 1 THEN 'Guest arrived'
        WHEN 2 THEN 'Guest departed'
        WHEN 3 THEN 'Cancelled by guest'
        ELSE 'Status updated'
    END,
    'Status change processed by system',
    u.id,
    r.booking_date + ((i % 10) || ' hours')::INTERVAL
FROM generate_series(1, 8000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, booking_date
    FROM reservations
    ORDER BY random()
    LIMIT 1
) r
CROSS JOIN LATERAL (
    SELECT u.id
    FROM users u
    JOIN user_tenant_associations uta ON u.id = uta.user_id
    WHERE uta.tenant_id = r.tenant_id
    ORDER BY random()
    LIMIT 1
) u;

-- =====================================================
-- 11. PAYMENTS (6000 payments)
-- =====================================================

INSERT INTO payments (
    id, tenant_id, payment_reference, reservation_id, customer_id,
    amount, currency, processing_fee, payment_method, transaction_type,
    status, gateway_provider, gateway_transaction_id, authorization_code,
    card_last_four, card_brand, billing_name, billing_email,
    description, authorized_at, captured_at, settled_at
)
SELECT
    uuid_generate_v4(),
    r.tenant_id,
    'PAY-' || LPAD(i::TEXT, 12, '0'),
    r.id,
    r.guest_id,
    (r.total_amount / 2) + ((i % 100) - 50),
    'USD',
    (r.total_amount / 2) * 0.029 + 0.30,
    CASE (i % 7)
        WHEN 0 THEN 'CASH'::payment_method
        WHEN 1 THEN 'CREDIT_CARD'::payment_method
        WHEN 2 THEN 'CREDIT_CARD'::payment_method
        WHEN 3 THEN 'DEBIT_CARD'::payment_method
        WHEN 4 THEN 'BANK_TRANSFER'::payment_method
        WHEN 5 THEN 'DIGITAL_WALLET'::payment_method
        ELSE 'CREDIT_CARD'::payment_method
    END,
    CASE (i % 6)
        WHEN 0 THEN 'CHARGE'::transaction_type
        WHEN 1 THEN 'AUTHORIZATION'::transaction_type
        WHEN 2 THEN 'CAPTURE'::transaction_type
        WHEN 3 THEN 'REFUND'::transaction_type
        ELSE 'CHARGE'::transaction_type
    END,
    CASE (i % 10)
        WHEN 0 THEN 'PENDING'::payment_status
        WHEN 1 THEN 'PROCESSING'::payment_status
        WHEN 2 THEN 'COMPLETED'::payment_status
        WHEN 3 THEN 'COMPLETED'::payment_status
        WHEN 4 THEN 'COMPLETED'::payment_status
        WHEN 5 THEN 'COMPLETED'::payment_status
        WHEN 6 THEN 'COMPLETED'::payment_status
        WHEN 7 THEN 'FAILED'::payment_status
        WHEN 8 THEN 'CANCELLED'::payment_status
        ELSE 'COMPLETED'::payment_status
    END,
    CASE (i % 4)
        WHEN 0 THEN 'Stripe'
        WHEN 1 THEN 'PayPal'
        WHEN 2 THEN 'Square'
        ELSE 'Authorize.Net'
    END,
    'TXN-' || LPAD(i::TEXT, 15, '0'),
    'AUTH-' || LPAD(i::TEXT, 10, '0'),
    LPAD((1000 + (i % 9000))::TEXT, 4, '0'),
    CASE (i % 4)
        WHEN 0 THEN 'Visa'
        WHEN 1 THEN 'Mastercard'
        WHEN 2 THEN 'Amex'
        ELSE 'Discover'
    END,
    g.first_name || ' ' || g.last_name,
    g.email,
    'Payment for reservation ' || r.confirmation_number,
    r.booking_date + INTERVAL '1 hour',
    r.booking_date + INTERVAL '2 hours',
    r.booking_date + INTERVAL '24 hours'
FROM generate_series(1, 6000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, guest_id, confirmation_number, total_amount, booking_date
    FROM reservations
    ORDER BY random()
    LIMIT 1
) r
CROSS JOIN LATERAL (
    SELECT first_name, last_name, email
    FROM guests
    WHERE id = r.guest_id
) g;

-- =====================================================
-- 12. INVOICES (4000 invoices)
-- =====================================================

INSERT INTO invoices (
    id, tenant_id, invoice_number, reservation_id, guest_id,
    invoice_date, due_date, subtotal, tax_amount, service_charge,
    discount_amount, total_amount, paid_amount, balance_due,
    currency, status, payment_terms
)
SELECT
    uuid_generate_v4(),
    r.tenant_id,
    'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(i::TEXT, 8, '0'),
    r.id,
    r.guest_id,
    r.check_in_date,
    r.check_in_date + INTERVAL '30 days',
    r.room_rate * r.nights,
    (r.room_rate * r.nights) * 0.12,
    (r.room_rate * r.nights) * 0.05,
    CASE WHEN (i % 10) = 0 THEN (r.room_rate * r.nights) * 0.1 ELSE 0 END,
    r.total_amount,
    CASE
        WHEN (i % 5) = 0 THEN 0
        WHEN (i % 5) = 1 THEN r.total_amount * 0.5
        ELSE r.total_amount
    END,
    CASE
        WHEN (i % 5) = 0 THEN r.total_amount
        WHEN (i % 5) = 1 THEN r.total_amount * 0.5
        ELSE 0
    END,
    'USD',
    CASE (i % 5)
        WHEN 0 THEN 'DRAFT'::invoice_status
        WHEN 1 THEN 'SENT'::invoice_status
        WHEN 2 THEN 'PAID'::invoice_status
        WHEN 3 THEN 'PAID'::invoice_status
        ELSE 'PARTIALLY_PAID'::invoice_status
    END,
    'Net 30'
FROM generate_series(1, 4000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, guest_id, check_in_date, room_rate, nights, total_amount
    FROM reservations
    ORDER BY random()
    LIMIT 1
) r;

-- =====================================================
-- 13. INVOICE ITEMS (12000 line items)
-- =====================================================

INSERT INTO invoice_items (
    id, tenant_id, invoice_id, item_type, description,
    quantity, unit_price, discount_percent, discount_amount,
    tax_rate, tax_amount, total_amount, service_date
)
SELECT
    uuid_generate_v4(),
    inv.tenant_id,
    inv.id,
    CASE (i % 5)
        WHEN 0 THEN 'ROOM'
        WHEN 1 THEN 'SERVICE'
        WHEN 2 THEN 'TAX'
        WHEN 3 THEN 'FEE'
        ELSE 'DISCOUNT'
    END,
    CASE (i % 10)
        WHEN 0 THEN 'Room Charge - Night ' || ((i % 7) + 1)
        WHEN 1 THEN 'Breakfast Buffet'
        WHEN 2 THEN 'Room Service'
        WHEN 3 THEN 'Minibar'
        WHEN 4 THEN 'Laundry Service'
        WHEN 5 THEN 'Spa Treatment'
        WHEN 6 THEN 'Airport Transfer'
        WHEN 7 THEN 'Late Checkout Fee'
        WHEN 8 THEN 'Tourism Tax'
        ELSE 'Early Bird Discount'
    END,
    CASE WHEN (i % 5) = 0 THEN 1 ELSE (1 + (i % 3)) END,
    25.00 + (i % 200),
    CASE WHEN (i % 20) = 0 THEN 10.0 ELSE 0.0 END,
    CASE WHEN (i % 20) = 0 THEN (25.00 + (i % 200)) * 0.1 ELSE 0.0 END,
    12.0,
    (25.00 + (i % 200)) * 0.12,
    (25.00 + (i % 200)) * 1.12 * CASE WHEN (i % 5) = 0 THEN 1 ELSE (1 + (i % 3)) END,
    inv.invoice_date + ((i % 7) || ' days')::INTERVAL
FROM generate_series(1, 12000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, invoice_date
    FROM invoices
    ORDER BY random()
    LIMIT 1
) inv;

-- =====================================================
-- 14. SERVICES (1000 services)
-- =====================================================

INSERT INTO services (
    id, tenant_id, property_id, service_code, service_name,
    category, description, price, pricing_type, tax_applicable, is_active
)
SELECT
    uuid_generate_v4(),
    p.tenant_id,
    p.id,
    'SVC-' || LPAD(i::TEXT, 6, '0'),
    CASE (i % 20)
        WHEN 0 THEN 'Breakfast Buffet'
        WHEN 1 THEN 'Room Service'
        WHEN 2 THEN 'Laundry Service'
        WHEN 3 THEN 'Dry Cleaning'
        WHEN 4 THEN 'Airport Transfer'
        WHEN 5 THEN 'Spa Massage'
        WHEN 6 THEN 'Gym Access'
        WHEN 7 THEN 'Pool Access'
        WHEN 8 THEN 'Parking'
        WHEN 9 THEN 'Late Checkout'
        WHEN 10 THEN 'Early Check-in'
        WHEN 11 THEN 'Extra Bed'
        WHEN 12 THEN 'Pet Fee'
        WHEN 13 THEN 'Minibar'
        WHEN 14 THEN 'Wi-Fi Premium'
        WHEN 15 THEN 'Meeting Room'
        WHEN 16 THEN 'Business Center'
        WHEN 17 THEN 'Babysitting'
        WHEN 18 THEN 'Tour Guide'
        ELSE 'Concierge Service'
    END,
    CASE (i % 8)
        WHEN 0 THEN 'DINING'
        WHEN 1 THEN 'HOUSEKEEPING'
        WHEN 2 THEN 'TRANSPORTATION'
        WHEN 3 THEN 'SPA'
        WHEN 4 THEN 'FITNESS'
        WHEN 5 THEN 'BUSINESS'
        WHEN 6 THEN 'RECREATION'
        ELSE 'OTHER'
    END,
    'Premium service available for guests',
    15.00 + (i % 200),
    CASE (i % 4)
        WHEN 0 THEN 'FIXED'
        WHEN 1 THEN 'PER_PERSON'
        WHEN 2 THEN 'PER_NIGHT'
        ELSE 'PER_HOUR'
    END,
    (i % 5) != 0,
    (i % 15) != 0
FROM generate_series(1, 1000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id
    FROM properties
    ORDER BY random()
    LIMIT 1
) p;

-- =====================================================
-- 15. RESERVATION SERVICES (8000 service bookings)
-- =====================================================

INSERT INTO reservation_services (
    id, tenant_id, reservation_id, service_id,
    quantity, unit_price, total_amount, service_date,
    service_time, status, notes
)
SELECT
    uuid_generate_v4(),
    r.tenant_id,
    r.id,
    s.id,
    1 + (i % 3),
    s.price,
    s.price * (1 + (i % 3)),
    r.check_in_date + ((i % (r.nights + 1)) || ' days')::INTERVAL,
    TIME '08:00:00' + ((i % 12) || ' hours')::INTERVAL,
    CASE (i % 4)
        WHEN 0 THEN 'PENDING'
        WHEN 1 THEN 'CONFIRMED'
        WHEN 2 THEN 'COMPLETED'
        ELSE 'CONFIRMED'
    END,
    CASE WHEN (i % 5) = 0 THEN 'Special handling required' ELSE NULL END
FROM generate_series(1, 8000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, check_in_date, nights
    FROM reservations
    WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
    ORDER BY random()
    LIMIT 1
) r
CROSS JOIN LATERAL (
    SELECT id, price
    FROM services
    WHERE tenant_id = r.tenant_id
    ORDER BY random()
    LIMIT 1
) s;

-- =====================================================
-- 16. HOUSEKEEPING TASKS (6000 tasks)
-- =====================================================

INSERT INTO housekeeping_tasks (
    id, tenant_id, property_id, room_id, task_type,
    priority, status, assigned_to, scheduled_date,
    scheduled_time, completed_at, notes
)
SELECT
    uuid_generate_v4(),
    rm.tenant_id,
    rm.property_id,
    rm.id,
    CASE (i % 3)
        WHEN 0 THEN 'CLEANING'
        WHEN 1 THEN 'INSPECTION'
        ELSE 'MAINTENANCE'
    END,
    CASE (i % 4)
        WHEN 0 THEN 'URGENT'
        WHEN 1 THEN 'HIGH'
        WHEN 2 THEN 'NORMAL'
        ELSE 'LOW'
    END,
    CASE (i % 5)
        WHEN 0 THEN 'PENDING'
        WHEN 1 THEN 'IN_PROGRESS'
        WHEN 2 THEN 'COMPLETED'
        WHEN 3 THEN 'COMPLETED'
        ELSE 'COMPLETED'
    END,
    u.id,
    CURRENT_DATE - ((i % 30) || ' days')::INTERVAL,
    TIME '08:00:00' + ((i % 8) || ' hours')::INTERVAL,
    CASE WHEN (i % 5) >= 2 THEN
        (CURRENT_DATE - ((i % 30) || ' days')::INTERVAL + ((i % 8) + 2 || ' hours')::INTERVAL)
    ELSE NULL END,
    CASE WHEN (i % 10) = 0 THEN 'Deep cleaning required' ELSE NULL END
FROM generate_series(1, 6000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, property_id
    FROM rooms
    ORDER BY random()
    LIMIT 1
) rm
CROSS JOIN LATERAL (
    SELECT u.id
    FROM users u
    JOIN user_tenant_associations uta ON u.id = uta.user_id
    WHERE uta.tenant_id = rm.tenant_id
    ORDER BY random()
    LIMIT 1
) u;

-- =====================================================
-- 17. CHANNEL MAPPINGS (2000 channel mappings)
-- =====================================================

INSERT INTO channel_mappings (
    id, tenant_id, property_id, channel_name, channel_property_id,
    room_type_id, channel_room_type_id, markup_percent,
    is_active, last_sync_at, sync_status
)
SELECT
    uuid_generate_v4(),
    rt.tenant_id,
    rt.property_id,
    CASE (i % 6)
        WHEN 0 THEN 'Booking.com'
        WHEN 1 THEN 'Expedia'
        WHEN 2 THEN 'Airbnb'
        WHEN 3 THEN 'Hotels.com'
        WHEN 4 THEN 'Agoda'
        ELSE 'TripAdvisor'
    END,
    'PROP-' || LPAD((i % 1000)::TEXT, 10, '0'),
    rt.id,
    'RT-' || LPAD((i % 2000)::TEXT, 10, '0'),
    5.0 + (i % 20),
    (i % 10) != 0,
    CURRENT_TIMESTAMP - ((i % 24) || ' hours')::INTERVAL,
    CASE (i % 5)
        WHEN 0 THEN 'SUCCESS'
        WHEN 1 THEN 'SUCCESS'
        WHEN 2 THEN 'SUCCESS'
        WHEN 3 THEN 'PENDING'
        ELSE 'FAILED'
    END
FROM generate_series(1, 2000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, property_id
    FROM room_types
    ORDER BY random()
    LIMIT 1
) rt;

-- =====================================================
-- 18. ROOM AVAILABILITY (50000 availability records)
-- =====================================================

INSERT INTO availability.room_availability (
    id, tenant_id, property_id, room_type_id, room_category,
    availability_date, availability_status, base_rate, current_rate,
    min_rate, max_rate, total_rooms, available_rooms,
    occupied_rooms, maintenance_rooms, blocked_rooms,
    minimum_stay, closed_to_arrival, closed_to_departure, stop_sell, currency
)
SELECT
    uuid_generate_v4(),
    rt.tenant_id,
    rt.property_id,
    rt.id,
    CASE (i % 5)
        WHEN 0 THEN 'STANDARD'::room_category
        WHEN 1 THEN 'DELUXE'::room_category
        WHEN 2 THEN 'SUITE'::room_category
        WHEN 3 THEN 'EXECUTIVE'::room_category
        ELSE 'PRESIDENTIAL'::room_category
    END,
    CURRENT_DATE + ((i % 365) || ' days')::INTERVAL,
    CASE
        WHEN occupied >= total THEN 'BOOKED'::availability_status
        WHEN (i % 50) = 0 THEN 'BLOCKED'::availability_status
        WHEN (i % 100) = 0 THEN 'MAINTENANCE'::availability_status
        ELSE 'AVAILABLE'::availability_status
    END,
    120.00 + (i % 300),
    120.00 + (i % 300) + ((i % 50) - 25),
    100.00 + (i % 250),
    180.00 + (i % 400),
    total,
    GREATEST(0, total - occupied - maint - blocked),
    occupied,
    maint,
    blocked,
    CASE WHEN (i % 7) = 0 THEN 2 ELSE 1 END,
    (i % 100) = 0,
    (i % 150) = 0,
    (i % 200) = 0,
    'USD'
FROM generate_series(1, 50000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id, property_id
    FROM room_types
    WHERE is_active = true
    ORDER BY random()
    LIMIT 1
) rt
CROSS JOIN LATERAL (
    SELECT
        (10 + (i % 40)) as total,
        (i % 15) as occupied,
        CASE WHEN (i % 100) = 0 THEN 1 ELSE 0 END as maint,
        CASE WHEN (i % 50) = 0 THEN (1 + (i % 3)) ELSE 0 END as blocked
) counts;

-- =====================================================
-- 19. ANALYTICS METRICS (10000 metrics)
-- =====================================================

INSERT INTO analytics_metrics (
    metric_id, tenant_id, metric_type, property_id, time_granularity,
    period_start, period_end, metric_value, count_value,
    percentage_value, currency_code, status, calculated_at,
    confidence_score, trend_direction
)
SELECT
    uuid_generate_v4(),
    p.tenant_id,
    CASE (i % 8)
        WHEN 0 THEN 'OCCUPANCY_RATE'::metric_type
        WHEN 1 THEN 'ADR'::metric_type
        WHEN 2 THEN 'REVPAR'::metric_type
        WHEN 3 THEN 'TOTAL_REVENUE'::metric_type
        WHEN 4 THEN 'BOOKING_COUNT'::metric_type
        WHEN 5 THEN 'CANCELLATION_RATE'::metric_type
        WHEN 6 THEN 'LENGTH_OF_STAY'::metric_type
        ELSE 'LEAD_TIME'::metric_type
    END,
    p.id,
    CASE (i % 5)
        WHEN 0 THEN 'DAILY'::time_granularity
        WHEN 1 THEN 'WEEKLY'::time_granularity
        WHEN 2 THEN 'MONTHLY'::time_granularity
        WHEN 3 THEN 'QUARTERLY'::time_granularity
        ELSE 'YEARLY'::time_granularity
    END,
    CURRENT_DATE - ((i % 365) || ' days')::INTERVAL,
    CURRENT_DATE - ((i % 365) - 1 || ' days')::INTERVAL,
    50.0 + (i % 50),
    (i % 1000),
    65.0 + (i % 35),
    'USD',
    'COMPLETED'::analytics_status,
    CURRENT_TIMESTAMP - ((i % 24) || ' hours')::INTERVAL,
    0.75 + ((i % 25) / 100.0),
    CASE (i % 4)
        WHEN 0 THEN 'UP'
        WHEN 1 THEN 'DOWN'
        WHEN 2 THEN 'STABLE'
        ELSE 'UP'
    END
FROM generate_series(1, 10000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id
    FROM properties
    ORDER BY random()
    LIMIT 1
) p;

-- =====================================================
-- 20. ANALYTICS METRIC DIMENSIONS (20000 dimensions)
-- =====================================================

INSERT INTO analytics_metric_dimensions (
    metric_id, dimension_key, dimension_value
)
SELECT
    am.metric_id,
    CASE (i % 6)
        WHEN 0 THEN 'source'
        WHEN 1 THEN 'room_type'
        WHEN 2 THEN 'market_segment'
        WHEN 3 THEN 'day_of_week'
        WHEN 4 THEN 'season'
        ELSE 'channel'
    END,
    CASE (i % 6)
        WHEN 0 THEN CASE ((i / 6) % 4) WHEN 0 THEN 'direct' WHEN 1 THEN 'ota' WHEN 2 THEN 'corporate' ELSE 'group' END
        WHEN 1 THEN CASE ((i / 6) % 4) WHEN 0 THEN 'standard' WHEN 1 THEN 'deluxe' WHEN 2 THEN 'suite' ELSE 'executive' END
        WHEN 2 THEN CASE ((i / 6) % 4) WHEN 0 THEN 'leisure' WHEN 1 THEN 'business' WHEN 2 THEN 'group' ELSE 'corporate' END
        WHEN 3 THEN CASE ((i / 6) % 7) WHEN 0 THEN 'Monday' WHEN 1 THEN 'Tuesday' WHEN 2 THEN 'Wednesday' WHEN 3 THEN 'Thursday' WHEN 4 THEN 'Friday' WHEN 5 THEN 'Saturday' ELSE 'Sunday' END
        WHEN 4 THEN CASE ((i / 6) % 4) WHEN 0 THEN 'low' WHEN 1 THEN 'shoulder' WHEN 2 THEN 'high' ELSE 'peak' END
        ELSE CASE ((i / 6) % 5) WHEN 0 THEN 'Booking.com' WHEN 1 THEN 'Expedia' WHEN 2 THEN 'Direct' WHEN 3 THEN 'Airbnb' ELSE 'Hotels.com' END
    END
FROM generate_series(1, 20000) AS i
CROSS JOIN LATERAL (
    SELECT metric_id
    FROM analytics_metrics
    ORDER BY random()
    LIMIT 1
) am;

-- =====================================================
-- 21. ANALYTICS REPORTS (2000 reports)
-- =====================================================

INSERT INTO analytics_reports (
    report_id, tenant_id, report_name, report_type, report_description,
    property_id, time_granularity, period_start, period_end,
    status, generation_started_at, generation_completed_at,
    created_by
)
SELECT
    uuid_generate_v4(),
    p.tenant_id,
    CASE (i % 8)
        WHEN 0 THEN 'Daily Performance Report'
        WHEN 1 THEN 'Monthly Revenue Analysis'
        WHEN 2 THEN 'Occupancy Trends'
        WHEN 3 THEN 'Customer Insights'
        WHEN 4 THEN 'Channel Performance'
        WHEN 5 THEN 'Executive Dashboard'
        WHEN 6 THEN 'Financial Summary'
        ELSE 'Operational Metrics'
    END || ' - ' || TO_CHAR(CURRENT_DATE - ((i % 90) || ' days')::INTERVAL, 'YYYY-MM-DD'),
    CASE (i % 8)
        WHEN 0 THEN 'DASHBOARD'
        WHEN 1 THEN 'REVENUE'
        WHEN 2 THEN 'OCCUPANCY'
        WHEN 3 THEN 'CUSTOMER'
        WHEN 4 THEN 'OPERATIONAL'
        WHEN 5 THEN 'EXECUTIVE'
        WHEN 6 THEN 'FINANCIAL'
        ELSE 'CUSTOM'
    END,
    'Automated report generation for management review',
    p.id,
    CASE (i % 4)
        WHEN 0 THEN 'DAILY'::time_granularity
        WHEN 1 THEN 'WEEKLY'::time_granularity
        WHEN 2 THEN 'MONTHLY'::time_granularity
        ELSE 'QUARTERLY'::time_granularity
    END,
    CURRENT_DATE - ((i % 90) + 30 || ' days')::INTERVAL,
    CURRENT_DATE - ((i % 90) || ' days')::INTERVAL,
    CASE (i % 4)
        WHEN 0 THEN 'COMPLETED'::analytics_status
        WHEN 1 THEN 'COMPLETED'::analytics_status
        WHEN 2 THEN 'PENDING'::analytics_status
        ELSE 'COMPLETED'::analytics_status
    END,
    CURRENT_TIMESTAMP - ((i % 24) + 2 || ' hours')::INTERVAL,
    CASE WHEN (i % 4) != 2 THEN CURRENT_TIMESTAMP - ((i % 24) || ' hours')::INTERVAL ELSE NULL END,
    u.id
FROM generate_series(1, 2000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id
    FROM properties
    ORDER BY random()
    LIMIT 1
) p
CROSS JOIN LATERAL (
    SELECT u.id
    FROM users u
    JOIN user_tenant_associations uta ON u.id = uta.user_id
    WHERE uta.tenant_id = p.tenant_id
    ORDER BY random()
    LIMIT 1
) u;

-- =====================================================
-- 22. REPORT PROPERTY IDS (4000 associations)
-- =====================================================

INSERT INTO report_property_ids (
    report_id, property_id
)
SELECT DISTINCT
    ar.report_id,
    p.id
FROM (SELECT report_id, ROW_NUMBER() OVER () as rn FROM analytics_reports LIMIT 2000) ar
CROSS JOIN LATERAL (
    SELECT id
    FROM properties
    ORDER BY random()
    LIMIT (1 + (ar.rn % 3))
) p;

-- =====================================================
-- CLEANUP
-- =====================================================

DROP FUNCTION IF EXISTS random_between(INT, INT);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Count records in each table
DO $$
DECLARE
    rec RECORD;
    row_count INTEGER;
BEGIN
    RAISE NOTICE 'Table Record Counts:';
    RAISE NOTICE '===================';

    FOR rec IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', rec.table_name) INTO row_count;
        RAISE NOTICE '% : %', RPAD(rec.table_name, 40), row_count;
    END LOOP;

    -- Check availability schema
    FOR rec IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'availability'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM availability.%I', rec.table_name) INTO row_count;
        RAISE NOTICE 'availability.% : %', RPAD(rec.table_name, 40), row_count;
    END LOOP;
END $$;
