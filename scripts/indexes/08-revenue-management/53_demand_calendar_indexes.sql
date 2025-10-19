-- =====================================================
-- 53_demand_calendar_indexes.sql
-- Demand Calendar Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating demand_calendar indexes...'

CREATE INDEX idx_demand_calendar_tenant ON demand_calendar(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_property ON demand_calendar(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_date ON demand_calendar(calendar_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_day_of_week ON demand_calendar(day_of_week) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_month ON demand_calendar(year_number, month_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_weekend ON demand_calendar(is_weekend) WHERE is_weekend = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_holiday ON demand_calendar(is_holiday) WHERE is_holiday = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_season ON demand_calendar(season) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_demand_level ON demand_calendar(demand_level) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_demand_score ON demand_calendar(demand_score) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_booking_pace ON demand_calendar(booking_pace) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_occupancy ON demand_calendar(occupancy_percent) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_events ON demand_calendar(has_events) WHERE has_events = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_attention ON demand_calendar(requires_attention) WHERE requires_attention = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_pricing_strategy ON demand_calendar(recommended_pricing_strategy) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_events_json ON demand_calendar USING gin(events) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_segment_dist ON demand_calendar USING gin(segment_distribution) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_metadata ON demand_calendar USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_tags ON demand_calendar USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_property_date_range ON demand_calendar(property_id, calendar_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_property_demand ON demand_calendar(property_id, demand_level, calendar_date) WHERE is_deleted = FALSE;
-- Simplified index without CURRENT_DATE (not immutable)
-- Applications can filter by calendar_date >= CURRENT_DATE at query time using this index
CREATE INDEX idx_demand_calendar_future_dates ON demand_calendar(property_id, calendar_date)
WHERE calendar_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_demand_calendar_season_analysis ON demand_calendar(property_id, season, calendar_date) WHERE is_deleted = FALSE;

\echo 'Demand Calendar indexes created successfully!'
