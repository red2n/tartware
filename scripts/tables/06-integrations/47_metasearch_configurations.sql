-- =====================================================
-- 47_metasearch_configurations.sql
-- Metasearch platform configuration and bid management
-- Industry Standard: Google Hotel Ads, TripAdvisor, Kayak, Trivago
-- Pattern: Configuration table per property/channel
-- Date: 2025-06-14
-- =====================================================

-- =====================================================
-- METASEARCH_CONFIGURATIONS TABLE
-- CPC/CPA bid strategy and budget management
-- =====================================================

CREATE TABLE IF NOT EXISTS metasearch_configurations (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),          -- Unique configuration identifier
    tenant_id UUID NOT NULL,                                        -- Owning tenant
    property_id UUID NOT NULL,                                      -- Property this config applies to

    -- Platform
    platform VARCHAR(100) NOT NULL CHECK (platform IN (
        'google_hotel_ads', 'tripadvisor', 'kayak', 'trivago',
        'skyscanner', 'wego', 'bing_hotel_ads', 'other'
    )),                                                             -- Metasearch platform name
    platform_account_id VARCHAR(200),                               -- Account ID on the platform
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                        -- Enable/disable this configuration

    -- Bid Strategy
    bid_strategy VARCHAR(50) NOT NULL DEFAULT 'manual_cpc' CHECK (bid_strategy IN (
        'manual_cpc', 'auto_cpc', 'target_roas', 'cpa', 'commission'
    )),                                                             -- Bidding strategy type

    -- CPC Settings
    max_cpc DECIMAL(10,2),                                          -- Maximum cost-per-click bid (currency)
    default_cpc DECIMAL(10,2),                                      -- Default CPC when no specific bid set
    cpc_multipliers JSONB DEFAULT '{}'::jsonb,                      -- Device/market/date multipliers

    -- CPA Settings
    target_cpa DECIMAL(10,2),                                       -- Target cost-per-acquisition
    cpa_commission_percent DECIMAL(5,2),                             -- Commission percentage for CPA model

    -- Budget
    budget_daily DECIMAL(10,2),                                     -- Daily budget cap (currency)
    budget_monthly DECIMAL(12,2),                                   -- Monthly budget cap (currency)
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',                     -- Budget/bid currency

    -- Rate Feed
    rate_feed_url TEXT,                                              -- URL of rate feed for the platform
    rate_feed_format VARCHAR(50),                                   -- Feed format (xml, json, csv)
    rate_feed_frequency VARCHAR(50) DEFAULT 'hourly',               -- How often feed is pushed/pulled

    -- Performance Targets
    target_roas DECIMAL(8,2),                                       -- Target return on ad spend
    min_booking_value DECIMAL(10,2),                                -- Minimum booking value to bid on

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- Extension metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- Row creation
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- Row last update
    created_by UUID,                                                -- Creator
    updated_by UUID                                                 -- Last updater
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metasearch_configurations_property_platform
    ON metasearch_configurations (tenant_id, property_id, platform)
    WHERE is_active = TRUE;

COMMENT ON TABLE metasearch_configurations IS 'Metasearch platform bid strategy and budget configuration. Supports CPC, CPA, and commission-based models for Google Hotel Ads, TripAdvisor, etc.';
COMMENT ON COLUMN metasearch_configurations.bid_strategy IS 'Bidding strategy: manual_cpc (fixed bids), auto_cpc (algorithmic), target_roas (return-optimized), cpa (cost-per-acquisition), commission (percentage of booking)';
COMMENT ON COLUMN metasearch_configurations.max_cpc IS 'Maximum cost-per-click bid in the configured currency';
COMMENT ON COLUMN metasearch_configurations.budget_daily IS 'Daily spend cap across all bids for this platform/property';
COMMENT ON COLUMN metasearch_configurations.cpc_multipliers IS 'JSON bid multipliers by device (mobile: 1.2), market (us: 1.5), date range';

\echo 'metasearch_configurations table created successfully!'
