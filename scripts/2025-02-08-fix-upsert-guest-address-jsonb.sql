-- =====================================================
-- Fix upsert_guest: pack address fields into JSONB
-- The guests table has a single `address jsonb` column,
-- not separate city/state/country/postal_code columns.
-- Also fix idx_guests_tenant_email to be UNIQUE (required
-- for ON CONFLICT).
-- Date: 2025-02-08
-- =====================================================

-- The ON CONFLICT (tenant_id, email) WHERE deleted_at IS NULL clause
-- requires a matching UNIQUE partial index, not a plain btree index.
DROP INDEX IF EXISTS idx_guests_tenant_email;
CREATE UNIQUE INDEX idx_guests_tenant_email ON guests (tenant_id, email) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION upsert_guest(
    p_tenant_id UUID,
    p_email VARCHAR(255),
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_phone VARCHAR(50) DEFAULT NULL,
    p_address TEXT DEFAULT NULL,          -- street
    p_city VARCHAR(100) DEFAULT NULL,
    p_state VARCHAR(100) DEFAULT NULL,
    p_country VARCHAR(100) DEFAULT NULL,
    p_postal_code VARCHAR(20) DEFAULT NULL,
    p_preferences JSONB DEFAULT NULL,
    p_created_by VARCHAR(100) DEFAULT 'SYSTEM'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_guest_id UUID;
    v_address_jsonb JSONB;
BEGIN
    -- Build address JSONB from individual parameters
    v_address_jsonb := jsonb_build_object(
        'street',     COALESCE(p_address, ''),
        'city',       COALESCE(p_city, ''),
        'state',      COALESCE(p_state, ''),
        'country',    COALESCE(p_country, ''),
        'postalCode', COALESCE(p_postal_code, '')
    );

    -- Upsert guest using ON CONFLICT
    INSERT INTO guests (
        tenant_id,
        email,
        first_name,
        last_name,
        phone,
        address,
        preferences,
        created_by,
        created_at,
        updated_at
    )
    VALUES (
        p_tenant_id,
        LOWER(TRIM(p_email)),
        TRIM(p_first_name),
        TRIM(p_last_name),
        p_phone,
        v_address_jsonb,
        p_preferences,
        p_created_by,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (tenant_id, email)
    WHERE deleted_at IS NULL
    DO UPDATE SET
        first_name = TRIM(EXCLUDED.first_name),
        last_name = TRIM(EXCLUDED.last_name),
        phone = COALESCE(EXCLUDED.phone, guests.phone),
        address = COALESCE(EXCLUDED.address, guests.address),
        preferences = COALESCE(EXCLUDED.preferences, guests.preferences),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = p_created_by,
        version = guests.version + 1
    WHERE guests.deleted_at IS NULL
    RETURNING id INTO v_guest_id;

    RETURN v_guest_id;
END;
$$;

COMMENT ON FUNCTION upsert_guest IS
'Inserts new guest or updates existing guest based on email. Prevents duplicate profiles per tenant. Packs address fields into JSONB.';
