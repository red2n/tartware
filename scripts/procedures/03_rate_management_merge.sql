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
            (item->>'currency')::VARCHAR(3) AS currency,
            (item->>'is_refundable')::BOOLEAN AS is_refundable,
            (item->>'cancellation_hours')::INTEGER AS cancellation_hours,
            (item->>'minimum_stay')::INTEGER AS minimum_stay,
            (item->>'maximum_stay')::INTEGER AS maximum_stay,
            (item->>'advance_booking_days')::INTEGER AS advance_booking_days,
            (item->>'is_active')::BOOLEAN AS is_active,
            (item->>'valid_from')::DATE AS valid_from,
            (item->>'valid_to')::DATE AS valid_to
        FROM jsonb_array_elements(p_rates) AS item
    ),
    updated_active AS (
        UPDATE rates AS target
        SET
            rate_name = source.rate_name,
            description = COALESCE(source.description, target.description),
            base_rate = COALESCE(source.base_rate, target.base_rate),
            currency = COALESCE(source.currency, target.currency),
            min_length_of_stay = COALESCE(source.minimum_stay, target.min_length_of_stay),
            max_length_of_stay = COALESCE(source.maximum_stay, target.max_length_of_stay),
            advance_booking_days_max = COALESCE(source.advance_booking_days, target.advance_booking_days_max),
            valid_from = COALESCE(source.valid_from, target.valid_from),
            valid_until = COALESCE(source.valid_to, target.valid_until),
            status = 'ACTIVE',
            is_deleted = FALSE,
            deleted_at = NULL,
            deleted_by = NULL,
            cancellation_policy = CASE
                WHEN source.cancellation_hours IS NULL THEN target.cancellation_policy
                ELSE jsonb_build_object('hours', source.cancellation_hours, 'penalty', 0, 'type', 'flexible')
            END,
            modifiers = CASE
                WHEN source.weekend_rate IS NULL THEN target.modifiers
                ELSE COALESCE(target.modifiers, '{}'::jsonb) || jsonb_build_object('weekendRate', source.weekend_rate)
            END,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_sync_by,
            version = target.version + 1
        FROM rate_data AS source
        WHERE target.tenant_id = p_tenant_id
          AND target.property_id = source.property_id
          AND target.rate_code = source.rate_code
          AND target.deleted_at IS NULL
          AND COALESCE(source.is_active, TRUE) = TRUE
        RETURNING
            target.id AS rate_id,
            target.rate_code,
            target.rate_name,
            target.base_rate,
            'UPDATED'::VARCHAR(10) AS action
    ),
    updated_inactive AS (
        UPDATE rates AS target
        SET
            status = 'INACTIVE',
            is_deleted = TRUE,
            deleted_at = CURRENT_TIMESTAMP,
            deleted_by = p_sync_by,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_sync_by,
            version = target.version + 1
        FROM rate_data AS source
        WHERE target.tenant_id = p_tenant_id
          AND target.property_id = source.property_id
          AND target.rate_code = source.rate_code
          AND COALESCE(source.is_active, TRUE) = FALSE
          AND target.deleted_at IS NULL
        RETURNING
            target.id AS rate_id,
            target.rate_code,
            target.rate_name,
            target.base_rate,
            'DELETED'::VARCHAR(10) AS action
    ),
    inserted AS (
        INSERT INTO rates (
            tenant_id,
            property_id,
            room_type_id,
            rate_code,
            rate_name,
            description,
            base_rate,
            currency,
            min_length_of_stay,
            max_length_of_stay,
            advance_booking_days_min,
            advance_booking_days_max,
            valid_from,
            valid_until,
            status,
            cancellation_policy,
            modifiers,
            created_by,
            updated_by
        )
        SELECT
            p_tenant_id,
            source.property_id,
            source.room_type_id,
            source.rate_code,
            source.rate_name,
            source.description,
            COALESCE(source.base_rate, 0),
            COALESCE(source.currency, 'USD'),
            COALESCE(source.minimum_stay, 1),
            source.maximum_stay,
            0,
            COALESCE(source.advance_booking_days, 0),
            COALESCE(source.valid_from, CURRENT_DATE),
            source.valid_to,
            'ACTIVE',
            CASE
                WHEN source.cancellation_hours IS NULL THEN NULL
                ELSE jsonb_build_object('hours', source.cancellation_hours, 'penalty', 0, 'type', 'flexible')
            END,
            CASE
                WHEN source.weekend_rate IS NULL THEN NULL
                ELSE jsonb_build_object('weekendRate', source.weekend_rate)
            END,
            p_sync_by,
            p_sync_by
        FROM rate_data AS source
        WHERE COALESCE(source.is_active, TRUE) = TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM rates AS existing
              WHERE existing.tenant_id = p_tenant_id
                AND existing.property_id = source.property_id
                AND existing.rate_code = source.rate_code
                AND existing.deleted_at IS NULL
          )
        RETURNING
            id AS rate_id,
            rate_code,
            rate_name,
            base_rate,
            'INSERTED'::VARCHAR(10) AS action
    )
    SELECT * FROM updated_active
    UNION ALL
    SELECT * FROM updated_inactive
    UNION ALL
    SELECT * FROM inserted;
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
    rate_code VARCHAR(50),
    override_rate NUMERIC(10,2),
    action VARCHAR(10)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_override JSONB;
    v_existing_count INTEGER;
BEGIN
    -- Process each override
    FOR v_override IN SELECT * FROM jsonb_array_elements(p_overrides)
    LOOP
        -- Update room_availability with rate override
        INSERT INTO availability.room_availability (
            tenant_id,
            property_id,
            room_type_id,
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
            (v_override->>'date')::DATE,
            (v_override->>'rate')::NUMERIC(10,2),
            (v_override->>'min_stay')::INTEGER,
            (v_override->>'max_stay')::INTEGER,
            COALESCE((v_override->>'is_closed')::BOOLEAN, FALSE),
            p_sync_by,
            p_sync_by
        )
        ON CONFLICT (property_id, room_type_id, availability_date)
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
        rate_code := v_override->>'rate_code';
        override_rate := (v_override->>'rate')::NUMERIC(10,2);
        action := CASE WHEN v_existing_count = 1 THEN 'INSERTED' ELSE 'UPDATED' END;

        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION sync_daily_rate_overrides IS
'Sets date-specific rate overrides for holidays, events, or special occasions using ON CONFLICT.';

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
