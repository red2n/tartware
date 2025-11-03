-- =====================================================
-- 69_payment_tokens_indexes.sql
-- Indexes for Payment Tokens
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating payment_tokens indexes...'

CREATE INDEX idx_payment_tokens_tenant
    ON payment_tokens(tenant_id, token_status)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_payment_tokens_property
    ON payment_tokens(property_id, token_status)
    WHERE property_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_payment_tokens_guest
    ON payment_tokens(guest_id, token_status)
    WHERE guest_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_payment_tokens_company
    ON payment_tokens(company_id, token_status)
    WHERE company_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_payment_tokens_last_used
    ON payment_tokens(last_used_at DESC)
    WHERE last_used_at IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_payment_tokens_vault
    ON payment_tokens(vault_provider, payment_network, network_token)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_payment_tokens_fingerprint
    ON payment_tokens(fingerprint)
    WHERE fingerprint IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_payment_tokens_billing_address
    ON payment_tokens USING gin(billing_address)
    WHERE billing_address IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_payment_tokens_metadata
    ON payment_tokens USING gin(metadata)
    WHERE metadata IS NOT NULL AND metadata <> '{}'::jsonb AND is_deleted = FALSE;

\echo 'payment_tokens indexes created.'
