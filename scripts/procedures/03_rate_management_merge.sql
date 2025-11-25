-- =====================================================
-- 03_rate_management_merge.sql
-- Rate Management with Bulk Updates using MERGE
-- Date: 2025-10-15
-- Requires: PostgreSQL 15+
-- =====================================================

\c tartware

\echo 'Creating rate management procedures...'

-- =====================================================
-- Function: sync_rate_plans
-- Purpose: Bulk update or insert rate plans
-- Uses: MERGE for efficient rate synchronization
-- =====================================================

CREATE OR REPLACE FUNCTION sync_rate_plans(
    p_tenant_id UUID,
    p_property_id UUID,
    p_rates JSONB,
    p_sync_by VARCHAR(100) DEFAULT 'RATE_SYNC'
)
RETURNS TABLE (
    rate_id UUID,
    rate_code VARCHAR(50),
    rate_name VARCHAR(255),
    base_rate NUMERIC(10,2),
    action VARCHAR(10)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH rate_data AS (
        SELECT
            p_property_id AS property_id,
            (item->>'room_type_id')::UUID AS room_type_id,
            item->>'rate_code' AS rate_code,
            item->>'rate_name' AS rate_name,
            item->>'description' AS description,
            (item->>'base_rate')::NUMERIC(10,2) AS base_rate,
            (item->>'weekend_rate')::NUMERIC(10,2) AS weekend_rate,
            (item->>'currency')::currency_code AS currency,
            (item->>'is_refundable')::BOOLEAN AS is_refundable,
            (item->>'cancellation_hours')::INTEGER AS cancellation_hours,
            (item->>'minimum_stay')::INTEGER AS minimum_stay,
            (item->>'maximum_stay')::INTEGER AS maximum_stay,
            (item->>'advance_booking_days')::INTEGER AS advance_booking_days,
            (item->>'is_active')::BOOLEAN AS is_active,
            (item->>'valid_from')::DATE AS valid_from,
            (item->>'valid_to')::DATE AS valid_to
        FROM jsonb_array_elements(p_rates) AS item
    )
    MERGE INTO rates AS target
    USING rate_data AS source
    ON (
        target.tenant_id = p_tenant_id
        AND target.property_id = source.property_id
        AND target.room_type_id = source.room_type_id
        AND target.rate_code = source.rate_code
        AND target.deleted_at IS NULL
    )
    WHEN MATCHED AND source.is_active = FALSE THEN
        UPDATE SET
            deleted_at = CURRENT_TIMESTAMP,
            deleted_by = p_sync_by
    WHEN MATCHED AND source.is_active = TRUE THEN
        UPDATE SET
            rate_name = source.rate_name,
            description = COALESCE(source.description, target.description),
            base_rate = source.base_rate,
            weekend_rate = COALESCE(source.weekend_rate, target.weekend_rate),
            currency = COALESCE(source.currency, target.currency),
            is_refundable = COALESCE(source.is_refundable, target.is_refundable),
            cancellation_hours = COALESCE(source.cancellation_hours, target.cancellation_hours),
            minimum_stay = COALESCE(source.minimum_stay, target.minimum_stay),
            maximum_stay = COALESCE(source.maximum_stay, target.maximum_stay),
            advance_booking_days = COALESCE(source.advance_booking_days, target.advance_booking_days),
            valid_from = COALESCE(source.valid_from, target.valid_from),
            valid_to = COALESCE(source.valid_to, target.valid_to),
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_sync_by,
            version = target.version + 1
    WHEN NOT MATCHED AND source.is_active = TRUE THEN
        INSERT (
            tenant_id,
            property_id,
            room_type_id,
            rate_code,
            rate_name,
            description,
            base_rate,
            weekend_rate,
            currency,
            is_refundable,
            cancellation_hours,
            minimum_stay,
            maximum_stay,
            advance_booking_days,
            valid_from,
            valid_to,
            created_by,
            updated_by
        )
        VALUES (
            p_tenant_id,
            source.property_id,
            source.room_type_id,
            source.rate_code,
            source.rate_name,
            source.description,
            source.base_rate,
            source.weekend_rate,
            COALESCE(source.currency, 'USD'),
            COALESCE(source.is_refundable, TRUE),
            COALESCE(source.cancellation_hours, 24),
            COALESCE(source.minimum_stay, 1),
            COALESCE(source.maximum_stay, 365),
            COALESCE(source.advance_booking_days, 0),
            COALESCE(source.valid_from, CURRENT_DATE),
            source.valid_to,
            p_sync_by,
            p_sync_by
        )
    RETURNING
        target.id AS rate_id,
        target.rate_code,
        target.rate_name,
        target.base_rate,
        CASE
            WHEN xmax = 0 THEN 'INSERTED'
            WHEN target.deleted_at IS NOT NULL THEN 'DELETED'
            ELSE 'UPDATED'
        END AS action;
END;
$$;

COMMENT ON FUNCTION sync_rate_plans IS
'Bulk sync rate plans using MERGE. Handles inserts, updates, and soft deletes based on is_active flag.';

-- =====================================================
-- Function: apply_seasonal_rate_adjustments
-- Purpose: Bulk apply rate adjustments for seasons/events
-- Uses: MERGE to update rates efficiently
-- =====================================================

CREATE OR REPLACE FUNCTION apply_seasonal_rate_adjustments(
    p_tenant_id UUID,
    p_property_id UUID,
    p_season_name VARCHAR(100),
    p_start_date DATE,
    p_end_date DATE,
    p_adjustment_type VARCHAR(20), -- 'PERCENTAGE' or 'FIXED'
    p_adjustment_value NUMERIC(10,2),
    p_room_type_ids UUID[] DEFAULT NULL,
    p_sync_by VARCHAR(100) DEFAULT 'SEASONAL_ADJUSTMENT'
)
RETURNS TABLE (
    rate_id UUID,
    rate_code VARCHAR(50),
    old_rate NUMERIC(10,2),
    new_rate NUMERIC(10,2),
    adjustment NUMERIC(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_rate RECORD;
    v_new_rate NUMERIC(10,2);
BEGIN
    FOR v_rate IN
        SELECT
            r.id,
            r.rate_code,
            r.base_rate,
            r.room_type_id
        FROM rates r
        WHERE r.tenant_id = p_tenant_id
          AND r.property_id = p_property_id
          AND r.deleted_at IS NULL
          AND (p_room_type_ids IS NULL OR r.room_type_id = ANY(p_room_type_ids))
          AND (r.valid_from IS NULL OR r.valid_from <= p_end_date)
          AND (r.valid_to IS NULL OR r.valid_to >= p_start_date)
    LOOP
        -- Calculate new rate
        IF p_adjustment_type = 'PERCENTAGE' THEN
            v_new_rate := v_rate.base_rate * (1 + p_adjustment_value / 100);
        ELSIF p_adjustment_type = 'FIXED' THEN
            v_new_rate := v_rate.base_rate + p_adjustment_value;
        ELSE
            RAISE EXCEPTION 'Invalid adjustment type: %. Must be PERCENTAGE or FIXED.', p_adjustment_type;
        END IF;

        -- Ensure rate is positive
        v_new_rate := GREATEST(v_new_rate, 0);

        -- Update rate
        UPDATE rates
        SET
            base_rate = v_new_rate,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_sync_by,
            version = version + 1,
            metadata = COALESCE(metadata, '{}'::JSONB) ||
                      jsonb_build_object(
                          'seasonal_adjustments',
                          COALESCE(metadata->'seasonal_adjustments', '[]'::JSONB) ||
                          jsonb_build_array(jsonb_build_object(
                              'season', p_season_name,
                              'start_date', p_start_date,
                              'end_date', p_end_date,
                              'adjustment_type', p_adjustment_type,
                              'adjustment_value', p_adjustment_value,
                              'old_rate', v_rate.base_rate,
                              'new_rate', v_new_rate,
                              'applied_at', CURRENT_TIMESTAMP,
                              'applied_by', p_sync_by
                          ))
                      )
        WHERE id = v_rate.id;

        -- Return result
        rate_id := v_rate.id;
        rate_code := v_rate.rate_code;
        old_rate := v_rate.base_rate;
        new_rate := v_new_rate;
        adjustment := v_new_rate - v_rate.base_rate;

        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION apply_seasonal_rate_adjustments IS
'Applies bulk rate adjustments for seasonal pricing. Supports percentage or fixed adjustments.';

-- =====================================================
-- Function: sync_daily_rate_overrides
-- Purpose: Set specific rates for specific dates (holidays, events)
-- Uses: ON CONFLICT for date-specific rate overrides
-- =====================================================

CREATE OR REPLACE FUNCTION sync_daily_rate_overrides(
    p_tenant_id UUID,
    p_property_id UUID,
    p_overrides JSONB,
    p_sync_by VARCHAR(100) DEFAULT 'RATE_OVERRIDE'
)
RETURNS TABLE (
    override_date DATE,
    room_type_id UUID,
    rate_plan_id UUID,
    rate_code VARCHAR(50),
    override_rate NUMERIC(10,2),
    action VARCHAR(10)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_override JSONB;
    v_existing_count INTEGER;
    v_rate_plan_id UUID;
    v_rate_code TEXT;
BEGIN
    -- Process each override
    FOR v_override IN SELECT * FROM jsonb_array_elements(p_overrides)
    LOOP
        v_rate_code := v_override->>'rate_code';
        v_rate_plan_id := COALESCE(
            NULLIF(v_override->>'rate_plan_id', '')::UUID,
            (
                SELECT id
                FROM rates
                WHERE tenant_id = p_tenant_id
                  AND property_id = p_property_id
                  AND room_type_id = (v_override->>'room_type_id')::UUID
                  AND rate_code = NULLIF(v_rate_code, '')
                  AND deleted_at IS NULL
                ORDER BY valid_from DESC
                LIMIT 1
            )
        );

        IF v_rate_plan_id IS NULL THEN
            RAISE EXCEPTION
                'sync_daily_rate_overrides: unable to resolve rate plan (tenant %, property %, room_type %, date %, rate_code %)',
                p_tenant_id,
                p_property_id,
                (v_override->>'room_type_id')::UUID,
                (v_override->>'date')::DATE,
                v_rate_code;
        END IF;

        -- Update room_availability with rate override
        INSERT INTO availability.room_availability (
            tenant_id,
            property_id,
            room_type_id,
            rate_plan_id,
            availability_date,
            rate_override,
            min_stay_override,
            max_stay_override,
            is_closed,
            created_by,
            updated_by
        )
        VALUES (
            p_tenant_id,
            p_property_id,
            (v_override->>'room_type_id')::UUID,
            v_rate_plan_id,
            (v_override->>'date')::DATE,
            (v_override->>'rate')::NUMERIC(10,2),
            (v_override->>'min_stay')::INTEGER,
            (v_override->>'max_stay')::INTEGER,
            COALESCE((v_override->>'is_closed')::BOOLEAN, FALSE),
            p_sync_by,
            p_sync_by
        )
        ON CONFLICT (property_id, room_type_id, rate_plan_id, availability_date)
        DO UPDATE SET
            rate_override = EXCLUDED.rate_override,
            min_stay_override = COALESCE(EXCLUDED.min_stay_override, availability.room_availability.min_stay_override),
            max_stay_override = COALESCE(EXCLUDED.max_stay_override, availability.room_availability.max_stay_override),
            is_closed = COALESCE(EXCLUDED.is_closed, availability.room_availability.is_closed),
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_sync_by;

        GET DIAGNOSTICS v_existing_count = ROW_COUNT;

        -- Return result
        override_date := (v_override->>'date')::DATE;
        room_type_id := (v_override->>'room_type_id')::UUID;
        rate_plan_id := v_rate_plan_id;
        rate_code := v_rate_code;
        override_rate := (v_override->>'rate')::NUMERIC(10,2);
        action := CASE WHEN v_existing_count = 1 THEN 'INSERTED' ELSE 'UPDATED' END;

        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION sync_daily_rate_overrides IS
'Sets date-specific rate overrides for holidays, events, or special occasions using ON CONFLICT.';

-- =====================================================
-- Function: seed_room_availability
-- Purpose: Pre-populate availability grid for rate-plan × room-type × date
-- Ensures the next N days exist for every active rate plan
-- =====================================================

CREATE OR REPLACE FUNCTION seed_room_availability(
    p_tenant_id UUID DEFAULT NULL,
    p_property_id UUID DEFAULT NULL,
    p_horizon_days INTEGER DEFAULT 365,
    p_seed_missing_only BOOLEAN DEFAULT TRUE,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_seeded_by VARCHAR(100) DEFAULT 'AVAILABILITY_SEED'
)
RETURNS TABLE (
    inserted_count INTEGER,
    updated_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
BEGIN
    IF p_horizon_days IS NULL OR p_horizon_days <= 0 THEN
        RAISE EXCEPTION 'p_horizon_days must be greater than zero (received %)', p_horizon_days;
    END IF;

    IF p_start_date IS NULL THEN
        p_start_date := CURRENT_DATE;
    END IF;

    IF p_seeded_by IS NULL OR btrim(p_seeded_by) = '' THEN
        p_seeded_by := 'AVAILABILITY_SEED';
    END IF;

    IF p_seed_missing_only THEN
        WITH date_range AS (
            SELECT generate_series(
                p_start_date,
                p_start_date + (p_horizon_days - 1),
                INTERVAL '1 day'
            )::DATE AS availability_date
        ),
        room_capacity AS (
            SELECT
                tenant_id,
                property_id,
                room_type_id,
                COUNT(*) AS total_rooms,
                COUNT(*) FILTER (
                    WHERE is_blocked = TRUE
                       OR status IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE')
                ) AS blocked_rooms,
                COUNT(*) FILTER (
                    WHERE housekeeping_status IN ('DIRTY', 'IN_PROGRESS', 'DO_NOT_DISTURB')
                ) AS housekeeping_hold_rooms,
                COUNT(*) FILTER (
                    WHERE is_out_of_order = TRUE
                       OR maintenance_status IN ('UNDER_MAINTENANCE', 'OUT_OF_ORDER')
                       OR status IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE')
                ) AS out_of_order_rooms
            FROM rooms
            WHERE COALESCE(is_deleted, FALSE) = FALSE
            GROUP BY tenant_id, property_id, room_type_id
        ),
        property_inventory AS (
            SELECT id AS property_id, tenant_id, total_rooms
            FROM properties
            WHERE COALESCE(is_deleted, FALSE) = FALSE
        ),
        rates_active AS (
            SELECT *
            FROM rates
            WHERE COALESCE(is_deleted, FALSE) = FALSE
              AND status = 'ACTIVE'
        ),
        target_rows AS (
            SELECT
                r.tenant_id,
                r.property_id,
                r.room_type_id,
                r.id AS rate_plan_id,
                dr.availability_date,
                GREATEST(
                    COALESCE(rc.total_rooms, pi.total_rooms, 0),
                    COALESCE(rc.blocked_rooms, 0)
                        + COALESCE(rc.housekeeping_hold_rooms, 0)
                        + COALESCE(rc.out_of_order_rooms, 0)
                )::INTEGER AS base_capacity,
                GREATEST(
                    GREATEST(
                        COALESCE(rc.total_rooms, pi.total_rooms, 0),
                        COALESCE(rc.blocked_rooms, 0)
                            + COALESCE(rc.housekeeping_hold_rooms, 0)
                            + COALESCE(rc.out_of_order_rooms, 0)
                    ) - (
                        COALESCE(rc.blocked_rooms, 0)
                        + COALESCE(rc.housekeeping_hold_rooms, 0)
                        + COALESCE(rc.out_of_order_rooms, 0)
                    ),
                    0
                )::INTEGER AS available_rooms,
                COALESCE(rc.blocked_rooms, 0)::INTEGER AS blocked_rooms,
                COALESCE(rc.housekeeping_hold_rooms, 0)::INTEGER AS housekeeping_hold_rooms,
                COALESCE(rc.out_of_order_rooms, 0)::INTEGER AS out_of_order_rooms,
                COALESCE(r.base_rate, 0)::DECIMAL(15,2) AS base_price,
                COALESCE(r.currency, 'USD') AS currency,
                COALESCE(r.min_length_of_stay, 1) AS min_length_of_stay,
                r.max_length_of_stay,
                COALESCE(r.closed_to_arrival, FALSE) AS closed_to_arrival,
                COALESCE(r.closed_to_departure, FALSE) AS closed_to_departure
            FROM rates_active r
            JOIN date_range dr
                ON dr.availability_date BETWEEN r.valid_from
                AND COALESCE(r.valid_until, dr.availability_date)
            LEFT JOIN room_capacity rc
                ON rc.tenant_id = r.tenant_id
               AND rc.property_id = r.property_id
               AND rc.room_type_id = r.room_type_id
            LEFT JOIN property_inventory pi
                ON pi.property_id = r.property_id
               AND pi.tenant_id = r.tenant_id
            WHERE (p_tenant_id IS NULL OR r.tenant_id = p_tenant_id)
              AND (p_property_id IS NULL OR r.property_id = p_property_id)
        ),
        inserted_rows AS (
            INSERT INTO availability.room_availability (
                tenant_id,
                property_id,
                room_type_id,
                rate_plan_id,
                availability_date,
                base_capacity,
                available_rooms,
                booked_rooms,
                blocked_rooms,
                housekeeping_hold_rooms,
                out_of_order_rooms,
                oversell_limit,
                channel_allocations,
                base_price,
                currency,
                min_length_of_stay,
                max_length_of_stay,
                closed_to_arrival,
                closed_to_departure,
                stop_sell,
                is_closed,
                release_back_minutes,
                status,
                metadata,
                created_by
            )
            SELECT
                tr.tenant_id,
                tr.property_id,
                tr.room_type_id,
                tr.rate_plan_id,
                tr.availability_date,
                tr.base_capacity,
                tr.available_rooms,
                0,
                tr.blocked_rooms,
                tr.housekeeping_hold_rooms,
                tr.out_of_order_rooms,
                0,
                '{}'::JSONB,
                tr.base_price,
                tr.currency,
                tr.min_length_of_stay,
                tr.max_length_of_stay,
                tr.closed_to_arrival,
                tr.closed_to_departure,
                FALSE,
                FALSE,
                120,
                CASE
                    WHEN tr.out_of_order_rooms >= tr.base_capacity THEN 'MAINTENANCE'
                    WHEN tr.available_rooms = 0 THEN 'BLOCKED'
                    ELSE 'AVAILABLE'
                END,
                '{}'::JSONB,
                p_seeded_by
            FROM target_rows tr
            ON CONFLICT (property_id, room_type_id, rate_plan_id, availability_date)
            DO NOTHING
            RETURNING 1 AS inserted_flag
        )
        SELECT COALESCE(SUM(inserted_flag), 0) INTO v_inserted
        FROM inserted_rows;

        v_updated := 0;
    ELSE
        WITH date_range AS (
            SELECT generate_series(
                p_start_date,
                p_start_date + (p_horizon_days - 1),
                INTERVAL '1 day'
            )::DATE AS availability_date
        ),
        room_capacity AS (
            SELECT
                tenant_id,
                property_id,
                room_type_id,
                COUNT(*) AS total_rooms,
                COUNT(*) FILTER (
                    WHERE is_blocked = TRUE
                       OR status IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE')
                ) AS blocked_rooms,
                COUNT(*) FILTER (
                    WHERE housekeeping_status IN ('DIRTY', 'IN_PROGRESS', 'DO_NOT_DISTURB')
                ) AS housekeeping_hold_rooms,
                COUNT(*) FILTER (
                    WHERE is_out_of_order = TRUE
                       OR maintenance_status IN ('UNDER_MAINTENANCE', 'OUT_OF_ORDER')
                       OR status IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE')
                ) AS out_of_order_rooms
            FROM rooms
            WHERE COALESCE(is_deleted, FALSE) = FALSE
            GROUP BY tenant_id, property_id, room_type_id
        ),
        property_inventory AS (
            SELECT id AS property_id, tenant_id, total_rooms
            FROM properties
            WHERE COALESCE(is_deleted, FALSE) = FALSE
        ),
        rates_active AS (
            SELECT *
            FROM rates
            WHERE COALESCE(is_deleted, FALSE) = FALSE
              AND status = 'ACTIVE'
        ),
        target_rows AS (
            SELECT
                r.tenant_id,
                r.property_id,
                r.room_type_id,
                r.id AS rate_plan_id,
                dr.availability_date,
                GREATEST(
                    COALESCE(rc.total_rooms, pi.total_rooms, 0),
                    COALESCE(rc.blocked_rooms, 0)
                        + COALESCE(rc.housekeeping_hold_rooms, 0)
                        + COALESCE(rc.out_of_order_rooms, 0)
                )::INTEGER AS base_capacity,
                GREATEST(
                    GREATEST(
                        COALESCE(rc.total_rooms, pi.total_rooms, 0),
                        COALESCE(rc.blocked_rooms, 0)
                            + COALESCE(rc.housekeeping_hold_rooms, 0)
                            + COALESCE(rc.out_of_order_rooms, 0)
                    ) - (
                        COALESCE(rc.blocked_rooms, 0)
                        + COALESCE(rc.housekeeping_hold_rooms, 0)
                        + COALESCE(rc.out_of_order_rooms, 0)
                    ),
                    0
                )::INTEGER AS available_rooms,
                COALESCE(rc.blocked_rooms, 0)::INTEGER AS blocked_rooms,
                COALESCE(rc.housekeeping_hold_rooms, 0)::INTEGER AS housekeeping_hold_rooms,
                COALESCE(rc.out_of_order_rooms, 0)::INTEGER AS out_of_order_rooms,
                COALESCE(r.base_rate, 0)::DECIMAL(15,2) AS base_price,
                COALESCE(r.currency, 'USD') AS currency,
                COALESCE(r.min_length_of_stay, 1) AS min_length_of_stay,
                r.max_length_of_stay,
                COALESCE(r.closed_to_arrival, FALSE) AS closed_to_arrival,
                COALESCE(r.closed_to_departure, FALSE) AS closed_to_departure
            FROM rates_active r
            JOIN date_range dr
                ON dr.availability_date BETWEEN r.valid_from
                AND COALESCE(r.valid_until, dr.availability_date)
            LEFT JOIN room_capacity rc
                ON rc.tenant_id = r.tenant_id
               AND rc.property_id = r.property_id
               AND rc.room_type_id = r.room_type_id
            LEFT JOIN property_inventory pi
                ON pi.property_id = r.property_id
               AND pi.tenant_id = r.tenant_id
            WHERE (p_tenant_id IS NULL OR r.tenant_id = p_tenant_id)
              AND (p_property_id IS NULL OR r.property_id = p_property_id)
        ),
        upsert_rows AS (
            INSERT INTO availability.room_availability (
                tenant_id,
                property_id,
                room_type_id,
                rate_plan_id,
                availability_date,
                base_capacity,
                available_rooms,
                available_rooms,
                0,
                blocked_rooms,
                housekeeping_hold_rooms,
                out_of_order_rooms,
                oversell_limit,
                channel_allocations,
                base_price,
                currency,
                min_length_of_stay,
                max_length_of_stay,
                closed_to_arrival,
                closed_to_departure,
                stop_sell,
                is_closed,
                release_back_minutes,
                status,
                metadata,
                created_by
            )
            SELECT
                tr.tenant_id,
                tr.property_id,
                tr.room_type_id,
                tr.rate_plan_id,
                tr.availability_date,
                tr.base_capacity,
                tr.available_rooms,
                0,
                tr.blocked_rooms,
                tr.housekeeping_hold_rooms,
                tr.out_of_order_rooms,
                0,
                '{}'::JSONB,
                tr.base_price,
                tr.currency,
                tr.min_length_of_stay,
                tr.max_length_of_stay,
                tr.closed_to_arrival,
                tr.closed_to_departure,
                FALSE,
                FALSE,
                120,
                CASE
                    WHEN tr.out_of_order_rooms >= tr.base_capacity THEN 'MAINTENANCE'
                    WHEN tr.available_rooms = 0 THEN 'BLOCKED'
                    ELSE 'AVAILABLE'
                END,
                '{}'::JSONB,
                p_seeded_by
            FROM target_rows tr
            ON CONFLICT (property_id, room_type_id, rate_plan_id, availability_date)
            DO UPDATE SET
                base_capacity = EXCLUDED.base_capacity,
                oversell_limit = EXCLUDED.oversell_limit,
                base_price = EXCLUDED.base_price,
                currency = EXCLUDED.currency,
                min_length_of_stay = EXCLUDED.min_length_of_stay,
                max_length_of_stay = EXCLUDED.max_length_of_stay,
                closed_to_arrival = EXCLUDED.closed_to_arrival,
                closed_to_departure = EXCLUDED.closed_to_departure,
                release_back_minutes = EXCLUDED.release_back_minutes,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = p_seeded_by
            RETURNING (xmax = 0) AS was_inserted
        )
        SELECT
            COALESCE(SUM(CASE WHEN was_inserted THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN NOT was_inserted THEN 1 ELSE 0 END), 0)
        INTO v_inserted, v_updated
        FROM upsert_rows;
    END IF;

    RETURN QUERY SELECT COALESCE(v_inserted, 0), COALESCE(v_updated, 0);
END;
$$;

COMMENT ON FUNCTION seed_room_availability IS
'Populates availability.room_availability for every rate-plan × room-type × date combination within the requested horizon.';

-- =====================================================
-- Function: refresh_room_availability_window
-- Purpose: Recalculate booked/available rooms for a specific property window
-- Ensures availability reflects current reservation ledger
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_room_availability_window(
    p_property_id UUID,
    p_room_type_id UUID DEFAULT NULL,
    p_start_date DATE,
    p_end_date DATE,
    p_tenant_id UUID DEFAULT NULL,
    p_updated_by VARCHAR(100) DEFAULT 'AVAILABILITY_REFRESH'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_rows_updated INTEGER := 0;
BEGIN
    IF p_property_id IS NULL THEN
        RAISE EXCEPTION 'refresh_room_availability_window requires property_id';
    END IF;

    IF p_start_date IS NULL OR p_end_date IS NULL THEN
        RAISE EXCEPTION 'refresh_room_availability_window requires start/end dates';
    END IF;

    IF p_end_date < p_start_date THEN
        RETURN 0;
    END IF;

    WITH reservation_base AS (
        SELECT *
        FROM reservations r
        WHERE r.property_id = p_property_id
          AND (p_room_type_id IS NULL OR r.room_type_id = p_room_type_id)
          AND (p_tenant_id IS NULL OR r.tenant_id = p_tenant_id)
          AND COALESCE(r.is_deleted, FALSE) = FALSE
          AND r.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
          AND r.check_in_date <= p_end_date
          AND r.check_out_date > p_start_date
    ),
    reservation_counts AS (
        SELECT
            r.tenant_id,
            r.property_id,
            r.room_type_id,
            COALESCE(r.rate_id, fallback_rate.id) AS rate_plan_id,
            stay_dates.stay_date,
            COUNT(*) AS rooms_held
        FROM reservation_base r
        JOIN LATERAL (
            SELECT generate_series(
                GREATEST(r.check_in_date, p_start_date),
                LEAST(r.check_out_date - INTERVAL '1 day', p_end_date),
                INTERVAL '1 day'
            )::DATE AS stay_date
        ) stay_dates ON TRUE
        LEFT JOIN LATERAL (
            SELECT id
            FROM rates
            WHERE tenant_id = r.tenant_id
              AND property_id = r.property_id
              AND room_type_id = r.room_type_id
              AND status = 'ACTIVE'
              AND valid_from <= stay_dates.stay_date
              AND (valid_until IS NULL OR valid_until >= stay_dates.stay_date)
            ORDER BY valid_from DESC
            LIMIT 1
        ) fallback_rate ON TRUE
        WHERE COALESCE(r.rate_id, fallback_rate.id) IS NOT NULL
        GROUP BY
            r.tenant_id,
            r.property_id,
            r.room_type_id,
            COALESCE(r.rate_id, fallback_rate.id),
            stay_dates.stay_date
    ),
    target_rows AS (
        SELECT
            ra.tenant_id,
            ra.property_id,
            ra.room_type_id,
            ra.rate_plan_id,
            ra.availability_date,
            COALESCE(rc.rooms_held, 0) AS rooms_held
        FROM availability.room_availability ra
        LEFT JOIN reservation_counts rc
            ON rc.property_id = ra.property_id
           AND rc.room_type_id = ra.room_type_id
           AND rc.rate_plan_id = ra.rate_plan_id
           AND rc.stay_date = ra.availability_date
        WHERE ra.property_id = p_property_id
          AND (p_room_type_id IS NULL OR ra.room_type_id = p_room_type_id)
          AND (p_tenant_id IS NULL OR ra.tenant_id = p_tenant_id)
          AND ra.availability_date BETWEEN p_start_date AND p_end_date
    )
    UPDATE availability.room_availability AS ra
    SET
        booked_rooms = target_rows.rooms_held,
        available_rooms = GREATEST(
            ra.base_capacity + ra.oversell_limit - (
                target_rows.rooms_held
                + ra.blocked_rooms
                + ra.housekeeping_hold_rooms
                + ra.out_of_order_rooms
            ),
            0
        ),
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = p_updated_by
    FROM target_rows
    WHERE ra.property_id = target_rows.property_id
      AND ra.room_type_id = target_rows.room_type_id
      AND ra.rate_plan_id = target_rows.rate_plan_id
      AND ra.availability_date = target_rows.availability_date;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RETURN COALESCE(v_rows_updated, 0);
END;
$$;

COMMENT ON FUNCTION refresh_room_availability_window IS
'Rebuilds booked/available room counts for a property (optionally room type) across the provided date range.';

-- =====================================================
-- Function: copy_rate_plan
-- Purpose: Clone an existing rate plan with adjustments
-- =====================================================

CREATE OR REPLACE FUNCTION copy_rate_plan(
    p_source_rate_id UUID,
    p_new_rate_code VARCHAR(50),
    p_new_rate_name VARCHAR(255),
    p_adjustment_type VARCHAR(20) DEFAULT NULL, -- 'PERCENTAGE' or 'FIXED'
    p_adjustment_value NUMERIC(10,2) DEFAULT 0,
    p_created_by VARCHAR(100) DEFAULT 'SYSTEM'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_rate_id UUID;
    v_source_rate RECORD;
    v_new_base_rate NUMERIC(10,2);
    v_new_weekend_rate NUMERIC(10,2);
BEGIN
    -- Get source rate
    SELECT * INTO v_source_rate
    FROM rates
    WHERE id = p_source_rate_id
      AND deleted_at IS NULL;

    IF v_source_rate IS NULL THEN
        RAISE EXCEPTION 'Source rate not found or deleted: %', p_source_rate_id;
    END IF;

    -- Calculate adjusted rates
    IF p_adjustment_type = 'PERCENTAGE' THEN
        v_new_base_rate := v_source_rate.base_rate * (1 + p_adjustment_value / 100);
        v_new_weekend_rate := v_source_rate.weekend_rate * (1 + p_adjustment_value / 100);
    ELSIF p_adjustment_type = 'FIXED' THEN
        v_new_base_rate := v_source_rate.base_rate + p_adjustment_value;
        v_new_weekend_rate := v_source_rate.weekend_rate + p_adjustment_value;
    ELSE
        v_new_base_rate := v_source_rate.base_rate;
        v_new_weekend_rate := v_source_rate.weekend_rate;
    END IF;

    -- Insert new rate
    INSERT INTO rates (
        tenant_id,
        property_id,
        room_type_id,
        rate_code,
        rate_name,
        description,
        base_rate,
        weekend_rate,
        currency,
        is_refundable,
        cancellation_hours,
        minimum_stay,
        maximum_stay,
        advance_booking_days,
        valid_from,
        valid_to,
        meal_plan,
        metadata,
        created_by,
        updated_by
    )
    SELECT
        tenant_id,
        property_id,
        room_type_id,
        p_new_rate_code,
        p_new_rate_name,
        description,
        v_new_base_rate,
        v_new_weekend_rate,
        currency,
        is_refundable,
        cancellation_hours,
        minimum_stay,
        maximum_stay,
        advance_booking_days,
        valid_from,
        valid_to,
        meal_plan,
        COALESCE(metadata, '{}'::JSONB) ||
        jsonb_build_object(
            'copied_from', p_source_rate_id,
            'adjustment_type', p_adjustment_type,
            'adjustment_value', p_adjustment_value
        ),
        p_created_by,
        p_created_by
    FROM rates
    WHERE id = p_source_rate_id
    RETURNING id INTO v_new_rate_id;

    RETURN v_new_rate_id;
END;
$$;

COMMENT ON FUNCTION copy_rate_plan IS
'Creates a copy of an existing rate plan with optional price adjustments.';

\echo '✓ Rate management procedures created successfully!'
