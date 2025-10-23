-- =====================================================
-- 52_competitor_rates_indexes.sql
-- Competitor Rates Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating competitor_rates indexes...'

CREATE INDEX idx_competitor_rates_tenant ON competitor_rates(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_property ON competitor_rates(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_competitor ON competitor_rates(competitor_property_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_check_date ON competitor_rates(check_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_stay_date ON competitor_rates(stay_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_source ON competitor_rates(source_channel) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_scrape_timestamp ON competitor_rates(scrape_timestamp DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_availability ON competitor_rates(is_available, availability_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_price_position ON competitor_rates(price_position) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_cheaper ON competitor_rates(is_cheaper_than_us) WHERE is_cheaper_than_us = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_alert ON competitor_rates(alert_triggered) WHERE alert_triggered = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_special_offer ON competitor_rates(has_special_offer) WHERE has_special_offer = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_verification ON competitor_rates(needs_verification) WHERE needs_verification = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_distance ON competitor_rates(distance_from_our_property_km) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_rating ON competitor_rates(review_rating DESC) WHERE review_rating IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_raw_data ON competitor_rates USING gin(raw_data) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_metadata ON competitor_rates USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_tags ON competitor_rates USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_property_date ON competitor_rates(property_id, stay_date, check_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_property_competitor ON competitor_rates(property_id, competitor_property_name, stay_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_stay_comparison ON competitor_rates(stay_date, property_id, competitor_rate) WHERE is_available = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_competitor_rates_market_analysis ON competitor_rates(property_id, stay_date, price_position, competitor_rate) WHERE is_deleted = FALSE;

\echo 'Competitor Rates indexes created successfully!'
