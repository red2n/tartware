-- =====================================================
-- 73_payment_gateway_configurations.sql
-- Payment Gateway Configuration Table
-- Industry Standard: PCI-DSS gateway credential storage
-- Pattern: Per-tenant gateway profiles with multi-provider support
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- PAYMENT_GATEWAY_CONFIGURATIONS TABLE
-- Stores payment processor credentials, integration settings,
-- and processing rules per tenant/property
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_gateway_configurations (
    -- Primary Key
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),    -- Unique configuration identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                  -- FK tenants.id
    property_id UUID,                                         -- NULL = tenant-wide default

    -- Gateway Provider
    gateway_provider VARCHAR(50) NOT NULL,                    -- Provider name (STRIPE, ADYEN, SQUARE, WORLDPAY, etc.)
    gateway_label VARCHAR(200) NOT NULL,                      -- Human-readable label (e.g., 'Main Card Processor')
    gateway_environment VARCHAR(20) NOT NULL DEFAULT 'SANDBOX' CHECK (
        gateway_environment IN ('SANDBOX', 'PRODUCTION')
    ),                                                        -- Sandbox or production

    -- Credentials (encrypted at rest — values are opaque references or vault keys)
    api_key_ref VARCHAR(500),                                 -- API key vault reference (never store plaintext)
    api_secret_ref VARCHAR(500),                              -- API secret vault reference
    merchant_id VARCHAR(200),                                 -- Merchant/account identifier
    webhook_secret_ref VARCHAR(500),                          -- Webhook signing secret vault reference

    -- Processing Configuration
    supported_currencies VARCHAR(3)[] DEFAULT ARRAY['USD'],   -- Currencies this gateway can process
    supported_card_brands VARCHAR(20)[] DEFAULT ARRAY['VISA','MASTERCARD','AMEX'], -- Card brands
    supported_payment_methods VARCHAR(50)[] DEFAULT ARRAY['CREDIT_CARD'], -- Payment methods

    -- 3D Secure
    three_ds_enabled BOOLEAN DEFAULT TRUE,                    -- Enable 3D Secure authentication
    three_ds_enforce_on_high_risk BOOLEAN DEFAULT TRUE,       -- Force 3DS for high-risk transactions

    -- Tokenization
    tokenization_enabled BOOLEAN DEFAULT TRUE,                -- Store card-on-file tokens
    tokenization_provider VARCHAR(50),                        -- Token vault provider (defaults to gateway)

    -- Retry & Timeout
    retry_attempts INTEGER DEFAULT 3,                         -- Number of retries on soft failures
    retry_interval_minutes INTEGER DEFAULT 15,                -- Minutes between retries
    request_timeout_ms INTEGER DEFAULT 30000,                 -- HTTP timeout for gateway calls

    -- Processing Limits
    min_transaction_amount DECIMAL(15,2) DEFAULT 0.50,        -- Minimum transaction amount
    max_transaction_amount DECIMAL(15,2) DEFAULT 99999.99,    -- Maximum single transaction
    daily_transaction_limit DECIMAL(15,2),                    -- Daily volume cap (NULL = no limit)

    -- Surcharge / Fee Configuration
    surcharge_enabled BOOLEAN DEFAULT FALSE,                  -- Apply surcharge on card payments
    surcharge_percent DECIMAL(5,2),                           -- Surcharge percentage
    surcharge_flat_amount DECIMAL(10,2),                      -- Flat surcharge amount

    -- Webhook Configuration
    webhook_url VARCHAR(500),                                 -- Gateway webhook callback URL
    webhook_events VARCHAR(100)[] DEFAULT ARRAY['payment.completed','payment.failed','refund.completed'], -- Events to receive

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                  -- Whether this config is active
    is_primary BOOLEAN DEFAULT FALSE,                         -- Primary gateway for this tenant/property

    -- Notes
    notes TEXT,                                               -- Internal notes

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::JSONB,                       -- Extensible metadata

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
    created_by UUID,                                               -- Creator
    updated_by UUID,                                               -- Last updater

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                              -- Soft delete flag
    deleted_at TIMESTAMP WITH TIME ZONE,                           -- Soft delete timestamp
    deleted_by UUID,                                               -- Soft delete actor

    -- Constraints
    CONSTRAINT uq_gateway_tenant_label UNIQUE (tenant_id, property_id, gateway_label)
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE payment_gateway_configurations IS 'Payment processor credentials and integration settings per tenant/property (PCI-DSS compliant)';
COMMENT ON COLUMN payment_gateway_configurations.gateway_provider IS 'Payment provider: STRIPE, ADYEN, SQUARE, WORLDPAY, AUTHORIZE_NET, etc.';
COMMENT ON COLUMN payment_gateway_configurations.api_key_ref IS 'Vault reference for API key — never stores plaintext credentials';
COMMENT ON COLUMN payment_gateway_configurations.api_secret_ref IS 'Vault reference for API secret — never stores plaintext credentials';
COMMENT ON COLUMN payment_gateway_configurations.webhook_secret_ref IS 'Vault reference for webhook signing secret';
COMMENT ON COLUMN payment_gateway_configurations.three_ds_enabled IS 'Whether 3D Secure authentication is enabled';
COMMENT ON COLUMN payment_gateway_configurations.tokenization_enabled IS 'Whether card-on-file tokenization is available';
COMMENT ON COLUMN payment_gateway_configurations.is_primary IS 'Primary gateway used for new transactions at this property';

\echo 'payment_gateway_configurations table created successfully!'
