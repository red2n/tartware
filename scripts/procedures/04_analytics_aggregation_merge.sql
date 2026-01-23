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
            SUM(ra.total_rooms) AS total_rooms,
            SUM(ra.reserved_rooms) AS occupied_rooms,
            CASE
                WHEN SUM(ra.total_rooms) > 0
                THEN (SUM(ra.reserved_rooms)::NUMERIC / SUM(ra.total_rooms) * 100)
                ELSE 0
            END AS occupancy_rate
        FROM availability.room_availability ra
        WHERE ra.tenant_id = p_tenant_id
          AND (p_property_id IS NULL OR ra.property_id = p_property_id)
          AND ra.availability_date = p_metric_date
        GROUP BY ra.tenant_id, ra.property_id
    ),
    metric_source AS (
        SELECT
            ds.tenant_id,
            ds.property_id,
            p_metric_date AS metric_date,
            'BOOKING_COUNT'::metric_type AS metric_type,
            'Booking Count'::VARCHAR(100) AS metric_name,
            'BOOKING_COUNT'::VARCHAR(50) AS metric_code,
            ds.booking_count::NUMERIC(15,4) AS metric_value,
            'count'::VARCHAR(50) AS metric_unit
        FROM daily_stats ds
        UNION ALL
        SELECT
            ds.tenant_id,
            ds.property_id,
            p_metric_date,
            'TOTAL_REVENUE'::metric_type,
            'Total Revenue',
            'TOTAL_REVENUE',
            COALESCE(ds.total_revenue, 0)::NUMERIC(15,4),
            'currency'
        FROM daily_stats ds
        UNION ALL
        SELECT
            ds.tenant_id,
            ds.property_id,
            p_metric_date,
            'LENGTH_OF_STAY'::metric_type,
            'Average Length of Stay',
            'AVG_LENGTH_OF_STAY',
            COALESCE(ds.avg_length_of_stay, 0)::NUMERIC(15,4),
            'days'
        FROM daily_stats ds
        UNION ALL
        SELECT
            ds.tenant_id,
            ds.property_id,
            p_metric_date,
            'CANCELLATION_RATE'::metric_type,
            'Cancellation Rate',
            'CANCELLATION_RATE',
            CASE
                WHEN ds.booking_count > 0
                THEN (ds.cancelled_bookings::NUMERIC / ds.booking_count * 100)
                ELSE 0
            END::NUMERIC(15,4),
            'percent'
        FROM daily_stats ds
        UNION ALL
        SELECT
            os.tenant_id,
            os.property_id,
            p_metric_date,
            'OCCUPANCY_RATE'::metric_type,
            'Occupancy Rate',
            'OCCUPANCY_RATE',
            COALESCE(os.occupancy_rate, 0)::NUMERIC(15,4),
            'percent'
        FROM occupancy_stats os
        UNION ALL
        SELECT
            os.tenant_id,
            os.property_id,
            p_metric_date,
            'ADR'::metric_type,
            'Average Daily Rate',
            'ADR',
            CASE
                WHEN os.occupied_rooms > 0
                THEN (ds.total_revenue / os.occupied_rooms)
                ELSE 0
            END::NUMERIC(15,4),
            'currency'
        FROM occupancy_stats os
        JOIN daily_stats ds
            ON ds.tenant_id = os.tenant_id
           AND ds.property_id = os.property_id
        UNION ALL
        SELECT
            os.tenant_id,
            os.property_id,
            p_metric_date,
            'REVPAR'::metric_type,
            'Revenue Per Available Room',
            'REVPAR',
            CASE
                WHEN os.total_rooms > 0
                THEN (ds.total_revenue / os.total_rooms)
                ELSE 0
            END::NUMERIC(15,4),
            'currency'
        FROM occupancy_stats os
        JOIN daily_stats ds
            ON ds.tenant_id = os.tenant_id
           AND ds.property_id = os.property_id
    ),
    updated AS (
        UPDATE analytics_metrics AS target
        SET
            metric_value = source.metric_value,
            metric_name = source.metric_name,
            metric_code = source.metric_code,
            metric_unit = source.metric_unit,
            updated_at = CURRENT_TIMESTAMP
        FROM metric_source AS source
        WHERE target.tenant_id = source.tenant_id
          AND target.property_id = source.property_id
          AND target.metric_type = source.metric_type
          AND target.metric_date = source.metric_date
          AND target.time_granularity = 'DAILY'
        RETURNING
            target.metric_type::VARCHAR(50) AS metric_type,
            target.metric_value::NUMERIC(12,2) AS metric_value,
            'UPDATED'::VARCHAR(10) AS action
    ),
    inserted AS (
        INSERT INTO analytics_metrics (
            tenant_id,
            property_id,
            metric_type,
            metric_name,
            metric_code,
            metric_date,
            time_granularity,
            metric_value,
            metric_unit,
            status,
            calculated_at
        )
        SELECT
            source.tenant_id,
            source.property_id,
            source.metric_type,
            source.metric_name,
            source.metric_code,
            source.metric_date,
            'DAILY',
            source.metric_value,
            source.metric_unit,
            'COMPLETED',
            CURRENT_TIMESTAMP
        FROM metric_source AS source
        WHERE NOT EXISTS (
            SELECT 1
            FROM analytics_metrics AS existing
            WHERE existing.tenant_id = source.tenant_id
              AND existing.property_id = source.property_id
              AND existing.metric_type = source.metric_type
              AND existing.metric_date = source.metric_date
              AND existing.time_granularity = 'DAILY'
        )
        RETURNING
            metric_type::VARCHAR(50) AS metric_type,
            metric_value::NUMERIC(12,2) AS metric_value,
            'INSERTED'::VARCHAR(10) AS action
    )
    SELECT * FROM updated
    UNION ALL
    SELECT * FROM inserted;
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
                WHEN m.metric_type IN ('BOOKING_COUNT', 'TOTAL_REVENUE')
                THEN SUM(m.metric_value)
                -- Average metrics
                WHEN m.metric_type IN ('OCCUPANCY_RATE', 'ADR', 'REVPAR', 'CANCELLATION_RATE', 'LENGTH_OF_STAY')
                THEN AVG(m.metric_value)
                ELSE SUM(m.metric_value)
            END AS metric_value,
            MAX(m.metric_name) AS metric_name,
            MAX(m.metric_code) AS metric_code,
            MAX(m.metric_unit) AS metric_unit
        FROM analytics_metrics m
        WHERE m.tenant_id = p_tenant_id
          AND (p_property_id IS NULL OR m.property_id = p_property_id)
          AND m.time_granularity = 'DAILY'
          AND m.metric_date BETWEEN v_period_start AND v_period_end
        GROUP BY m.tenant_id, m.property_id, m.metric_type
    ),
    updated AS (
        UPDATE analytics_metrics AS target
        SET
            metric_value = source.metric_value,
            metric_name = source.metric_name,
            metric_code = source.metric_code,
            metric_unit = source.metric_unit,
            updated_at = CURRENT_TIMESTAMP
        FROM monthly_aggregates AS source
        WHERE target.tenant_id = source.tenant_id
          AND target.property_id = source.property_id
          AND target.metric_type = source.metric_type
          AND target.metric_date = v_period_start
          AND target.time_granularity = 'MONTHLY'
        RETURNING
            target.metric_type::VARCHAR(50) AS metric_type,
            target.metric_value::NUMERIC(12,2) AS metric_value,
            'UPDATED'::VARCHAR(10) AS action
    ),
    inserted AS (
        INSERT INTO analytics_metrics (
            tenant_id,
            property_id,
            metric_type,
            metric_name,
            metric_code,
            metric_date,
            time_granularity,
            metric_value,
            metric_unit,
            status,
            calculated_at
        )
        SELECT
            source.tenant_id,
            source.property_id,
            source.metric_type,
            source.metric_name,
            source.metric_code,
            v_period_start,
            'MONTHLY',
            source.metric_value,
            source.metric_unit,
            'COMPLETED',
            CURRENT_TIMESTAMP
        FROM monthly_aggregates AS source
        WHERE NOT EXISTS (
            SELECT 1
            FROM analytics_metrics AS existing
            WHERE existing.tenant_id = source.tenant_id
              AND existing.property_id = source.property_id
              AND existing.metric_type = source.metric_type
              AND existing.metric_date = v_period_start
              AND existing.time_granularity = 'MONTHLY'
        )
        RETURNING
            metric_type::VARCHAR(50) AS metric_type,
            metric_value::NUMERIC(12,2) AS metric_value,
            'INSERTED'::VARCHAR(10) AS action
    )
    SELECT * FROM updated
    UNION ALL
    SELECT * FROM inserted;
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
    ),
    room_type_totals AS (
        SELECT
            tenant_id,
            property_id,
            SUM(booking_count) AS total_bookings
        FROM room_type_metrics
        GROUP BY tenant_id, property_id
    ),
    existing_parent AS (
        SELECT DISTINCT ON (tenant_id, property_id)
            id,
            tenant_id,
            property_id
        FROM analytics_metrics
        WHERE tenant_id = p_tenant_id
          AND (p_property_id IS NULL OR property_id = p_property_id)
          AND metric_code = 'BOOKINGS_BY_ROOM_TYPE'
          AND metric_date = p_metric_date
          AND time_granularity = 'DAILY'
        ORDER BY tenant_id, property_id, calculated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ),
    inserted_parent AS (
        INSERT INTO analytics_metrics (
            tenant_id,
            property_id,
            metric_type,
            metric_name,
            metric_code,
            metric_date,
            time_granularity,
            metric_value,
            metric_unit,
            status,
            calculated_at
        )
        SELECT
            totals.tenant_id,
            totals.property_id,
            'BOOKING_COUNT'::metric_type,
            'Bookings by Room Type'::VARCHAR(100),
            'BOOKINGS_BY_ROOM_TYPE'::VARCHAR(50),
            p_metric_date,
            'DAILY',
            totals.total_bookings::NUMERIC(15,4),
            'count',
            'COMPLETED',
            CURRENT_TIMESTAMP
        FROM room_type_totals AS totals
        WHERE NOT EXISTS (
            SELECT 1
            FROM analytics_metrics AS existing
            WHERE existing.tenant_id = totals.tenant_id
              AND existing.property_id = totals.property_id
              AND existing.metric_code = 'BOOKINGS_BY_ROOM_TYPE'
              AND existing.metric_date = p_metric_date
              AND existing.time_granularity = 'DAILY'
        )
        RETURNING id, tenant_id, property_id
    ),
    parent_metrics AS (
        SELECT * FROM existing_parent
        UNION ALL
        SELECT * FROM inserted_parent
    ),
    dimension_source AS (
        SELECT
            pm.id AS metric_id,
            rtm.tenant_id,
            'ROOM_TYPE'::VARCHAR(50) AS dimension_type,
            rtm.room_type_id::VARCHAR(100) AS dimension_key,
            rtm.room_type_name AS dimension_value,
            rtm.booking_count::NUMERIC(15,4) AS metric_value,
            CASE
                WHEN totals.total_bookings > 0
                THEN (rtm.booking_count::NUMERIC / totals.total_bookings * 100)
                ELSE 0
            END::NUMERIC(5,2) AS percentage_of_total,
            DENSE_RANK() OVER (
                PARTITION BY rtm.tenant_id, rtm.property_id
                ORDER BY rtm.booking_count DESC
            ) AS rank_position,
            jsonb_build_object(
                'revenue', rtm.revenue,
                'avg_rate', rtm.avg_rate
            ) AS metadata
        FROM room_type_metrics rtm
        JOIN room_type_totals totals
            ON totals.tenant_id = rtm.tenant_id
           AND totals.property_id = rtm.property_id
        JOIN parent_metrics pm
            ON pm.tenant_id = rtm.tenant_id
           AND pm.property_id = rtm.property_id
    ),
    updated AS (
        UPDATE analytics_metric_dimensions AS target
        SET
            metric_value = source.metric_value,
            percentage_of_total = source.percentage_of_total,
            rank_position = source.rank_position,
            metadata = source.metadata,
            updated_by = p_updated_by,
            version = target.version + 1
        FROM dimension_source AS source
        WHERE target.metric_id = source.metric_id
          AND target.dimension_type = source.dimension_type
          AND target.dimension_key = source.dimension_key
          AND target.dimension_value = source.dimension_value
        RETURNING
            target.dimension_type,
            target.dimension_value,
            target.metric_value::INTEGER AS metric_count,
            'UPDATED'::VARCHAR(10) AS action
    ),
    inserted AS (
        INSERT INTO analytics_metric_dimensions (
            metric_id,
            tenant_id,
            dimension_type,
            dimension_key,
            dimension_value,
            metric_value,
            percentage_of_total,
            rank_position,
            metadata,
            created_by,
            updated_by
        )
        SELECT
            source.metric_id,
            source.tenant_id,
            source.dimension_type,
            source.dimension_key,
            source.dimension_value,
            source.metric_value,
            source.percentage_of_total,
            source.rank_position,
            source.metadata,
            p_updated_by,
            p_updated_by
        FROM dimension_source AS source
        WHERE NOT EXISTS (
            SELECT 1
            FROM analytics_metric_dimensions AS existing
            WHERE existing.metric_id = source.metric_id
              AND existing.dimension_type = source.dimension_type
              AND existing.dimension_key = source.dimension_key
              AND existing.dimension_value = source.dimension_value
        )
        RETURNING
            dimension_type,
            dimension_value,
            metric_value::INTEGER AS metric_count,
            'INSERTED'::VARCHAR(10) AS action
    )
    SELECT * FROM updated
    UNION ALL
    SELECT * FROM inserted;
END;
$$;

COMMENT ON FUNCTION sync_metric_dimensions IS
'Stores dimensional breakdowns (by room type, rate, etc.) using MERGE.';

\echo '✓ Analytics aggregation procedures created successfully!'
