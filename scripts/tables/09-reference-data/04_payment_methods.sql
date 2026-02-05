-- =====================================================
-- 04_payment_methods.sql
-- Dynamic Payment Method Reference Data
--
-- Purpose: Replace hardcoded payment_method ENUM with
--          configurable lookup table
--
-- Industry Standard: PCI-DSS categories, EMV payment types,
--                    HTNG Payment Specifications
--
-- Date: 2026-02-05
-- =====================================================

\c tartware

\echo 'Creating payment_methods table...'

CREATE TABLE IF NOT EXISTS payment_methods (
    -- Primary Key
    method_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy (NULL tenant_id = system default)
    tenant_id UUID,  -- NULL for system defaults available to all
    property_id UUID, -- NULL for tenant-level methods

    -- Payment Method Identification
    code VARCHAR(30) NOT NULL,           -- e.g., "CASH", "CC_VISA"
    name VARCHAR(100) NOT NULL,          -- e.g., "Visa Credit Card"
    description TEXT,                    -- Detailed description

    -- Classification
    category VARCHAR(30) NOT NULL
        CHECK (category IN (
            'CASH',         -- Physical currency
            'CREDIT_CARD',  -- Credit cards
            'DEBIT_CARD',   -- Debit/ATM cards
            'BANK',         -- Wire, ACH, direct debit
            'CHECK',        -- Paper checks
            'DIGITAL',      -- Digital wallets, mobile pay
            'CRYPTO',       -- Cryptocurrency
            'VOUCHER',      -- Gift cards, travel vouchers
            'ACCOUNT',      -- Direct bill, AR
            'OTHER'
        )),

    -- Processing Behavior
    is_electronic BOOLEAN DEFAULT FALSE,  -- Requires gateway processing
    is_guaranteed BOOLEAN DEFAULT FALSE,  -- Guarantees reservation
    is_prepayment BOOLEAN DEFAULT FALSE,  -- Collected before arrival
    is_refundable BOOLEAN DEFAULT TRUE,   -- Can issue refunds
    is_tokenizable BOOLEAN DEFAULT FALSE, -- Supports tokenization
    requires_authorization BOOLEAN DEFAULT FALSE, -- Pre-auth needed

    -- Card-Specific (for credit/debit)
    card_brand VARCHAR(20),              -- VISA, MASTERCARD, AMEX, etc.
    card_type VARCHAR(20),               -- CREDIT, DEBIT, PREPAID
    bin_range_start VARCHAR(6),          -- BIN range for auto-detect
    bin_range_end VARCHAR(6),

    -- Settlement
    settlement_days INTEGER DEFAULT 0,   -- Days to settlement
    default_fee_pct DECIMAL(5,2),        -- Processing fee percentage
    default_fee_fixed DECIMAL(10,2),     -- Fixed processing fee
    currency_code VARCHAR(3) DEFAULT 'USD', -- Fee currency

    -- Limits
    min_amount DECIMAL(15,2) DEFAULT 0,
    max_amount DECIMAL(15,2),
    requires_id_verification BOOLEAN DEFAULT FALSE,
    requires_signature BOOLEAN DEFAULT FALSE,

    -- Integration
    gateway_code VARCHAR(50),            -- Payment gateway identifier
    terminal_type VARCHAR(30),           -- POS, MOTO, ECOM

    -- Mapping to Legacy Enum
    legacy_enum_value VARCHAR(50),        -- Maps to payment_method ENUM

    -- Display & UI
    display_order INTEGER DEFAULT 0,
    color_code VARCHAR(7),
    icon VARCHAR(50),                    -- Icon for UI (e.g., FontAwesome)
    logo_url VARCHAR(255),               -- Card/payment logo

    -- System vs Custom
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT uk_payment_methods_tenant_code
        UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, code),

    CONSTRAINT chk_payment_method_code_format
        CHECK (code ~ '^[A-Z0-9_]{1,30}$'),

    CONSTRAINT chk_payment_method_fee
        CHECK (default_fee_pct IS NULL OR
               (default_fee_pct >= 0 AND default_fee_pct <= 100))
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE payment_methods IS
'Configurable payment method codes (CASH, CREDIT_CARD, etc.)
replacing hardcoded ENUM. Supports card brands, processing fees,
gateway integration, and PCI-DSS compliance requirements.';

COMMENT ON COLUMN payment_methods.category IS
'Payment category: CASH, CREDIT_CARD, DEBIT_CARD, BANK, CHECK, DIGITAL, CRYPTO, VOUCHER, ACCOUNT';

COMMENT ON COLUMN payment_methods.is_tokenizable IS
'TRUE if payment method supports card-on-file tokenization (PCI compliance)';

COMMENT ON COLUMN payment_methods.gateway_code IS
'Payment gateway identifier for routing transactions';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_payment_methods_tenant
    ON payment_methods(tenant_id, property_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_payment_methods_active
    ON payment_methods(tenant_id, is_active, display_order)
    WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX idx_payment_methods_category
    ON payment_methods(category, is_electronic)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_payment_methods_card_brand
    ON payment_methods(card_brand)
    WHERE card_brand IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_payment_methods_legacy
    ON payment_methods(legacy_enum_value)
    WHERE legacy_enum_value IS NOT NULL;

-- =====================================================
-- SYSTEM DEFAULT DATA
-- =====================================================

INSERT INTO payment_methods (
    tenant_id, code, name, description,
    category, is_electronic, is_guaranteed, is_prepayment,
    is_refundable, is_tokenizable, requires_authorization,
    card_brand, card_type, settlement_days, default_fee_pct,
    requires_signature, gateway_code, terminal_type,
    legacy_enum_value, display_order, color_code, icon, is_system
) VALUES
-- CASH
(NULL, 'CASH', 'Cash', 'Physical currency payment',
 'CASH', FALSE, FALSE, TRUE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 0, 0.00,
 FALSE, NULL, 'POS',
 'CASH', 10, '#28a745', 'money-bill', TRUE),

-- CREDIT CARDS
(NULL, 'CC_VISA', 'Visa', 'Visa credit card',
 'CREDIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'VISA', 'CREDIT', 2, 2.30,
 TRUE, NULL, NULL,
 'CREDIT_CARD', 20, '#1a1f71', 'cc-visa', TRUE),

(NULL, 'CC_MASTERCARD', 'Mastercard', 'Mastercard credit card',
 'CREDIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'MASTERCARD', 'CREDIT', 2, 2.30,
 TRUE, NULL, NULL,
 'CREDIT_CARD', 21, '#eb001b', 'cc-mastercard', TRUE),

(NULL, 'CC_AMEX', 'American Express', 'American Express card',
 'CREDIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'AMEX', 'CREDIT', 3, 3.00,
 TRUE, NULL, NULL,
 'CREDIT_CARD', 22, '#006fcf', 'cc-amex', TRUE),

(NULL, 'CC_DISCOVER', 'Discover', 'Discover card',
 'CREDIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'DISCOVER', 'CREDIT', 2, 2.35,
 TRUE, NULL, NULL,
 'CREDIT_CARD', 23, '#ff6000', 'cc-discover', TRUE),

(NULL, 'CC_DINERS', 'Diners Club', 'Diners Club International',
 'CREDIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'DINERS', 'CREDIT', 3, 2.80,
 TRUE, NULL, NULL,
 'CREDIT_CARD', 24, '#0079be', 'cc-diners-club', TRUE),

(NULL, 'CC_JCB', 'JCB', 'JCB (Japan Credit Bureau)',
 'CREDIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'JCB', 'CREDIT', 3, 2.50,
 TRUE, NULL, NULL,
 'CREDIT_CARD', 25, '#0b4ea2', 'cc-jcb', TRUE),

(NULL, 'CC_UNIONPAY', 'UnionPay', 'China UnionPay',
 'CREDIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'UNIONPAY', 'CREDIT', 3, 2.50,
 TRUE, NULL, NULL,
 'CREDIT_CARD', 26, '#e21836', 'credit-card', TRUE),

-- DEBIT CARDS
(NULL, 'DC_VISA', 'Visa Debit', 'Visa debit card',
 'DEBIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'VISA', 'DEBIT', 1, 1.50,
 FALSE, NULL, NULL,
 'DEBIT_CARD', 30, '#1a1f71', 'cc-visa', TRUE),

(NULL, 'DC_MASTERCARD', 'Mastercard Debit', 'Mastercard debit card',
 'DEBIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'MASTERCARD', 'DEBIT', 1, 1.50,
 FALSE, NULL, NULL,
 'DEBIT_CARD', 31, '#eb001b', 'cc-mastercard', TRUE),

(NULL, 'DC_MAESTRO', 'Maestro', 'Maestro debit card',
 'DEBIT_CARD', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 'MAESTRO', 'DEBIT', 1, 1.20,
 FALSE, NULL, NULL,
 'DEBIT_CARD', 32, '#cc0000', 'credit-card', TRUE),

-- BANK TRANSFERS
(NULL, 'WIRE', 'Wire Transfer', 'Bank wire transfer',
 'BANK', TRUE, TRUE, TRUE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 3, 0.00,
 FALSE, NULL, NULL,
 'BANK_TRANSFER', 40, '#007bff', 'university', TRUE),

(NULL, 'ACH', 'ACH/Direct Debit', 'Automated Clearing House transfer',
 'BANK', TRUE, TRUE, TRUE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 4, 0.50,
 FALSE, NULL, NULL,
 'BANK_TRANSFER', 41, '#007bff', 'building-columns', TRUE),

(NULL, 'SEPA', 'SEPA Transfer', 'Single Euro Payments Area transfer',
 'BANK', TRUE, TRUE, TRUE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 2, 0.30,
 FALSE, NULL, NULL,
 'BANK_TRANSFER', 42, '#003399', 'euro-sign', TRUE),

-- CHECKS
(NULL, 'CHECK', 'Check', 'Paper check',
 'CHECK', FALSE, FALSE, FALSE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 5, 0.00,
 FALSE, NULL, NULL,
 'CHECK', 50, '#6c757d', 'money-check', TRUE),

(NULL, 'TCHECK', 'Travelers Check', 'Travelers check',
 'CHECK', FALSE, FALSE, FALSE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 5, 0.00,
 FALSE, NULL, NULL,
 'CHECK', 51, '#6c757d', 'money-check-alt', TRUE),

-- DIGITAL WALLETS
(NULL, 'APPLE_PAY', 'Apple Pay', 'Apple Pay mobile wallet',
 'DIGITAL', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 NULL, NULL, 2, 2.00,
 FALSE, NULL, 'ECOM',
 'DIGITAL_WALLET', 60, '#000000', 'apple-pay', TRUE),

(NULL, 'GOOGLE_PAY', 'Google Pay', 'Google Pay mobile wallet',
 'DIGITAL', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 NULL, NULL, 2, 2.00,
 FALSE, NULL, 'ECOM',
 'DIGITAL_WALLET', 61, '#4285f4', 'google-pay', TRUE),

(NULL, 'SAMSUNG_PAY', 'Samsung Pay', 'Samsung Pay mobile wallet',
 'DIGITAL', TRUE, TRUE, FALSE,
 TRUE, TRUE, TRUE,
 NULL, NULL, 2, 2.00,
 FALSE, NULL, 'ECOM',
 'DIGITAL_WALLET', 62, '#1428a0', 'mobile-alt', TRUE),

(NULL, 'PAYPAL', 'PayPal', 'PayPal online payment',
 'DIGITAL', TRUE, TRUE, FALSE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 3, 2.90,
 FALSE, 'paypal', 'ECOM',
 'DIGITAL_WALLET', 65, '#003087', 'paypal', TRUE),

(NULL, 'VENMO', 'Venmo', 'Venmo mobile payment',
 'DIGITAL', TRUE, FALSE, TRUE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 2, 1.90,
 FALSE, 'paypal', 'ECOM',
 'DIGITAL_WALLET', 66, '#3d95ce', 'mobile', TRUE),

(NULL, 'ALIPAY', 'Alipay', 'Alipay (China)',
 'DIGITAL', TRUE, TRUE, FALSE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 2, 2.50,
 FALSE, NULL, 'ECOM',
 'DIGITAL_WALLET', 70, '#1677ff', 'alipay', TRUE),

(NULL, 'WECHAT_PAY', 'WeChat Pay', 'WeChat Pay (China)',
 'DIGITAL', TRUE, TRUE, FALSE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 2, 2.50,
 FALSE, NULL, 'ECOM',
 'DIGITAL_WALLET', 71, '#07c160', 'weixin', TRUE),

-- CRYPTOCURRENCY
(NULL, 'BITCOIN', 'Bitcoin', 'Bitcoin cryptocurrency',
 'CRYPTO', TRUE, FALSE, TRUE,
 FALSE, FALSE, FALSE,
 NULL, NULL, 0, 1.00,
 FALSE, NULL, 'ECOM',
 'CRYPTOCURRENCY', 80, '#f7931a', 'bitcoin', TRUE),

(NULL, 'ETHEREUM', 'Ethereum', 'Ethereum cryptocurrency',
 'CRYPTO', TRUE, FALSE, TRUE,
 FALSE, FALSE, FALSE,
 NULL, NULL, 0, 1.00,
 FALSE, NULL, 'ECOM',
 'CRYPTOCURRENCY', 81, '#627eea', 'ethereum', TRUE),

(NULL, 'USDC', 'USD Coin', 'USDC stablecoin',
 'CRYPTO', TRUE, FALSE, TRUE,
 FALSE, FALSE, FALSE,
 NULL, NULL, 0, 1.00,
 FALSE, NULL, 'ECOM',
 'CRYPTOCURRENCY', 82, '#2775ca', 'coins', TRUE),

-- VOUCHERS
(NULL, 'GIFT_CARD', 'Gift Card', 'Hotel gift card',
 'VOUCHER', FALSE, FALSE, TRUE,
 FALSE, FALSE, FALSE,
 NULL, NULL, 0, 0.00,
 FALSE, NULL, NULL,
 NULL, 90, '#dc3545', 'gift-card', TRUE),

(NULL, 'TRAVEL_VOUCHER', 'Travel Voucher', 'OTA/Agency travel voucher',
 'VOUCHER', FALSE, FALSE, TRUE,
 FALSE, FALSE, FALSE,
 NULL, NULL, 0, 0.00,
 FALSE, NULL, NULL,
 NULL, 91, '#17a2b8', 'ticket', TRUE),

-- ACCOUNT/BILLING
(NULL, 'DIRECT_BILL', 'Direct Bill', 'Bill to company account (AR)',
 'ACCOUNT', FALSE, TRUE, FALSE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 30, 0.00,
 TRUE, NULL, NULL,
 NULL, 95, '#343a40', 'file-invoice-dollar', TRUE),

(NULL, 'CITY_LEDGER', 'City Ledger', 'Post to city ledger for later collection',
 'ACCOUNT', FALSE, FALSE, FALSE,
 TRUE, FALSE, FALSE,
 NULL, NULL, 30, 0.00,
 FALSE, NULL, NULL,
 NULL, 96, '#6c757d', 'file-invoice', TRUE);

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT SELECT ON payment_methods TO tartware_app;
GRANT INSERT, UPDATE ON payment_methods TO tartware_app;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

\echo '✓ Table created: payment_methods'
\echo '  - 30 system default payment methods seeded'
\echo '  - 10 payment categories'
\echo '  - Card brand support (Visa, MC, Amex, etc.)'
\echo '  - Digital wallets (Apple, Google, PayPal, WeChat, Alipay)'
\echo '  - Cryptocurrency support'
\echo ''
