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
    MERGE INTO availability.room_availability AS target
    USING channel_availability AS source
    ON (
        target.property_id = source.property_id
        AND target.room_type_id = source.room_type_id
        AND target.availability_date = source.availability_date
        AND target.tenant_id = p_tenant_id
    )
    WHEN MATCHED THEN
        UPDATE SET
            available_rooms = source.available_rooms,
            booked_rooms = source.booked_rooms,
            rate_override = COALESCE(source.rate, target.rate_override),
            min_stay_override = COALESCE(source.min_stay, target.min_stay_override),
            max_stay_override = COALESCE(source.max_stay, target.max_stay_override),
            is_closed = COALESCE(source.is_closed, target.is_closed),
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_sync_by
    WHEN NOT MATCHED THEN
        INSERT (
            tenant_id,
            property_id,
            room_type_id,
            availability_date,
            available_rooms,
            booked_rooms,
            rate_override,
            min_stay_override,
            max_stay_override,
            is_closed,
            created_by,
            updated_by
        )
        VALUES (
            p_tenant_id,
            source.property_id,
            source.room_type_id,
            source.availability_date,
            source.available_rooms,
            source.booked_rooms,
            source.rate,
            source.min_stay,
            source.max_stay,
            source.is_closed,
            p_sync_by,
            p_sync_by
        )
    RETURNING
        target.availability_date,
        target.room_type_id,
        CASE
            WHEN xmax = 0 THEN 'INSERTED'
            ELSE 'UPDATED'
        END AS action,
        target.available_rooms,
        target.booked_rooms;
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
    MERGE INTO channel_mappings AS target
    USING channel_mappings_data AS source
    ON (
        target.tenant_id = p_tenant_id
        AND target.property_id = source.property_id
        AND target.channel_name = p_channel_name
        AND target.channel_room_type_id = source.channel_room_type_id
    )
    WHEN MATCHED AND target.deleted_at IS NULL THEN
        UPDATE SET
            local_room_type_id = source.local_room_type_id,
            channel_room_type_name = source.channel_room_type_name,
            is_active = COALESCE(source.is_active, target.is_active),
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_sync_by
    WHEN NOT MATCHED THEN
        INSERT (
            tenant_id,
            property_id,
            channel_name,
            local_room_type_id,
            channel_room_type_id,
            channel_room_type_name,
            is_active,
            created_by,
            updated_by
        )
        VALUES (
            p_tenant_id,
            source.property_id,
            p_channel_name,
            source.local_room_type_id,
            source.channel_room_type_id,
            source.channel_room_type_name,
            COALESCE(source.is_active, TRUE),
            p_sync_by,
            p_sync_by
        )
    RETURNING
        target.local_room_type_id,
        target.channel_room_type_id,
        target.channel_room_type_name,
        CASE
            WHEN xmax = 0 THEN 'INSERTED'
            ELSE 'UPDATED'
        END AS action;
END;
$$;

COMMENT ON FUNCTION sync_channel_mapping IS
'Syncs room type mappings between PMS and channel managers using MERGE.';

\echo '✓ Channel synchronization procedures created successfully!'
