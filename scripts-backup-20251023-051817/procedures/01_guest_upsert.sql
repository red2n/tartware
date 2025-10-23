-- =====================================================
-- 01_guest_upsert.sql
-- Guest Management with Deduplication
-- Uses ON CONFLICT for upsert operations
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating guest management procedures...'

-- =====================================================
-- Function: upsert_guest
-- Purpose: Insert or update guest, preventing duplicates
-- Uses: ON CONFLICT for PostgreSQL compatibility
-- =====================================================

CREATE OR REPLACE FUNCTION upsert_guest(
    p_tenant_id UUID,
    p_email VARCHAR(255),
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_phone VARCHAR(50) DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
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
BEGIN
    -- Upsert guest using ON CONFLICT
    INSERT INTO guests (
        tenant_id,
        email,
        first_name,
        last_name,
        phone,
        address,
        city,
        state,
        country,
        postal_code,
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
        p_address,
        p_city,
        p_state,
        p_country,
        p_postal_code,
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
        city = COALESCE(EXCLUDED.city, guests.city),
        state = COALESCE(EXCLUDED.state, guests.state),
        country = COALESCE(EXCLUDED.country, guests.country),
        postal_code = COALESCE(EXCLUDED.postal_code, guests.postal_code),
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
'Inserts new guest or updates existing guest based on email. Prevents duplicate profiles per tenant.';

-- =====================================================
-- Function: merge_duplicate_guests
-- Purpose: Find and merge duplicate guest profiles
-- Returns: Number of duplicates merged
-- =====================================================

CREATE OR REPLACE FUNCTION merge_duplicate_guests(
    p_tenant_id UUID,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    kept_guest_id UUID,
    merged_guest_ids UUID[],
    email VARCHAR(255),
    reservations_moved INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_duplicate RECORD;
    v_merged_ids UUID[];
    v_reservation_count INTEGER;
BEGIN
    -- Find duplicate guests by email
    FOR v_duplicate IN
        SELECT
            g.email,
            ARRAY_AGG(g.id ORDER BY g.created_at) AS guest_ids,
            MIN(g.id) AS primary_guest_id,
            COUNT(*) AS duplicate_count
        FROM guests g
        WHERE g.tenant_id = p_tenant_id
          AND g.deleted_at IS NULL
        GROUP BY g.email
        HAVING COUNT(*) > 1
    LOOP
        -- Get IDs to merge (all except the first/oldest)
        v_merged_ids := v_duplicate.guest_ids[2:];

        IF NOT p_dry_run THEN
            -- Move reservations to primary guest
            UPDATE reservations
            SET guest_id = v_duplicate.primary_guest_id,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = 'DEDUP_PROCESS'
            WHERE guest_id = ANY(v_merged_ids)
              AND tenant_id = p_tenant_id;

            GET DIAGNOSTICS v_reservation_count = ROW_COUNT;

            -- Soft delete duplicate guests
            UPDATE guests
            SET deleted_at = CURRENT_TIMESTAMP,
                deleted_by = 'DEDUP_PROCESS'
            WHERE id = ANY(v_merged_ids)
              AND tenant_id = p_tenant_id;
        ELSE
            -- Dry run: just count what would be moved
            SELECT COUNT(*) INTO v_reservation_count
            FROM reservations
            WHERE guest_id = ANY(v_merged_ids)
              AND tenant_id = p_tenant_id;
        END IF;

        -- Return results
        kept_guest_id := v_duplicate.primary_guest_id;
        merged_guest_ids := v_merged_ids;
        email := v_duplicate.email;
        reservations_moved := v_reservation_count;

        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION merge_duplicate_guests IS
'Finds and merges duplicate guest profiles by email. Use dry_run=true to preview changes.';

-- =====================================================
-- Function: bulk_upsert_guests
-- Purpose: Bulk upsert guests from channel manager/CSV import
-- =====================================================

CREATE OR REPLACE FUNCTION bulk_upsert_guests(
    p_tenant_id UUID,
    p_guests JSONB,
    p_created_by VARCHAR(100) DEFAULT 'BULK_IMPORT'
)
RETURNS TABLE (
    guest_id UUID,
    email VARCHAR(255),
    action VARCHAR(10)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_guest JSONB;
    v_guest_id UUID;
    v_existing_id UUID;
BEGIN
    -- Process each guest in the JSON array
    FOR v_guest IN SELECT * FROM jsonb_array_elements(p_guests)
    LOOP
        -- Check if guest exists
        SELECT id INTO v_existing_id
        FROM guests
        WHERE tenant_id = p_tenant_id
          AND email = LOWER(TRIM(v_guest->>'email'))
          AND deleted_at IS NULL;

        -- Upsert guest
        SELECT upsert_guest(
            p_tenant_id,
            v_guest->>'email',
            v_guest->>'first_name',
            v_guest->>'last_name',
            v_guest->>'phone',
            v_guest->>'address',
            v_guest->>'city',
            v_guest->>'state',
            v_guest->>'country',
            v_guest->>'postal_code',
            (v_guest->'preferences')::JSONB,
            p_created_by
        ) INTO v_guest_id;

        -- Return result
        guest_id := v_guest_id;
        email := v_guest->>'email';
        action := CASE WHEN v_existing_id IS NULL THEN 'INSERTED' ELSE 'UPDATED' END;

        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION bulk_upsert_guests IS
'Bulk insert or update guests from JSONB array. Used for channel manager imports.';

\echo '✓ Guest management procedures created successfully!'
