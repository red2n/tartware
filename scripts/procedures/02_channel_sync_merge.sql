-- =====================================================
-- 02_channel_sync_merge.sql
-- Channel Manager Synchronization using MERGE
-- Syncs data from Booking.com, Expedia, Airbnb, etc.
-- Date: 2025-10-15
-- Requires: PostgreSQL 15+
-- =====================================================

\c tartware

\echo 'Creating channel synchronization procedures...'

-- =====================================================
-- Function: sync_channel_availability
-- Purpose: Sync room availability from channel managers
-- Uses: MERGE command for efficient bulk sync
-- =====================================================

CREATE OR REPLACE FUNCTION sync_channel_availability(
    p_tenant_id UUID,
    p_property_id UUID,
    p_channel_data JSONB,
    p_sync_by VARCHAR(100) DEFAULT 'CHANNEL_SYNC'
)
RETURNS TABLE (
    availability_date DATE,
    room_type_id UUID,
    action VARCHAR(10),
    available_rooms INTEGER,
    booked_rooms INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH channel_availability AS (
        SELECT
            p_property_id AS property_id,
            (item->>'room_type_id')::UUID AS room_type_id,
            (item->>'date')::DATE AS availability_date,
            (item->>'available')::INTEGER AS available_rooms,
            (item->>'booked')::INTEGER AS booked_rooms,
            (item->>'rate')::NUMERIC(10,2) AS rate,
            (item->>'min_stay')::INTEGER AS min_stay,
            (item->>'max_stay')::INTEGER AS max_stay,
            (item->>'closed')::BOOLEAN AS is_closed
        FROM jsonb_array_elements(p_channel_data) AS item
    )
    INSERT INTO availability.room_availability (
        tenant_id,
        property_id,
        room_type_id,
        availability_date,
        available_rooms,
        reserved_rooms,
        dynamic_price,
        min_length_of_stay,
        max_length_of_stay,
        stop_sell,
        created_by,
        updated_by
    )
    SELECT
        p_tenant_id,
        source.property_id,
        source.room_type_id,
        source.availability_date,
        COALESCE(source.available_rooms, 0),
        COALESCE(source.booked_rooms, 0),
        source.rate,
        source.min_stay,
        source.max_stay,
        COALESCE(source.is_closed, FALSE),
        p_sync_by,
        p_sync_by
    FROM channel_availability AS source
    ON CONFLICT ON CONSTRAINT room_avail_unique
    DO UPDATE SET
        available_rooms = EXCLUDED.available_rooms,
        reserved_rooms = EXCLUDED.reserved_rooms,
        dynamic_price = COALESCE(EXCLUDED.dynamic_price, availability.room_availability.dynamic_price),
        min_length_of_stay = COALESCE(EXCLUDED.min_length_of_stay, availability.room_availability.min_length_of_stay),
        max_length_of_stay = COALESCE(EXCLUDED.max_length_of_stay, availability.room_availability.max_length_of_stay),
        stop_sell = COALESCE(EXCLUDED.stop_sell, availability.room_availability.stop_sell),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = p_sync_by,
        version = availability.room_availability.version + 1
    RETURNING
        availability.room_availability.availability_date,
        availability.room_availability.room_type_id,
        CASE
            WHEN xmax = 0 THEN 'INSERTED'
            ELSE 'UPDATED'
        END AS action,
        availability.room_availability.available_rooms,
        availability.room_availability.reserved_rooms;
END;
$$;

COMMENT ON FUNCTION sync_channel_availability IS
'Syncs room availability from channel managers using MERGE. Handles bulk updates efficiently.';

-- =====================================================
-- Function: sync_channel_reservations
-- Purpose: Import reservations from channel managers
-- Uses: MERGE to prevent duplicate bookings
-- =====================================================

CREATE OR REPLACE FUNCTION sync_channel_reservations(
    p_tenant_id UUID,
    p_property_id UUID,
    p_channel_name VARCHAR(50),
    p_reservations JSONB,
    p_sync_by VARCHAR(100) DEFAULT 'CHANNEL_SYNC'
)
RETURNS TABLE (
    reservation_id UUID,
    confirmation_number VARCHAR(50),
    guest_email VARCHAR(255),
    action VARCHAR(10),
    check_in DATE,
    check_out DATE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_reservation JSONB;
    v_guest_id UUID;
    v_room_type_id UUID;
    v_reservation_id UUID;
    v_existing_id UUID;
    v_channel_mapping_id UUID;
BEGIN
    -- Process each reservation
    FOR v_reservation IN SELECT * FROM jsonb_array_elements(p_reservations)
    LOOP
        -- Get or create guest
        SELECT upsert_guest(
            p_tenant_id,
            v_reservation->>'guest_email',
            v_reservation->>'guest_first_name',
            v_reservation->>'guest_last_name',
            v_reservation->>'guest_phone',
            NULL, -- address
            NULL, -- city
            NULL, -- state
            v_reservation->>'guest_country',
            NULL, -- postal_code
            NULL, -- preferences
            p_sync_by
        ) INTO v_guest_id;

        -- Get room type from channel mapping
        SELECT local_room_type_id INTO v_room_type_id
        FROM channel_mappings
        WHERE tenant_id = p_tenant_id
          AND property_id = p_property_id
          AND channel_name = p_channel_name
          AND channel_room_type_id = v_reservation->>'channel_room_type_id'
          AND deleted_at IS NULL
        LIMIT 1;

        -- Check for existing reservation
        SELECT id INTO v_existing_id
        FROM reservations
        WHERE tenant_id = p_tenant_id
          AND property_id = p_property_id
          AND confirmation_number = v_reservation->>'confirmation_number'
          AND deleted_at IS NULL;

        IF v_existing_id IS NOT NULL THEN
            -- Update existing reservation
            UPDATE reservations
            SET
                guest_id = v_guest_id,
                room_type_id = v_room_type_id,
                check_in_date = (v_reservation->>'check_in')::DATE,
                check_out_date = (v_reservation->>'check_out')::DATE,
                number_of_guests = (v_reservation->>'guests')::INTEGER,
                number_of_adults = (v_reservation->>'adults')::INTEGER,
                number_of_children = COALESCE((v_reservation->>'children')::INTEGER, 0),
                total_amount = (v_reservation->>'total_amount')::NUMERIC(10,2),
                status = (v_reservation->>'status')::reservation_status,
                special_requests = v_reservation->>'special_requests',
                updated_at = CURRENT_TIMESTAMP,
                updated_by = p_sync_by,
                version = version + 1
            WHERE id = v_existing_id
            RETURNING id INTO v_reservation_id;

            action := 'UPDATED';
        ELSE
            -- Insert new reservation
            INSERT INTO reservations (
                tenant_id,
                property_id,
                guest_id,
                room_type_id,
                confirmation_number,
                check_in_date,
                check_out_date,
                number_of_guests,
                number_of_adults,
                number_of_children,
                total_amount,
                status,
                booking_source,
                special_requests,
                created_by,
                updated_by
            )
            VALUES (
                p_tenant_id,
                p_property_id,
                v_guest_id,
                v_room_type_id,
                v_reservation->>'confirmation_number',
                (v_reservation->>'check_in')::DATE,
                (v_reservation->>'check_out')::DATE,
                (v_reservation->>'guests')::INTEGER,
                (v_reservation->>'adults')::INTEGER,
                COALESCE((v_reservation->>'children')::INTEGER, 0),
                (v_reservation->>'total_amount')::NUMERIC(10,2),
                (v_reservation->>'status')::reservation_status,
                p_channel_name::booking_source,
                v_reservation->>'special_requests',
                p_sync_by,
                p_sync_by
            )
            RETURNING id INTO v_reservation_id;

            action := 'INSERTED';
        END IF;

        -- Return result
        reservation_id := v_reservation_id;
        confirmation_number := v_reservation->>'confirmation_number';
        guest_email := v_reservation->>'guest_email';
        check_in := (v_reservation->>'check_in')::DATE;
        check_out := (v_reservation->>'check_out')::DATE;

        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION sync_channel_reservations IS
'Imports reservations from channel managers. Prevents duplicates and updates existing bookings.';

-- =====================================================
-- Function: sync_channel_mapping
-- Purpose: Maintain room type mappings between PMS and channels
-- Uses: MERGE for efficient mapping updates
-- =====================================================

CREATE OR REPLACE FUNCTION sync_channel_mapping(
    p_tenant_id UUID,
    p_property_id UUID,
    p_channel_name VARCHAR(50),
    p_mappings JSONB,
    p_sync_by VARCHAR(100) DEFAULT 'SYSTEM'
)
RETURNS TABLE (
    local_room_type_id UUID,
    channel_room_type_id VARCHAR(100),
    channel_room_type_name VARCHAR(255),
    action VARCHAR(10)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH channel_mappings_data AS (
        SELECT
            p_property_id AS property_id,
            (item->>'local_room_type_id')::UUID AS local_room_type_id,
            item->>'channel_room_type_id' AS channel_room_type_id,
            item->>'channel_room_type_name' AS channel_room_type_name,
            (item->>'is_active')::BOOLEAN AS is_active
        FROM jsonb_array_elements(p_mappings) AS item
    )
    INSERT INTO channel_mappings (
        tenant_id,
        property_id,
        channel_name,
        channel_code,
        entity_type,
        entity_id,
        external_id,
        external_code,
        is_active,
        created_by,
        updated_by
    )
    SELECT
        p_tenant_id,
        source.property_id,
        p_channel_name,
        UPPER(REGEXP_REPLACE(p_channel_name, '[^A-Za-z0-9]+', '_', 'g')),
        'room_type',
        source.local_room_type_id,
        source.channel_room_type_id,
        source.channel_room_type_name,
        COALESCE(source.is_active, TRUE),
        p_sync_by,
        p_sync_by
    FROM channel_mappings_data AS source
    ON CONFLICT ON CONSTRAINT channel_mappings_unique
    DO UPDATE SET
        external_id = EXCLUDED.external_id,
        external_code = EXCLUDED.external_code,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = p_sync_by,
        version = channel_mappings.version + 1
    RETURNING
        channel_mappings.entity_id,
        channel_mappings.external_id,
        channel_mappings.external_code,
        CASE
            WHEN xmax = 0 THEN 'INSERTED'
            ELSE 'UPDATED'
        END AS action;
END;
$$;

COMMENT ON FUNCTION sync_channel_mapping IS
'Syncs room type mappings between PMS and channel managers using MERGE.';

\echo '✓ Channel synchronization procedures created successfully!'
