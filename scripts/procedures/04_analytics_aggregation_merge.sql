-- =====================================================
-- 04_analytics_aggregation_merge.sql
-- Analytics and Reporting with MERGE
-- Efficient daily/monthly aggregations
-- Date: 2025-10-15
-- Requires: PostgreSQL 15+
-- =====================================================

\c tartware

\echo 'Creating analytics aggregation procedures...'

-- =====================================================
-- Function: aggregate_daily_metrics
-- Purpose: Calculate and store daily performance metrics
-- Uses: MERGE for efficient metric upserts
-- =====================================================

CREATE OR REPLACE FUNCTION aggregate_daily_metrics(
    p_tenant_id UUID,
    p_property_id UUID DEFAULT NULL,
    p_metric_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day',
    p_updated_by VARCHAR(100) DEFAULT 'ANALYTICS_JOB'
)
RETURNS TABLE (
    metric_type VARCHAR(50),
    metric_value NUMERIC(12,2),
    action VARCHAR(10)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH daily_stats AS (
        SELECT
            r.tenant_id,
            r.property_id,
            p_metric_date AS metric_date,
            COUNT(*) AS booking_count,
            COUNT(*) FILTER (WHERE r.status = 'CONFIRMED') AS confirmed_bookings,
            COUNT(*) FILTER (WHERE r.status = 'CANCELLED') AS cancelled_bookings,
            AVG(r.total_amount) AS avg_booking_value,
            SUM(r.total_amount) AS total_revenue,
            AVG(r.check_out_date - r.check_in_date) AS avg_length_of_stay,
            SUM(r.number_of_guests) AS total_guests,
            COUNT(DISTINCT r.guest_id) AS unique_guests
        FROM reservations r
        WHERE r.tenant_id = p_tenant_id
          AND (p_property_id IS NULL OR r.property_id = p_property_id)
          AND DATE(r.created_at) = p_metric_date
          AND r.deleted_at IS NULL
        GROUP BY r.tenant_id, r.property_id
    ),
    occupancy_stats AS (
        SELECT
            ra.tenant_id,
            ra.property_id,
            p_metric_date AS metric_date,
            SUM(ra.available_rooms) AS total_rooms,
            SUM(ra.booked_rooms) AS occupied_rooms,
            CASE
                WHEN SUM(ra.available_rooms) > 0
                THEN (SUM(ra.booked_rooms)::NUMERIC / SUM(ra.available_rooms) * 100)
                ELSE 0
            END AS occupancy_rate
        FROM availability.room_availability ra
        WHERE ra.tenant_id = p_tenant_id
          AND (p_property_id IS NULL OR ra.property_id = p_property_id)
          AND ra.availability_date = p_metric_date
        GROUP BY ra.tenant_id, ra.property_id
    )
    -- Merge booking metrics
    MERGE INTO analytics_metrics AS target
    USING (
        SELECT * FROM daily_stats
        CROSS JOIN LATERAL (
            VALUES
                ('BOOKING_COUNT', booking_count),
                ('CONFIRMED_BOOKINGS', confirmed_bookings),
                ('CANCELLED_BOOKINGS', cancelled_bookings),
                ('AVG_BOOKING_VALUE', avg_booking_value),
                ('TOTAL_REVENUE', total_revenue),
                ('AVG_LENGTH_OF_STAY', avg_length_of_stay),
                ('TOTAL_GUESTS', total_guests),
                ('UNIQUE_GUESTS', unique_guests)
        ) AS metrics(metric_name, metric_val)
    ) AS source
    ON (
        target.tenant_id = source.tenant_id
        AND (target.property_id = source.property_id OR (target.property_id IS NULL AND source.property_id IS NULL))
        AND target.period_start = source.metric_date
        AND target.metric_type = source.metric_name
        AND target.granularity = 'DAILY'
    )
    WHEN MATCHED THEN
        UPDATE SET
            metric_value = source.metric_val,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_updated_by
    WHEN NOT MATCHED THEN
        INSERT (
            tenant_id,
            property_id,
            metric_type,
            metric_value,
            period_start,
            period_end,
            granularity,
            created_by,
            updated_by
        )
        VALUES (
            source.tenant_id,
            source.property_id,
            source.metric_name,
            source.metric_val,
            source.metric_date,
            source.metric_date,
            'DAILY',
            p_updated_by,
            p_updated_by
        )
    RETURNING
        target.metric_type,
        target.metric_value,
        CASE
            WHEN xmax = 0 THEN 'INSERTED'
            ELSE 'UPDATED'
        END AS action;

    -- Also merge occupancy metrics
    RETURN QUERY
    MERGE INTO analytics_metrics AS target
    USING (
        SELECT * FROM occupancy_stats
        CROSS JOIN LATERAL (
            VALUES
                ('TOTAL_ROOMS', total_rooms),
                ('OCCUPIED_ROOMS', occupied_rooms),
                ('OCCUPANCY_RATE', occupancy_rate)
        ) AS metrics(metric_name, metric_val)
    ) AS source
    ON (
        target.tenant_id = source.tenant_id
        AND (target.property_id = source.property_id OR (target.property_id IS NULL AND source.property_id IS NULL))
        AND target.period_start = source.metric_date
        AND target.metric_type = source.metric_name
        AND target.granularity = 'DAILY'
    )
    WHEN MATCHED THEN
        UPDATE SET
            metric_value = source.metric_val,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_updated_by
    WHEN NOT MATCHED THEN
        INSERT (
            tenant_id,
            property_id,
            metric_type,
            metric_value,
            period_start,
            period_end,
            granularity,
            created_by,
            updated_by
        )
        VALUES (
            source.tenant_id,
            source.property_id,
            source.metric_name,
            source.metric_val,
            source.metric_date,
            source.metric_date,
            'DAILY',
            p_updated_by,
            p_updated_by
        )
    RETURNING
        target.metric_type,
        target.metric_value,
        CASE
            WHEN xmax = 0 THEN 'INSERTED'
            ELSE 'UPDATED'
        END AS action;
END;
$$;

COMMENT ON FUNCTION aggregate_daily_metrics IS
'Calculates and stores daily performance metrics using MERGE. Run nightly for previous day.';

-- =====================================================
-- Function: aggregate_monthly_metrics
-- Purpose: Roll up daily metrics into monthly summaries
-- Uses: MERGE for efficient monthly aggregations
-- =====================================================

CREATE OR REPLACE FUNCTION aggregate_monthly_metrics(
    p_tenant_id UUID,
    p_property_id UUID DEFAULT NULL,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE) - 1,
    p_updated_by VARCHAR(100) DEFAULT 'ANALYTICS_JOB'
)
RETURNS TABLE (
    metric_type VARCHAR(50),
    metric_value NUMERIC(12,2),
    action VARCHAR(10)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    -- Calculate period boundaries
    v_period_start := DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1));
    v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    RETURN QUERY
    WITH monthly_aggregates AS (
        SELECT
            m.tenant_id,
            m.property_id,
            m.metric_type,
            CASE
                -- Sum metrics
                WHEN m.metric_type IN ('BOOKING_COUNT', 'CONFIRMED_BOOKINGS', 'CANCELLED_BOOKINGS',
                                      'TOTAL_REVENUE', 'TOTAL_GUESTS', 'UNIQUE_GUESTS',
                                      'TOTAL_ROOMS', 'OCCUPIED_ROOMS')
                THEN SUM(m.metric_value)
                -- Average metrics
                WHEN m.metric_type IN ('AVG_BOOKING_VALUE', 'AVG_LENGTH_OF_STAY', 'OCCUPANCY_RATE')
                THEN AVG(m.metric_value)
                ELSE SUM(m.metric_value)
            END AS metric_value
        FROM analytics_metrics m
        WHERE m.tenant_id = p_tenant_id
          AND (p_property_id IS NULL OR m.property_id = p_property_id)
          AND m.granularity = 'DAILY'
          AND m.period_start BETWEEN v_period_start AND v_period_end
        GROUP BY m.tenant_id, m.property_id, m.metric_type
    )
    MERGE INTO analytics_metrics AS target
    USING monthly_aggregates AS source
    ON (
        target.tenant_id = source.tenant_id
        AND (target.property_id = source.property_id OR (target.property_id IS NULL AND source.property_id IS NULL))
        AND target.period_start = v_period_start
        AND target.metric_type = source.metric_type
        AND target.granularity = 'MONTHLY'
    )
    WHEN MATCHED THEN
        UPDATE SET
            metric_value = source.metric_value,
            period_end = v_period_end,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_updated_by
    WHEN NOT MATCHED THEN
        INSERT (
            tenant_id,
            property_id,
            metric_type,
            metric_value,
            period_start,
            period_end,
            granularity,
            created_by,
            updated_by
        )
        VALUES (
            source.tenant_id,
            source.property_id,
            source.metric_type,
            source.metric_value,
            v_period_start,
            v_period_end,
            'MONTHLY',
            p_updated_by,
            p_updated_by
        )
    RETURNING
        target.metric_type,
        target.metric_value,
        CASE
            WHEN xmax = 0 THEN 'INSERTED'
            ELSE 'UPDATED'
        END AS action;
END;
$$;

COMMENT ON FUNCTION aggregate_monthly_metrics IS
'Aggregates daily metrics into monthly summaries using MERGE. Run at month end.';

-- =====================================================
-- Function: calculate_revenue_metrics
-- Purpose: Calculate detailed revenue breakdown by source
-- Uses: MERGE for revenue analytics
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_revenue_metrics(
    p_tenant_id UUID,
    p_property_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_updated_by VARCHAR(100) DEFAULT 'ANALYTICS_JOB'
)
RETURNS TABLE (
    booking_source VARCHAR(50),
    revenue NUMERIC(12,2),
    booking_count INTEGER,
    avg_booking_value NUMERIC(12,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH revenue_by_source AS (
        SELECT
            r.tenant_id,
            r.property_id,
            r.booking_source::TEXT AS source,
            SUM(r.total_amount) AS total_revenue,
            COUNT(*) AS total_bookings,
            AVG(r.total_amount) AS avg_value
        FROM reservations r
        WHERE r.tenant_id = p_tenant_id
          AND (p_property_id IS NULL OR r.property_id = p_property_id)
          AND r.created_at::DATE BETWEEN p_start_date AND p_end_date
          AND r.deleted_at IS NULL
          AND r.status != 'CANCELLED'
        GROUP BY r.tenant_id, r.property_id, r.booking_source
    )
    SELECT
        rbs.source AS booking_source,
        rbs.total_revenue AS revenue,
        rbs.total_bookings AS booking_count,
        rbs.avg_value AS avg_booking_value
    FROM revenue_by_source rbs
    ORDER BY rbs.total_revenue DESC;
END;
$$;

COMMENT ON FUNCTION calculate_revenue_metrics IS
'Calculates revenue breakdown by booking source for a date range.';

-- =====================================================
-- Function: sync_metric_dimensions
-- Purpose: Store dimensional breakdowns (by room type, rate, etc.)
-- Uses: MERGE for dimensional analytics
-- =====================================================

CREATE OR REPLACE FUNCTION sync_metric_dimensions(
    p_tenant_id UUID,
    p_property_id UUID DEFAULT NULL,
    p_metric_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day',
    p_updated_by VARCHAR(100) DEFAULT 'ANALYTICS_JOB'
)
RETURNS TABLE (
    dimension_type VARCHAR(50),
    dimension_value VARCHAR(255),
    metric_count INTEGER,
    action VARCHAR(10)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH room_type_metrics AS (
        SELECT
            r.tenant_id,
            r.property_id,
            rt.id AS room_type_id,
            rt.room_type_name,
            COUNT(*) AS booking_count,
            SUM(r.total_amount) AS revenue,
            AVG(r.total_amount) AS avg_rate
        FROM reservations r
        JOIN room_types rt ON r.room_type_id = rt.id
        WHERE r.tenant_id = p_tenant_id
          AND (p_property_id IS NULL OR r.property_id = p_property_id)
          AND DATE(r.created_at) = p_metric_date
          AND r.deleted_at IS NULL
        GROUP BY r.tenant_id, r.property_id, rt.id, rt.room_type_name
    )
    -- First, get or create the parent metric
    , parent_metrics AS (
        INSERT INTO analytics_metrics (
            tenant_id,
            property_id,
            metric_type,
            metric_value,
            period_start,
            period_end,
            granularity,
            created_by,
            updated_by
        )
        SELECT
            tenant_id,
            property_id,
            'BOOKINGS_BY_ROOM_TYPE',
            booking_count,
            p_metric_date,
            p_metric_date,
            'DAILY',
            p_updated_by,
            p_updated_by
        FROM room_type_metrics
        ON CONFLICT DO NOTHING
        RETURNING id, tenant_id, property_id
    )
    -- Then merge dimensions
    MERGE INTO analytics_metric_dimensions AS target
    USING (
        SELECT
            pm.id AS metric_id,
            rtm.tenant_id,
            'ROOM_TYPE' AS dimension_type,
            rtm.room_type_name AS dimension_value,
            rtm.booking_count AS dimension_metric_value,
            jsonb_build_object(
                'revenue', rtm.revenue,
                'avg_rate', rtm.avg_rate,
                'room_type_id', rtm.room_type_id
            ) AS dimension_metadata
        FROM room_type_metrics rtm
        JOIN parent_metrics pm ON rtm.tenant_id = pm.tenant_id
                              AND (rtm.property_id = pm.property_id OR (rtm.property_id IS NULL AND pm.property_id IS NULL))
    ) AS source
    ON (
        target.metric_id = source.metric_id
        AND target.dimension_type = source.dimension_type
        AND target.dimension_value = source.dimension_value
    )
    WHEN MATCHED THEN
        UPDATE SET
            dimension_metric_value = source.dimension_metric_value,
            dimension_metadata = source.dimension_metadata,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = p_updated_by
    WHEN NOT MATCHED THEN
        INSERT (
            tenant_id,
            metric_id,
            dimension_type,
            dimension_value,
            dimension_metric_value,
            dimension_metadata,
            created_by,
            updated_by
        )
        VALUES (
            source.tenant_id,
            source.metric_id,
            source.dimension_type,
            source.dimension_value,
            source.dimension_metric_value,
            source.dimension_metadata,
            p_updated_by,
            p_updated_by
        )
    RETURNING
        target.dimension_type,
        target.dimension_value,
        target.dimension_metric_value::INTEGER AS metric_count,
        CASE
            WHEN xmax = 0 THEN 'INSERTED'
            ELSE 'UPDATED'
        END AS action;
END;
$$;

COMMENT ON FUNCTION sync_metric_dimensions IS
'Stores dimensional breakdowns (by room type, rate, etc.) using MERGE.';

\echo '✓ Analytics aggregation procedures created successfully!'
