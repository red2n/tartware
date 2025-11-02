-- =====================================================
-- 105_minibar_items.sql
-- Minibar Product Catalog
--
-- Purpose: Master list of minibar products with pricing and inventory
-- Industry Standard: OPERA (MINIBAR_ITEMS), Protel (MINIBAR_ARTIKEL),
--                    RMS (MINIBAR_PRODUCTS), Mews (PRODUCT_CATALOG)
--
-- Use Cases:
-- - Centralized minibar product catalog
-- - Multi-tier pricing (room category, season, promo)
-- - Inventory management and par levels
-- - Automatic folio posting on consumption
-- - Nutritional and allergen information
--
-- Note: This table defines WHAT can be in a minibar
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS minibar_items CASCADE;

CREATE TABLE minibar_items (
    -- Primary Key
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Product Identification
    item_code VARCHAR(50) NOT NULL, -- Internal SKU (e.g., "MB-WATER-500")
    item_name VARCHAR(200) NOT NULL,
    item_description TEXT,
    brand VARCHAR(100),
    manufacturer VARCHAR(100),

    -- Category
    category VARCHAR(50) NOT NULL
        CHECK (category IN (
            'ALCOHOL_SPIRITS', 'ALCOHOL_WINE', 'ALCOHOL_BEER',
            'SOFT_DRINKS', 'JUICE', 'WATER', 'ENERGY_DRINKS',
            'SNACKS', 'CHOCOLATE', 'CANDY', 'NUTS',
            'PERSONAL_CARE', 'OTHER'
        )),
    subcategory VARCHAR(100),

    -- Packaging
    package_size VARCHAR(50), -- "500ml", "50g", "Mini", "Standard"
    unit_of_measure VARCHAR(20) DEFAULT 'EACH', -- EACH, BOTTLE, CAN, PACK
    units_per_package INTEGER DEFAULT 1,

    -- Alcohol Details
    is_alcoholic BOOLEAN DEFAULT FALSE,
    alcohol_content_percent DECIMAL(5, 2),
    requires_age_verification BOOLEAN DEFAULT FALSE,
    minimum_age INTEGER,

    -- Pricing
    base_price DECIMAL(10, 2) NOT NULL,
    cost_price DECIMAL(10, 2), -- Supplier cost
    currency_code CHAR(3) DEFAULT 'USD',
    tax_category VARCHAR(50), -- FOOD, BEVERAGE, ALCOHOL
    tax_rate DECIMAL(5, 2),
    service_charge_applicable BOOLEAN DEFAULT FALSE,

    -- Pricing Tiers (JSONB)
    -- [{ tier_name, min_room_category, markup_percent, fixed_price }]
    pricing_tiers JSONB DEFAULT '[]'::jsonb,

    -- Inventory Management
    track_inventory BOOLEAN DEFAULT TRUE,
    current_stock_quantity INTEGER DEFAULT 0,
    par_level_per_room INTEGER DEFAULT 0, -- Standard quantity per minibar
    reorder_point INTEGER DEFAULT 0,
    reorder_quantity INTEGER DEFAULT 0,
    storage_location VARCHAR(100),

    -- Supplier Information
    supplier_name VARCHAR(200),
    supplier_sku VARCHAR(100),
    supplier_id UUID, -- If linked to suppliers table
    lead_time_days INTEGER,

    -- Product Details
    barcode VARCHAR(50),
    barcode_type VARCHAR(20), -- EAN13, UPC, QR
    image_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    product_url VARCHAR(500), -- External product page

    -- Nutritional Information
    calories INTEGER,
    serving_size VARCHAR(50),
    ingredients TEXT,
    nutritional_info JSONB, -- Detailed nutrition facts

    -- Allergens & Dietary
    contains_allergens BOOLEAN DEFAULT FALSE,
    allergen_list TEXT[], -- ["Peanuts", "Milk", "Gluten"]
    is_vegetarian BOOLEAN DEFAULT FALSE,
    is_vegan BOOLEAN DEFAULT FALSE,
    is_gluten_free BOOLEAN DEFAULT FALSE,
    is_kosher BOOLEAN DEFAULT FALSE,
    is_halal BOOLEAN DEFAULT FALSE,
    dietary_flags JSONB, -- Additional dietary info

    -- Temperature Requirements
    storage_temp_required VARCHAR(50), -- ROOM_TEMP, REFRIGERATED, FROZEN
    min_storage_temp_celsius DECIMAL(5, 2),
    max_storage_temp_celsius DECIMAL(5, 2),

    -- Expiration & Freshness
    shelf_life_days INTEGER,
    expiration_tracking_required BOOLEAN DEFAULT FALSE,

    -- Availability
    is_active BOOLEAN DEFAULT TRUE,
    available_from_date DATE,
    available_to_date DATE,
    seasonal BOOLEAN DEFAULT FALSE,
    season VARCHAR(50), -- SUMMER, WINTER, HOLIDAY

    -- Display & Marketing
    display_order INTEGER DEFAULT 0,
    featured BOOLEAN DEFAULT FALSE,
    promotional_text VARCHAR(200),
    upsell_item BOOLEAN DEFAULT FALSE,
    related_items UUID[], -- Array of related item_ids

    -- Compliance & Legal
    requires_health_warning BOOLEAN DEFAULT FALSE,
    health_warning_text TEXT,
    country_of_origin VARCHAR(100),
    restricted_countries TEXT[], -- Countries where item cannot be sold

    -- Reporting & Analytics
    revenue_category VARCHAR(50), -- For financial reporting
    profit_margin_percent DECIMAL(5, 2),
    popularity_score INTEGER DEFAULT 0, -- Based on consumption frequency

    -- Integration
    pos_item_id VARCHAR(100), -- Link to POS system
    accounting_code VARCHAR(50),
    gl_account VARCHAR(50),

    -- Notes
    internal_notes TEXT,
    supplier_notes TEXT,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT minibar_item_code_unique UNIQUE (tenant_id, property_id, item_code),
    CONSTRAINT minibar_item_price_check CHECK (base_price >= 0),
    CONSTRAINT minibar_item_stock_check CHECK (current_stock_quantity >= 0),
    CONSTRAINT minibar_item_alcohol_check CHECK (
        NOT is_alcoholic OR alcohol_content_percent IS NOT NULL
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE minibar_items IS 'Master catalog of minibar products with pricing and inventory';
COMMENT ON COLUMN minibar_items.item_id IS 'Unique minibar item identifier (UUID)';
COMMENT ON COLUMN minibar_items.item_code IS 'Internal SKU code (e.g., "MB-COKE-330")';
COMMENT ON COLUMN minibar_items.par_level_per_room IS 'Standard quantity to stock in each minibar';
COMMENT ON COLUMN minibar_items.pricing_tiers IS 'Multi-tier pricing based on room category or season (JSONB)';
COMMENT ON COLUMN minibar_items.allergen_list IS 'List of allergens present in the product';
COMMENT ON COLUMN minibar_items.storage_temp_required IS 'Temperature requirement: ROOM_TEMP, REFRIGERATED, FROZEN';
COMMENT ON COLUMN minibar_items.pos_item_id IS 'Link to Point of Sale system item';
COMMENT ON COLUMN minibar_items.metadata IS 'Custom fields for additional product specifications';

\echo 'Minibar items table created successfully!'
