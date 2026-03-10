-- =====================================================
-- Competitor Properties (Comp Set Configuration) Table
-- =====================================================
-- Purpose: Define the competitive set for a property — which competitor
--          properties to track, with weighting by star rating, location,
--          and market segment relevance.
-- Industry Standard: STR-style comp sets of 5-8 properties; used by
--   Oracle OPERA, IDeaS, Duetto, OTA Insight for rate shopping and
--   benchmarking (ARI, MPI, RGI indices).
-- =====================================================

CREATE TABLE IF NOT EXISTS competitor_properties (
    -- Primary Key
    competitor_property_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,                     -- Our property this comp set belongs to

    -- Competitor Identity
    competitor_name VARCHAR(255) NOT NULL,          -- Display name of the competitor
    competitor_external_id VARCHAR(100),            -- External ID from rate shopping vendor
    competitor_brand VARCHAR(100),                  -- Chain/brand (Hilton, Marriott, IHG, etc.)
    competitor_address VARCHAR(500),                -- Physical address for proximity calc
    competitor_city VARCHAR(100),                   -- City
    competitor_country VARCHAR(3),                  -- ISO country code
    competitor_star_rating DECIMAL(2, 1),           -- Star classification (1.0-5.0)
    competitor_total_rooms INTEGER,                 -- Room count for size comparison
    competitor_url VARCHAR(500),                    -- Website or OTA listing URL

    -- Comp Set Configuration
    weight DECIMAL(5, 2) DEFAULT 1.00 NOT NULL,    -- Weighting factor (higher = more influence)
    relevance_score DECIMAL(5, 2),                 -- Computed relevance to our property (0-100)
    distance_km DECIMAL(8, 2),                     -- Distance from our property in km
    market_segment VARCHAR(50),                    -- Primary market segment alignment
    rate_shopping_source VARCHAR(100),             -- Rate shopping vendor (RateGain, OTA Insight, Fornova)

    -- Status & Ordering
    is_primary BOOLEAN DEFAULT false,              -- Is this a primary competitor?
    is_active BOOLEAN DEFAULT true,                -- Active in comp set?
    sort_order INTEGER DEFAULT 0,                  -- Display ordering

    -- Metadata
    metadata JSONB,
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competitor_properties_tenant_property
    ON competitor_properties (tenant_id, property_id)
    WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_competitor_properties_active
    ON competitor_properties (tenant_id, property_id, is_active)
    WHERE COALESCE(is_deleted, false) = false AND is_active = true;

-- Comments
COMMENT ON TABLE competitor_properties IS 'Competitive set configuration — which competitor properties to track for rate shopping and STR-style benchmarking';
COMMENT ON COLUMN competitor_properties.weight IS 'Weighting factor for benchmarking calculations (1.00 = equal weight; higher = more influence)';
COMMENT ON COLUMN competitor_properties.relevance_score IS 'Computed relevance score based on star rating, distance, room count similarity (0-100)';
COMMENT ON COLUMN competitor_properties.is_primary IS 'Primary competitors have higher visibility in dashboards and alerts';

\echo 'competitor_properties table created successfully!'
