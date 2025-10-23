-- =====================================================
-- add_friendly_constraint_messages.sql
-- Add user-friendly error messages to constraints
-- Date: 2025-10-21
-- =====================================================

\c tartware

\echo ''
\echo '======================================================'
\echo '  Adding Friendly Constraint Error Messages'
\echo '======================================================'
\echo ''

-- =====================================================
-- Function: Create friendly FK violation trigger
-- =====================================================

CREATE OR REPLACE FUNCTION enforce_fk_with_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_error_message TEXT;
    v_parent_table TEXT;
    v_parent_column TEXT;
    v_child_value TEXT;
BEGIN
    -- Get constraint metadata
    SELECT
        confrelid::regclass::text,
        a.attname
    INTO v_parent_table, v_parent_column
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)
    WHERE c.conname = TG_ARGV[0];

    -- Build friendly error message based on table and operation
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_error_message := format(
            'Cannot save record: The %s you selected does not exist or has been deleted. Please select a valid %s.',
            replace(v_parent_table, '_', ' '),
            replace(v_parent_column, '_id', '')
        );
        RAISE EXCEPTION '%', v_error_message
            USING HINT = format('Check if the %s still exists in the system', v_parent_table);
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_error_message := format(
            'Cannot delete this %s because it is being used by other records. Please remove the related %s records first.',
            replace(TG_TABLE_NAME, '_', ' '),
            replace(v_parent_table, '_', ' ')
        );
        RAISE EXCEPTION '%', v_error_message
            USING HINT = 'Delete or update the related records before deleting this one';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_fk_with_message() IS
'Provides user-friendly error messages for foreign key violations';

-- =====================================================
-- Common CHECK Constraint Helpers
-- =====================================================

-- Function to validate email format
CREATE OR REPLACE FUNCTION is_valid_email(email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$';
END;
$$;

-- Function to validate phone number format
CREATE OR REPLACE FUNCTION is_valid_phone(phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Accepts: +1234567890, (123) 456-7890, 123-456-7890, 1234567890
    RETURN phone ~ '^\+?[\d\s\(\)\-]{10,20}$';
END;
$$;

-- Function to validate date range
CREATE OR REPLACE FUNCTION is_valid_date_range(start_date DATE, end_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN start_date IS NOT NULL
        AND end_date IS NOT NULL
        AND end_date >= start_date;
END;
$$;

-- =====================================================
-- Add CHECK constraints with friendly messages
-- =====================================================

-- Reservations: Check-in before check-out
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_reservations_dates'
        AND conrelid = 'reservations'::regclass
    ) THEN
        ALTER TABLE reservations
        ADD CONSTRAINT chk_reservations_dates
        CHECK (check_out_date > check_in_date);

        COMMENT ON CONSTRAINT chk_reservations_dates ON reservations IS
        'Check-out date must be after check-in date';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Guests: Valid email format
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_guests_email_format'
        AND conrelid = 'guests'::regclass
    ) THEN
        ALTER TABLE guests
        ADD CONSTRAINT chk_guests_email_format
        CHECK (email IS NULL OR is_valid_email(email));

        COMMENT ON CONSTRAINT chk_guests_email_format ON guests IS
        'Email must be in valid format (e.g., user@example.com)';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Guests: Valid phone format
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_guests_phone_format'
        AND conrelid = 'guests'::regclass
    ) THEN
        ALTER TABLE guests
        ADD CONSTRAINT chk_guests_phone_format
        CHECK (phone IS NULL OR is_valid_phone(phone));

        COMMENT ON CONSTRAINT chk_guests_phone_format ON guests IS
        'Phone must be in valid format with 10-20 digits';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Payments: Positive amount
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_payments_positive_amount'
        AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments
        ADD CONSTRAINT chk_payments_positive_amount
        CHECK (amount > 0);

        COMMENT ON CONSTRAINT chk_payments_positive_amount ON payments IS
        'Payment amount must be greater than zero';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Rooms: Positive capacity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_rooms_positive_capacity'
        AND conrelid = 'rooms'::regclass
    ) THEN
        ALTER TABLE rooms
        ADD CONSTRAINT chk_rooms_positive_capacity
        CHECK (max_occupancy > 0);

        COMMENT ON CONSTRAINT chk_rooms_positive_capacity ON rooms IS
        'Room capacity must be at least 1 person';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Rates: Positive rate amount
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_rates_positive_amount'
        AND conrelid = 'rates'::regclass
    ) THEN
        ALTER TABLE rates
        ADD CONSTRAINT chk_rates_positive_amount
        CHECK (base_rate > 0);

        COMMENT ON CONSTRAINT chk_rates_positive_amount ON rates IS
        'Rate amount must be greater than zero';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Create view to show constraint messages
-- =====================================================

CREATE OR REPLACE VIEW v_constraint_help AS
SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    CASE tc.constraint_type
        WHEN 'FOREIGN KEY' THEN
            format('This field must match an existing %s. Error means the selected %s does not exist.',
                ccu.table_name,
                replace(ccu.column_name, '_id', ''))
        WHEN 'CHECK' THEN
            COALESCE(
                pg_get_constraintdef(c.oid),
                'Value does not meet the required condition'
            )
        WHEN 'UNIQUE' THEN
            format('%s must be unique. This value already exists in the database.',
                string_agg(kcu.column_name, ', '))
        WHEN 'PRIMARY KEY' THEN
            'Primary key violation - duplicate ID'
        ELSE
            'Constraint violation'
    END as user_friendly_message,
    pg_get_constraintdef(c.oid) as technical_definition
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
LEFT JOIN pg_constraint c
    ON c.conname = tc.constraint_name
WHERE tc.table_schema IN ('public', 'availability')
GROUP BY
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    ccu.table_name,
    ccu.column_name,
    c.oid
ORDER BY tc.table_name, tc.constraint_name;

COMMENT ON VIEW v_constraint_help IS
'User-friendly explanations of database constraints and their error messages';

-- =====================================================
-- Function to get constraint error help
-- =====================================================

CREATE OR REPLACE FUNCTION get_constraint_help(
    p_constraint_name TEXT
)
RETURNS TABLE(
    constraint_name TEXT,
    table_name TEXT,
    constraint_type TEXT,
    user_message TEXT,
    how_to_fix TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.constraint_name::TEXT,
        v.table_name::TEXT,
        v.constraint_type::TEXT,
        v.user_friendly_message::TEXT,
        CASE v.constraint_type
            WHEN 'FOREIGN KEY' THEN
                'Ensure the related record exists before saving'
            WHEN 'CHECK' THEN
                'Verify the value meets the required format or range'
            WHEN 'UNIQUE' THEN
                'Use a different value that doesn''t already exist'
            WHEN 'PRIMARY KEY' THEN
                'Contact support - this is an internal system error'
            ELSE
                'Review the constraint requirements'
        END::TEXT
    FROM v_constraint_help v
    WHERE v.constraint_name = p_constraint_name;
END;
$$;

COMMENT ON FUNCTION get_constraint_help(TEXT) IS
'Get user-friendly help for a specific constraint violation';

-- =====================================================
-- Summary
-- =====================================================

\echo ''
\echo '✅ Friendly constraint messages added!'
\echo ''
\echo 'Usage Examples:'
\echo '----------------------------------------------------'
\echo ''
\echo '1. View all constraints with friendly messages:'
\echo '   SELECT * FROM v_constraint_help WHERE table_name = ''guests'';'
\echo ''
\echo '2. Get help for a specific constraint:'
\echo '   SELECT * FROM get_constraint_help(''fk_reservation_guest_id'');'
\echo ''
\echo '3. Check email validation:'
\echo '   SELECT is_valid_email(''user@example.com'');'
\echo ''
\echo '4. Check phone validation:'
\echo '   SELECT is_valid_phone(''+1-234-567-8900'');'
\echo ''
\echo '5. Check date range:'
\echo '   SELECT is_valid_date_range(''2025-01-01'', ''2025-01-10'');'
\echo ''
\echo '======================================================'
\echo ''

