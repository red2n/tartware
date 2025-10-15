-- =====================================================
-- 03-sample-data-fixed.sql
-- Corrected Sample Data Generation
-- Populates all tables with working relationships
-- Date: 2025-10-15
-- =====================================================

-- Clear existing sample data (keep schema)
TRUNCATE TABLE 
    reservation_services,
    reservation_status_history,
    housekeeping_tasks,
    invoice_items,
    invoices,
    payments,
    reservations,
    availability.room_availability,
    channel_mappings,
    rooms,
    rates,
    room_types,
    guests,
    properties,
    user_tenant_associations,
    users,
    analytics_metric_dimensions,
    analytics_reports,
    report_property_ids,
    analytics_metrics,
    services,
    tenants
CASCADE;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION random_between(low INT, high INT)
RETURNS INT AS $$
BEGIN
   RETURN floor(random() * (high - low + 1) + low);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION random_date_between(start_date DATE, end_date DATE)
RETURNS DATE AS $$
BEGIN
   RETURN start_date + (random() * (end_date - start_date))::INT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. TENANTS (500 organizations)
-- =====================================================
\echo 'Inserting tenants...'

INSERT INTO tenants (
    id, name, slug, type, status, email, phone, website,
    address_line1, city, state, postal_code, country
)
SELECT
    uuid_generate_v4(),
    'Hotel Chain ' || i,
    'hotel-chain-' || i,
    CASE (i % 4)
        WHEN 0 THEN 'INDEPENDENT'::tenant_type
        WHEN 1 THEN 'CHAIN'::tenant_type
        WHEN 2 THEN 'FRANCHISE'::tenant_type
        ELSE 'MANAGEMENT_COMPANY'::tenant_type
    END,
    CASE (i % 5)
        WHEN 0 THEN 'TRIAL'::tenant_status
        ELSE 'ACTIVE'::tenant_status
    END,
    'contact' || i || '@hotelchain.com',
    '+1-555-' || LPAD(i::TEXT, 7, '0'),
    'https://hotelchain' || i || '.com',
    i || ' Main Street',
    CASE (i % 10)
        WHEN 0 THEN 'New York' WHEN 1 THEN 'Los Angeles' WHEN 2 THEN 'Chicago'
        WHEN 3 THEN 'Houston' WHEN 4 THEN 'Phoenix' WHEN 5 THEN 'Philadelphia'
        WHEN 6 THEN 'San Antonio' WHEN 7 THEN 'San Diego' WHEN 8 THEN 'Dallas'
        ELSE 'San Jose'
    END,
    'CA',
    LPAD((10000 + i)::TEXT, 5, '0'),
    'US'
FROM generate_series(1, 500) AS i;

\echo 'Inserted ' || (SELECT COUNT(*) FROM tenants) || ' tenants'

-- =====================================================
-- 2. USERS (1000 users)
-- =====================================================
\echo 'Inserting users...'

INSERT INTO users (
    id, username, email, password_hash, first_name, last_name,
    phone, is_active, is_verified
)
SELECT
    uuid_generate_v4(),
    'user' || i,
    'user' || i || '@example.com',
    '$2a$10$abcdefghijklmnopqrstuvwxyz123456789', -- placeholder hash
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
    true,
    (i % 2) = 0
FROM generate_series(1, 1000) AS i;

\echo 'Inserted ' || (SELECT COUNT(*) FROM users) || ' users'

-- =====================================================
-- 3. USER-TENANT ASSOCIATIONS (2000 associations)
-- =====================================================
\echo 'Inserting user-tenant associations...'

WITH tenant_user_pairs AS (
    SELECT 
        t.id as tenant_id,
        u.id as user_id,
        ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY random()) as rn
    FROM tenants t
    CROSS JOIN users u
)
INSERT INTO user_tenant_associations (
    id, user_id, tenant_id, role, is_active, is_primary
)
SELECT
    uuid_generate_v4(),
    user_id,
    tenant_id,
    CASE (ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY random()) % 5)
        WHEN 0 THEN 'OWNER'::tenant_role
        WHEN 1 THEN 'ADMIN'::tenant_role
        WHEN 2 THEN 'MANAGER'::tenant_role
        WHEN 3 THEN 'STAFF'::tenant_role
        ELSE 'VIEWER'::tenant_role
    END,
    true,
    rn = 1
FROM tenant_user_pairs
WHERE rn <= 4
LIMIT 2000;

\echo 'Inserted ' || (SELECT COUNT(*) FROM user_tenant_associations) || ' user-tenant associations'

-- =====================================================
-- 4. PROPERTIES (1000 properties)
-- =====================================================
\echo 'Inserting properties...'

INSERT INTO properties (
    id, tenant_id, property_name, property_code, brand,
    property_type, category, star_rating, total_rooms,
    email, phone, website,
    address_line1, city, state, postal_code, country,
    latitude, longitude,
    check_in_time, check_out_time, currency, timezone,
    is_active
)
SELECT
    uuid_generate_v4(),
    t.id,
    'Property ' || i || ' - ' || t.name,
    'PROP-' || LPAD(i::TEXT, 5, '0'),
    CASE (i % 5)
        WHEN 0 THEN 'Luxury Brand'
        WHEN 1 THEN 'Business Brand'
        WHEN 2 THEN 'Budget Brand'
        WHEN 3 THEN 'Boutique Brand'
        ELSE 'Resort Brand'
    END,
    'HOTEL',
    CASE (i % 5)
        WHEN 0 THEN 'LUXURY'
        WHEN 1 THEN 'UPSCALE'
        WHEN 2 THEN 'MIDSCALE'
        WHEN 3 THEN 'ECONOMY'
        ELSE 'BUDGET'
    END,
    2.0 + ((i % 4) * 0.5),
    50 + ((i % 10) * 50),
    'property' || i || '@hotelchain.com',
    '+1-555-' || LPAD((1000 + i)::TEXT, 7, '0'),
    'https://property' || i || '.com',
    i || ' Hotel Avenue',
    CASE (i % 10)
        WHEN 0 THEN 'New York' WHEN 1 THEN 'Los Angeles' WHEN 2 THEN 'Chicago'
        WHEN 3 THEN 'Houston' WHEN 4 THEN 'Phoenix' WHEN 5 THEN 'Philadelphia'
        WHEN 6 THEN 'San Antonio' WHEN 7 THEN 'San Diego' WHEN 8 THEN 'Dallas'
        ELSE 'San Jose'
    END,
    'CA',
    LPAD((20000 + i)::TEXT, 5, '0'),
    'US',
    40.7128 + ((i % 100) * 0.01),
    -74.0060 + ((i % 100) * 0.01),
    '15:00:00'::TIME,
    '11:00:00'::TIME,
    'USD',
    'America/New_York',
    true
FROM generate_series(1, 1000) AS i
CROSS JOIN LATERAL (
    SELECT id, name FROM tenants ORDER BY random() LIMIT 1
) t;

\echo 'Inserted ' || (SELECT COUNT(*) FROM properties) || ' properties'

-- =====================================================
-- 5. GUESTS (2000 guests)
-- =====================================================
\echo 'Inserting guests...'

INSERT INTO guests (
    id, tenant_id, first_name, last_name, email, phone,
    address_line1, city, state, postal_code, country,
    date_of_birth, nationality, id_type, id_number,
    vip_status, loyalty_number
)
SELECT
    uuid_generate_v4(),
    t.id,
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
    'guest' || i || '@email.com',
    '+1-555-' || LPAD((5000 + i)::TEXT, 7, '0'),
    i || ' Guest Street',
    CASE (i % 10)
        WHEN 0 THEN 'New York' WHEN 1 THEN 'Los Angeles' WHEN 2 THEN 'Chicago'
        WHEN 3 THEN 'Houston' WHEN 4 THEN 'Phoenix' WHEN 5 THEN 'Philadelphia'
        WHEN 6 THEN 'San Antonio' WHEN 7 THEN 'San Diego' WHEN 8 THEN 'Dallas'
        ELSE 'San Jose'
    END,
    'CA',
    LPAD((30000 + i)::TEXT, 5, '0'),
    'US',
    CURRENT_DATE - ((random() * 18250)::INT + 6570), -- Age 18-68
    'US',
    'PASSPORT',
    'PASS-' || LPAD(i::TEXT, 9, '0'),
    CASE (i % 20)
        WHEN 0 THEN 'GOLD'
        WHEN 1 THEN 'PLATINUM'
        WHEN 2 THEN 'SILVER'
        ELSE NULL
    END,
    CASE WHEN (i % 3) = 0 THEN 'LOY-' || LPAD(i::TEXT, 10, '0') ELSE NULL END
FROM generate_series(1, 2000) AS i
CROSS JOIN LATERAL (
    SELECT id FROM tenants ORDER BY random() LIMIT 1
) t;

\echo 'Inserted ' || (SELECT COUNT(*) FROM guests) || ' guests'

-- =====================================================
-- 6. ROOM TYPES (2000 room types, ~2 per property)
-- =====================================================
\echo 'Inserting room types...'

WITH property_room_types AS (
    SELECT
        p.id as property_id,
        p.tenant_id,
        ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY rt_num) as room_type_seq
    FROM properties p
    CROSS JOIN generate_series(1, 2) rt_num
)
INSERT INTO room_types (
    id, tenant_id, property_id, type_code, type_name,
    description, base_occupancy, max_occupancy, max_adults, max_children,
    size_sqm, size_sqft, is_active, display_order
)
SELECT
    uuid_generate_v4(),
    tenant_id,
    property_id,
    CASE room_type_seq
        WHEN 1 THEN 'STD'
        ELSE 'DLX'
    END,
    CASE room_type_seq
        WHEN 1 THEN 'Standard Room'
        ELSE 'Deluxe Room'
    END,
    'Comfortable and well-appointed room with modern amenities.',
    2,
    4,
    2,
    2,
    25.0 + (room_type_seq * 10),
    269.0 + (room_type_seq * 108),
    true,
    room_type_seq
FROM property_room_types;

\echo 'Inserted ' || (SELECT COUNT(*) FROM room_types) || ' room types'

-- =====================================================
-- 7. ROOMS (5000 rooms, ~5 per property)
-- =====================================================
\echo 'Inserting rooms...'

WITH property_rooms AS (
    SELECT
        rt.id as room_type_id,
        rt.tenant_id,
        rt.property_id,
        ROW_NUMBER() OVER (PARTITION BY rt.property_id ORDER BY rt.id, room_num) as room_seq
    FROM room_types rt
    CROSS JOIN generate_series(1, 5) room_num
    WHERE rt.deleted_at IS NULL
    LIMIT 5000
)
INSERT INTO rooms (
    id, tenant_id, property_id, room_type_id, room_number,
    floor, building, view_type, status, housekeeping_status,
    maintenance_status, is_smoking, is_accessible
)
SELECT
    uuid_generate_v4(),
    tenant_id,
    property_id,
    room_type_id,
    LPAD(room_seq::TEXT, 4, '0'),
    1 + ((room_seq - 1) / 20),
    CASE ((room_seq - 1) % 3)
        WHEN 0 THEN 'Main Building'
        WHEN 1 THEN 'West Wing'
        ELSE 'East Wing'
    END,
    CASE ((room_seq - 1) % 5)
        WHEN 0 THEN 'City View'
        WHEN 1 THEN 'Ocean View'
        WHEN 2 THEN 'Garden View'
        WHEN 3 THEN 'Mountain View'
        ELSE 'Pool View'
    END,
    CASE ((room_seq - 1) % 10)
        WHEN 0 THEN 'OCCUPIED'::room_status
        WHEN 1 THEN 'DIRTY'::room_status
        WHEN 2 THEN 'OUT_OF_ORDER'::room_status
        ELSE 'CLEAN'::room_status
    END,
    CASE ((room_seq - 1) % 5)
        WHEN 0 THEN 'DIRTY'::housekeeping_status
        WHEN 1 THEN 'IN_PROGRESS'::housekeeping_status
        ELSE 'CLEAN'::housekeeping_status
    END,
    CASE ((room_seq - 1) % 20)
        WHEN 0 THEN 'NEEDS_REPAIR'::maintenance_status
        WHEN 1 THEN 'UNDER_MAINTENANCE'::maintenance_status
        ELSE 'OPERATIONAL'::maintenance_status
    END,
    ((room_seq - 1) % 20) = 0,
    ((room_seq - 1) % 10) = 0
FROM property_rooms;

\echo 'Inserted ' || (SELECT COUNT(*) FROM rooms) || ' rooms'

-- =====================================================
-- 8. RATES (3000 rate plans)
-- =====================================================
\echo 'Inserting rates...'

WITH room_type_rates AS (
    SELECT
        rt.id as room_type_id,
        rt.tenant_id,
        rt.property_id,
        ROW_NUMBER() OVER (PARTITION BY rt.id ORDER BY rate_num) as rate_seq
    FROM room_types rt
    CROSS JOIN generate_series(1, 3) rate_num
    WHERE rt.deleted_at IS NULL
    LIMIT 3000
)
INSERT INTO rates (
    id, tenant_id, property_id, room_type_id,
    rate_code, rate_name, description,
    rate_strategy, rate_category, rate_status,
    base_rate, currency,
    valid_from, valid_to,
    min_length_of_stay, max_length_of_stay,
    min_advance_booking, max_advance_booking,
    is_active
)
SELECT
    uuid_generate_v4(),
    tenant_id,
    property_id,
    room_type_id,
    CASE rate_seq
        WHEN 1 THEN 'BAR'
        WHEN 2 THEN 'CORP'
        ELSE 'PROMO'
    END,
    CASE rate_seq
        WHEN 1 THEN 'Best Available Rate'
        WHEN 2 THEN 'Corporate Rate'
        ELSE 'Promotional Rate'
    END,
    'Standard rate plan with flexible terms',
    CASE rate_seq
        WHEN 1 THEN 'DYNAMIC'::rate_strategy
        WHEN 2 THEN 'FIXED'::rate_strategy
        ELSE 'SEASONAL'::rate_strategy
    END,
    'STANDARD',
    'ACTIVE'::rate_status,
    100.00 + (rate_seq * 20.00),
    'USD',
    CURRENT_DATE - 30,
    CURRENT_DATE + 365,
    1,
    30,
    0,
    365,
    true
FROM room_type_rates;

\echo 'Inserted ' || (SELECT COUNT(*) FROM rates) || ' rates'

-- =====================================================
-- 9. SERVICES (1000 services)
-- =====================================================
\echo 'Inserting services...'

INSERT INTO services (
    id, tenant_id, property_id, service_name, service_code,
    category, description, unit_price, currency,
    is_active, is_taxable
)
SELECT
    uuid_generate_v4(),
    p.tenant_id,
    p.id,
    CASE (i % 10)
        WHEN 0 THEN 'Room Service Breakfast'
        WHEN 1 THEN 'Spa Treatment'
        WHEN 2 THEN 'Airport Transfer'
        WHEN 3 THEN 'Laundry Service'
        WHEN 4 THEN 'Mini Bar'
        WHEN 5 THEN 'Parking'
        WHEN 6 THEN 'WiFi Premium'
        WHEN 7 THEN 'Gym Access'
        WHEN 8 THEN 'Late Checkout'
        ELSE 'Early Checkin'
    END,
    'SVC-' || LPAD(i::TEXT, 5, '0'),
    CASE (i % 5)
        WHEN 0 THEN 'F&B'
        WHEN 1 THEN 'WELLNESS'
        WHEN 2 THEN 'TRANSPORT'
        WHEN 3 THEN 'HOUSEKEEPING'
        ELSE 'AMENITY'
    END,
    'Premium service for guests',
    10.00 + ((i % 10) * 10.00),
    'USD',
    true,
    (i % 2) = 0
FROM generate_series(1, 1000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id FROM properties ORDER BY random() LIMIT 1
) p;

\echo 'Inserted ' || (SELECT COUNT(*) FROM services) || ' services'

-- =====================================================
-- 10. RESERVATIONS (1000 reservations)
-- =====================================================
\echo 'Inserting reservations...'

WITH reservation_data AS (
    SELECT
        uuid_generate_v4() as id,
        rt.tenant_id,
        rt.property_id,
        g.id as guest_id,
        rt.id as room_type_id,
        r.id as room_id,
        'CONF-' || LPAD(i::TEXT, 10, '0') as confirmation_number,
        random_date_between(CURRENT_DATE - 90, CURRENT_DATE + 30) as check_in_date,
        CASE (i % 4)
            WHEN 0 THEN 'PENDING'::reservation_status
            WHEN 1 THEN 'CONFIRMED'::reservation_status
            WHEN 2 THEN 'CHECKED_IN'::reservation_status
            ELSE 'CHECKED_OUT'::reservation_status
        END as status,
        CASE (i % 7)
            WHEN 0 THEN 'DIRECT'::reservation_source
            WHEN 1 THEN 'WEBSITE'::reservation_source
            WHEN 2 THEN 'PHONE'::reservation_source
            WHEN 3 THEN 'WALKIN'::reservation_source
            WHEN 4 THEN 'OTA'::reservation_source
            WHEN 5 THEN 'CORPORATE'::reservation_source
            ELSE 'GROUP'::reservation_source
        END as source,
        2 + ((i % 3)) as num_adults,
        (i % 3) as num_children,
        1 as num_rooms,
        120.00 + ((i % 10) * 30.00) as room_rate
    FROM generate_series(1, 1000) AS i
    CROSS JOIN LATERAL (
        SELECT id, tenant_id, property_id
        FROM room_types
        WHERE deleted_at IS NULL
        ORDER BY random()
        LIMIT 1
    ) rt
    CROSS JOIN LATERAL (
        SELECT id
        FROM guests
        WHERE tenant_id = rt.tenant_id
        ORDER BY random()
        LIMIT 1
    ) g
    CROSS JOIN LATERAL (
        SELECT id
        FROM rooms
        WHERE property_id = rt.property_id
          AND room_type_id = rt.id
          AND deleted_at IS NULL
        ORDER BY random()
        LIMIT 1
    ) r
)
INSERT INTO reservations (
    id, tenant_id, property_id, guest_id, room_type_id, room_id,
    confirmation_number, check_in_date, check_out_date,
    status, source,
    num_adults, num_children, num_rooms,
    room_rate, total_amount, currency,
    paid_amount, balance_due,
    booked_at
)
SELECT
    id, tenant_id, property_id, guest_id, room_type_id, room_id,
    confirmation_number,
    check_in_date,
    check_in_date + (1 + random() * 6)::INT, -- 1-7 nights
    status, source,
    num_adults, num_children, num_rooms,
    room_rate,
    room_rate * (1 + random() * 6)::INT, -- Total for length of stay
    'USD',
    CASE
        WHEN status IN ('CHECKED_OUT'::reservation_status) THEN room_rate * (1 + random() * 6)::INT
        WHEN status = 'CHECKED_IN'::reservation_status THEN room_rate * (0.5 + random() * 0.5) * (1 + random() * 6)::INT
        ELSE 0
    END,
    CASE
        WHEN status IN ('CHECKED_OUT'::reservation_status) THEN 0
        ELSE room_rate * (0.1 + random() * 0.9) * (1 + random() * 6)::INT
    END,
    check_in_date - (7 + random() * 30)::INT -- Booked 7-37 days in advance
FROM reservation_data;

\echo 'Inserted ' || (SELECT COUNT(*) FROM reservations) || ' reservations'

-- =====================================================
-- 11. PAYMENTS (500 payments)
-- =====================================================
\echo 'Inserting payments...'

INSERT INTO payments (
    id, tenant_id, reservation_id, amount, currency,
    payment_method, payment_status, transaction_type,
    transaction_id, gateway_name,
    card_last_four, card_brand,
    processed_at
)
SELECT
    uuid_generate_v4(),
    r.tenant_id,
    r.id,
    r.total_amount * (0.3 + random() * 0.7),
    'USD',
    CASE (ROW_NUMBER() OVER (ORDER BY random()) % 6)
        WHEN 0 THEN 'CASH'::payment_method
        WHEN 1 THEN 'CREDIT_CARD'::payment_method
        WHEN 2 THEN 'DEBIT_CARD'::payment_method
        WHEN 3 THEN 'BANK_TRANSFER'::payment_method
        WHEN 4 THEN 'DIGITAL_WALLET'::payment_method
        ELSE 'CHECK'::payment_method
    END,
    'COMPLETED'::payment_status,
    'CHARGE'::transaction_type,
    'TXN-' || LPAD((ROW_NUMBER() OVER (ORDER BY random()))::TEXT, 12, '0'),
    'Stripe',
    CASE WHEN (ROW_NUMBER() OVER (ORDER BY random()) % 3) < 2 
        THEN LPAD((1000 + random() * 8999)::INT::TEXT, 4, '0')
        ELSE NULL 
    END,
    CASE WHEN (ROW_NUMBER() OVER (ORDER BY random()) % 3) < 2 
        THEN CASE (ROW_NUMBER() OVER (ORDER BY random()) % 4)
            WHEN 0 THEN 'VISA'
            WHEN 1 THEN 'MASTERCARD'
            WHEN 2 THEN 'AMEX'
            ELSE 'DISCOVER'
        END
        ELSE NULL 
    END,
    CURRENT_TIMESTAMP - (random() * 90 || ' days')::INTERVAL
FROM reservations r
WHERE r.status IN ('CHECKED_IN', 'CHECKED_OUT')
ORDER BY random()
LIMIT 500;

\echo 'Inserted ' || (SELECT COUNT(*) FROM payments) || ' payments'

-- =====================================================
-- 12. ANALYTICS METRICS (10000 metrics)
-- =====================================================
\echo 'Inserting analytics metrics...'

INSERT INTO analytics_metrics (
    id, tenant_id, property_id, metric_type, metric_value,
    metric_date, time_granularity, status
)
SELECT
    uuid_generate_v4(),
    p.tenant_id,
    p.id,
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
    CASE (i % 8)
        WHEN 0 THEN 60.0 + (random() * 40)  -- Occupancy 60-100%
        WHEN 1 THEN 100.0 + (random() * 200) -- ADR 100-300
        WHEN 2 THEN 60.0 + (random() * 200)  -- RevPAR 60-260
        WHEN 3 THEN 1000.0 + (random() * 50000) -- Revenue
        WHEN 4 THEN 1.0 + (random() * 50)    -- Booking count
        WHEN 5 THEN 5.0 + (random() * 35)    -- Cancellation 5-40%
        WHEN 6 THEN 1.5 + (random() * 5)     -- LOS 1.5-6.5 nights
        ELSE 7.0 + (random() * 30)           -- Lead time 7-37 days
    END,
    CURRENT_DATE - ((i % 365) || ' days')::INTERVAL,
    'DAILY'::time_granularity,
    'COMPLETED'::analytics_status
FROM generate_series(1, 10000) AS i
CROSS JOIN LATERAL (
    SELECT id, tenant_id FROM properties ORDER BY random() LIMIT 1
) p;

\echo 'Inserted ' || (SELECT COUNT(*) FROM analytics_metrics) || ' analytics metrics'

-- =====================================================
-- SUMMARY
-- =====================================================

\echo ''
\echo '========================================='
\echo 'Sample Data Load Complete!'
\echo '========================================='
\echo ''
\echo 'Record counts:'
SELECT 'tenants' as table_name, COUNT(*) as records FROM tenants
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'user_tenant_associations', COUNT(*) FROM user_tenant_associations
UNION ALL SELECT 'properties', COUNT(*) FROM properties
UNION ALL SELECT 'guests', COUNT(*) FROM guests
UNION ALL SELECT 'room_types', COUNT(*) FROM room_types
UNION ALL SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL SELECT 'rates', COUNT(*) FROM rates
UNION ALL SELECT 'services', COUNT(*) FROM services
UNION ALL SELECT 'reservations', COUNT(*) FROM reservations
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'analytics_metrics', COUNT(*) FROM analytics_metrics
ORDER BY table_name;

\echo ''
\echo '========================================='
\echo 'Sample queries to test:'
\echo '========================================='
\echo '1. SELECT * FROM tenants LIMIT 5;'
\echo '2. SELECT * FROM properties LIMIT 5;'
\echo '3. SELECT * FROM room_types LIMIT 5;'
\echo '4. SELECT * FROM reservations LIMIT 5;'
\echo ''
