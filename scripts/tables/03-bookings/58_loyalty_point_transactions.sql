-- =====================================================
-- 58_loyalty_point_transactions.sql
-- Loyalty points transactional ledger
-- Industry Standard: Hotel loyalty programs (IHG, Marriott Bonvoy, Hilton Honors)
-- Pattern: Append-only ledger with running balance
-- Date: 2025-06-14
-- =====================================================

-- =====================================================
-- LOYALTY_POINT_TRANSACTIONS TABLE
-- Immutable ledger of all points earn/burn/expire events
-- =====================================================

CREATE TABLE IF NOT EXISTS loyalty_point_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),      -- Unique transaction identifier
    tenant_id UUID NOT NULL,                                         -- Owning tenant
    program_id UUID NOT NULL REFERENCES guest_loyalty_programs(program_id), -- Loyalty program membership
    guest_id UUID NOT NULL,                                          -- Guest earning/spending points

    -- Transaction Details
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'earn', 'redeem', 'expire', 'adjust', 'bonus', 'transfer_in', 'transfer_out'
    )),                                                              -- Type of points movement
    points INTEGER NOT NULL,                                         -- Points amount (positive for earn, negative for redeem/expire)
    balance_after INTEGER NOT NULL,                                  -- Running balance after this transaction
    currency_value DECIMAL(10,2),                                    -- Monetary equivalent if applicable

    -- Reference
    reference_type VARCHAR(50),                                      -- What triggered this (reservation, folio, promotion, manual)
    reference_id UUID,                                               -- ID of the triggering entity
    description VARCHAR(500),                                        -- Human-readable description

    -- Expiry
    expires_at TIMESTAMP WITH TIME ZONE,                             -- When these earned points expire (NULL = no expiry)
    expired BOOLEAN NOT NULL DEFAULT FALSE,                          -- Whether points have been expired

    -- Audit
    performed_by UUID,                                               -- User who initiated the transaction
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP    -- Transaction timestamp (immutable)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_point_transactions_program
    ON loyalty_point_transactions (tenant_id, program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_point_transactions_guest
    ON loyalty_point_transactions (tenant_id, guest_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_point_transactions_expiry
    ON loyalty_point_transactions (expires_at)
    WHERE expired = FALSE AND expires_at IS NOT NULL;

COMMENT ON TABLE loyalty_point_transactions IS 'Immutable ledger tracking all loyalty point movements (earn, redeem, expire, adjust, bonus, transfer) with running balance';
COMMENT ON COLUMN loyalty_point_transactions.points IS 'Points delta: positive for earn/bonus/adjust/transfer_in, negative for redeem/expire/transfer_out';
COMMENT ON COLUMN loyalty_point_transactions.balance_after IS 'Running balance after this transaction, computed at insert time';
COMMENT ON COLUMN loyalty_point_transactions.expires_at IS 'Expiration timestamp for earned points; NULL means no expiry';
COMMENT ON COLUMN loyalty_point_transactions.reference_type IS 'Source that triggered the transaction: reservation, folio, promotion, manual, sweep';

\echo 'loyalty_point_transactions table created successfully!'
