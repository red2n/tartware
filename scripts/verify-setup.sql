-- =====================================================
-- verify-setup.sql
-- Post-Setup Verification — runs after every clean DB setup
-- Validates schema objects, seed data, and integrity
--
-- Usage: psql -h localhost -U postgres -d tartware -f scripts/verify-setup.sql
-- Called automatically by setup-database.sh at step [14/14]
--
-- Exit behavior: ON_ERROR_STOP ensures any failure halts the script
-- The final DO block reports pass/fail/warn totals and exits nonzero on failure
--
-- Date: 2026-02-23
-- =====================================================

\set ON_ERROR_STOP on
\c tartware

\echo ''
\echo '██████████████████████████████████████████████████████████████'
\echo '█                                                            █'
\echo '█   TARTWARE PMS — POST-SETUP VERIFICATION                  █'
\echo '█   Validates every layer of a clean database install        █'
\echo '█                                                            █'
\echo '██████████████████████████████████████████████████████████████'
\echo ''

-- =============================================================
-- Master verification in a single DO block for atomic reporting
-- =============================================================
DO $$
DECLARE
    v_pass   INT := 0;
    v_fail   INT := 0;
    v_warn   INT := 0;
    v_count  INT;
    v_val    TEXT;
    v_enum   TEXT[];

    -- ── Expected counts (update when adding tables/enums/seeds) ──
    -- These are minimums; the script uses >= checks so additive
    -- changes don't break the verification.
    C_MIN_TABLES         CONSTANT INT := 210;
    C_MIN_ENUMS          CONSTANT INT := 65;
    C_MIN_INDEXES        CONSTANT INT := 2500;
    C_MIN_FOREIGN_KEYS   CONSTANT INT := 1100;
    C_MIN_PROCEDURES     CONSTANT INT := 60;
    C_MIN_TRIGGERS       CONSTANT INT := 10;
    C_MIN_COMMAND_TEMPLATES CONSTANT INT := 88;
    C_MIN_CHARGE_CODES   CONSTANT INT := 20;
    C_MIN_SEED_RECORDS   CONSTANT INT := 500;

    -- Helper macro for pass/fail
    -- (PL/pgSQL doesn't have macros; we inline the pattern)
BEGIN

-- ═════════════════════════════════════════════════════════════
-- PHASE 1: EXTENSIONS & SCHEMAS
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 1: EXTENSIONS & SCHEMAS ═══';

-- uuid-ossp
IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    RAISE NOTICE '  ✓ Extension uuid-ossp installed';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Extension uuid-ossp MISSING';
    v_fail := v_fail + 1;
END IF;

-- pg_trgm
IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RAISE NOTICE '  ✓ Extension pg_trgm installed';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Extension pg_trgm MISSING';
    v_fail := v_fail + 1;
END IF;

-- availability schema
IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'availability') THEN
    RAISE NOTICE '  ✓ Schema availability exists';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Schema availability MISSING';
    v_fail := v_fail + 1;
END IF;


-- ═════════════════════════════════════════════════════════════
-- PHASE 2: ENUM TYPES
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 2: ENUM TYPES ═══';

SELECT COUNT(*) INTO v_count FROM pg_type WHERE typtype = 'e';
IF v_count >= C_MIN_ENUMS THEN
    RAISE NOTICE '  ✓ ENUM types: % (expected ≥ %)', v_count, C_MIN_ENUMS;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ ENUM types: % (expected ≥ %)', v_count, C_MIN_ENUMS;
    v_fail := v_fail + 1;
END IF;

-- Key enum value checks
SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_enum
FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'reservation_status';

IF v_enum @> ARRAY['INQUIRY', 'QUOTED', 'EXPIRED', 'WAITLISTED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'] THEN
    RAISE NOTICE '  ✓ reservation_status has all lifecycle values';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ reservation_status missing lifecycle values';
    v_fail := v_fail + 1;
END IF;

SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_enum
FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'payment_status';

IF v_enum @> ARRAY['AUTHORIZED', 'PENDING', 'COMPLETED'] THEN
    RAISE NOTICE '  ✓ payment_status has AUTHORIZED, PENDING, COMPLETED';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ payment_status missing key values';
    v_fail := v_fail + 1;
END IF;

SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_enum
FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'invoice_status';

IF v_enum @> ARRAY['FINALIZED'] THEN
    RAISE NOTICE '  ✓ invoice_status has FINALIZED';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ invoice_status missing FINALIZED';
    v_fail := v_fail + 1;
END IF;


-- ═════════════════════════════════════════════════════════════
-- PHASE 3: TABLES
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 3: TABLES ═══';

SELECT COUNT(*) INTO v_count
FROM information_schema.tables
WHERE table_schema IN ('public', 'availability') AND table_type = 'BASE TABLE';

IF v_count >= C_MIN_TABLES THEN
    RAISE NOTICE '  ✓ Total tables: % (expected ≥ %)', v_count, C_MIN_TABLES;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Total tables: % (expected ≥ %)', v_count, C_MIN_TABLES;
    v_fail := v_fail + 1;
END IF;

-- ── Critical tables existence checks ──
DECLARE
    v_critical_tables TEXT[] := ARRAY[
        -- Core
        'tenants', 'users', 'user_tenant_associations', 'properties', 'guests',
        -- Inventory
        'room_types', 'rooms', 'rates', 'rate_overrides', 'packages',
        -- Bookings
        'reservations', 'reservation_status_history', 'deposit_schedules',
        'allotments', 'booking_sources', 'market_segments', 'waitlist_entries',
        'overbooking_config', 'walk_history', 'lost_business',
        -- Guest CRM
        'guest_communications', 'guest_feedback', 'guest_loyalty_programs',
        'guest_documents', 'guest_notes', 'automated_messages',
        'reward_catalog', 'reward_redemptions',
        -- Financial
        'payments', 'invoices', 'invoice_items', 'folios', 'charge_postings',
        'refunds', 'tax_configurations', 'charge_codes',
        'cashier_sessions', 'accounts_receivable', 'credit_limits',
        -- Operations
        'services', 'housekeeping_tasks', 'maintenance_requests',
        'lost_and_found', 'incident_reports',
        -- Command center
        'command_templates', 'command_routes', 'command_features',
        'transactional_outbox', 'command_idempotency',
        -- Channels
        'channel_mappings', 'ota_configurations',
        -- Analytics
        'audit_logs', 'night_audit_log', 'performance_reports',
        -- Availability
        'inventory_locks_shadow'
    ];
    v_tbl TEXT;
    v_missing TEXT[] := '{}';
BEGIN
    FOREACH v_tbl IN ARRAY v_critical_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema IN ('public', 'availability') AND table_name = v_tbl
        ) THEN
            v_missing := array_append(v_missing, v_tbl);
        END IF;
    END LOOP;

    IF array_length(v_missing, 1) IS NULL OR array_length(v_missing, 1) = 0 THEN
        RAISE NOTICE '  ✓ All % critical tables present', array_length(v_critical_tables, 1);
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ Missing critical tables: %', array_to_string(v_missing, ', ');
        v_fail := v_fail + 1;
    END IF;
END;

-- ── Key column checks on reservations ──
DECLARE
    v_res_cols TEXT[] := ARRAY[
        'reservation_type', 'eta', 'company_id', 'travel_agent_id',
        'quoted_at', 'quote_expires_at', 'expired_at', 'group_booking_id'
    ];
    v_col TEXT;
    v_missing_cols TEXT[] := '{}';
BEGIN
    FOREACH v_col IN ARRAY v_res_cols
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = v_col
        ) THEN
            v_missing_cols := array_append(v_missing_cols, v_col);
        END IF;
    END LOOP;

    IF array_length(v_missing_cols, 1) IS NULL OR array_length(v_missing_cols, 1) = 0 THEN
        RAISE NOTICE '  ✓ reservations table has all 8 industry-standard columns';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reservations missing columns: %', array_to_string(v_missing_cols, ', ');
        v_fail := v_fail + 1;
    END IF;
END;

-- ── Key column checks on rates (early/late fees) ──
DECLARE
    v_rate_cols TEXT[] := ARRAY[
        'early_checkin_fee', 'late_checkout_fee',
        'early_checkin_cutoff_hour', 'late_checkout_cutoff_hour'
    ];
    v_col TEXT;
    v_missing_cols TEXT[] := '{}';
BEGIN
    FOREACH v_col IN ARRAY v_rate_cols
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'rates' AND column_name = v_col
        ) THEN
            v_missing_cols := array_append(v_missing_cols, v_col);
        END IF;
    END LOOP;

    IF array_length(v_missing_cols, 1) IS NULL OR array_length(v_missing_cols, 1) = 0 THEN
        RAISE NOTICE '  ✓ rates table has early/late fee columns';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ rates missing columns: %', array_to_string(v_missing_cols, ', ');
        v_fail := v_fail + 1;
    END IF;
END;

-- ── Key column checks on reward_catalog ──
DECLARE
    v_reward_cols TEXT[] := ARRAY[
        'reward_code', 'reward_name', 'reward_category', 'points_required',
        'is_active', 'min_tier', 'fulfillment_type', 'tenant_id'
    ];
    v_col TEXT;
    v_missing_cols TEXT[] := '{}';
BEGIN
    FOREACH v_col IN ARRAY v_reward_cols
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'reward_catalog' AND column_name = v_col
        ) THEN
            v_missing_cols := array_append(v_missing_cols, v_col);
        END IF;
    END LOOP;

    IF array_length(v_missing_cols, 1) IS NULL OR array_length(v_missing_cols, 1) = 0 THEN
        RAISE NOTICE '  ✓ reward_catalog has all key columns';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reward_catalog missing columns: %', array_to_string(v_missing_cols, ', ');
        v_fail := v_fail + 1;
    END IF;
END;

-- ── Key column checks on reward_redemptions ──
DECLARE
    v_redeem_cols TEXT[] := ARRAY[
        'redemption_code', 'points_spent', 'redemption_status',
        'reward_id', 'guest_id', 'program_id', 'tenant_id'
    ];
    v_col TEXT;
    v_missing_cols TEXT[] := '{}';
BEGIN
    FOREACH v_col IN ARRAY v_redeem_cols
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'reward_redemptions' AND column_name = v_col
        ) THEN
            v_missing_cols := array_append(v_missing_cols, v_col);
        END IF;
    END LOOP;

    IF array_length(v_missing_cols, 1) IS NULL OR array_length(v_missing_cols, 1) = 0 THEN
        RAISE NOTICE '  ✓ reward_redemptions has all key columns';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ reward_redemptions missing columns: %', array_to_string(v_missing_cols, ', ');
        v_fail := v_fail + 1;
    END IF;
END;


-- ═════════════════════════════════════════════════════════════
-- PHASE 4: INDEXES
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 4: INDEXES ═══';

SELECT COUNT(*) INTO v_count
FROM pg_indexes WHERE schemaname IN ('public', 'availability');

IF v_count >= C_MIN_INDEXES THEN
    RAISE NOTICE '  ✓ Total indexes: % (expected ≥ %)', v_count, C_MIN_INDEXES;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Total indexes: % (expected ≥ %)', v_count, C_MIN_INDEXES;
    v_fail := v_fail + 1;
END IF;

-- Spot-check key named indexes
DECLARE
    v_key_indexes TEXT[] := ARRAY[
        'idx_reservations_type',
        'idx_guests_tenant_email',
        'idx_reward_catalog_tenant_active',
        'idx_reward_redemptions_guest',
        'idx_reward_redemptions_status'
    ];
    v_idx TEXT;
    v_missing_idx TEXT[] := '{}';
BEGIN
    FOREACH v_idx IN ARRAY v_key_indexes
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname IN ('public', 'availability') AND indexname = v_idx
        ) THEN
            v_missing_idx := array_append(v_missing_idx, v_idx);
        END IF;
    END LOOP;

    IF array_length(v_missing_idx, 1) IS NULL OR array_length(v_missing_idx, 1) = 0 THEN
        RAISE NOTICE '  ✓ All % key named indexes present', array_length(v_key_indexes, 1);
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ Missing indexes: %', array_to_string(v_missing_idx, ', ');
        v_fail := v_fail + 1;
    END IF;
END;

-- idx_guests_tenant_email must be UNIQUE
IF EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'idx_guests_tenant_email' AND i.indisunique = true
) THEN
    RAISE NOTICE '  ✓ idx_guests_tenant_email is UNIQUE';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ idx_guests_tenant_email is NOT UNIQUE';
    v_fail := v_fail + 1;
END IF;

-- Check no unindexed foreign keys
DECLARE
    v_unindexed_fk INT;
BEGIN
    WITH fk_columns AS (
        SELECT con.conrelid AS table_oid, con.conkey AS col_nums
        FROM pg_constraint con
        JOIN pg_namespace nsp ON nsp.oid = con.connamespace
        WHERE con.contype = 'f' AND nsp.nspname IN ('public', 'availability')
    )
    SELECT COUNT(*) INTO v_unindexed_fk
    FROM fk_columns fk
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = fk.table_oid
          AND i.indisvalid AND i.indisready
          AND (i.indkey::int2[] @> fk.col_nums)
    );

    IF v_unindexed_fk = 0 THEN
        RAISE NOTICE '  ✓ All foreign keys have supporting indexes';
        v_pass := v_pass + 1;
    ELSE
        RAISE NOTICE '  ⊘ % foreign key(s) without dedicated index (auto-FK step may cover these)', v_unindexed_fk;
        v_warn := v_warn + 1;
    END IF;
END;


-- ═════════════════════════════════════════════════════════════
-- PHASE 5: FOREIGN KEY CONSTRAINTS
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 5: FOREIGN KEY CONSTRAINTS ═══';

SELECT COUNT(*) INTO v_count
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' AND table_schema IN ('public', 'availability');

IF v_count >= C_MIN_FOREIGN_KEYS THEN
    RAISE NOTICE '  ✓ Foreign keys: % (expected ≥ %)', v_count, C_MIN_FOREIGN_KEYS;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Foreign keys: % (expected ≥ %)', v_count, C_MIN_FOREIGN_KEYS;
    v_fail := v_fail + 1;
END IF;


-- ═════════════════════════════════════════════════════════════
-- PHASE 6: STORED PROCEDURES & FUNCTIONS
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 6: STORED PROCEDURES ═══';

SELECT COUNT(*) INTO v_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p');

IF v_count >= C_MIN_PROCEDURES THEN
    RAISE NOTICE '  ✓ Stored procedures/functions: % (expected ≥ %)', v_count, C_MIN_PROCEDURES;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Stored procedures/functions: % (expected ≥ %)', v_count, C_MIN_PROCEDURES;
    v_fail := v_fail + 1;
END IF;

-- Spot-check critical procedures
DECLARE
    v_key_procs TEXT[] := ARRAY[
        'track_reservation_status_change',
        'upsert_guest',
        'merge_duplicate_guests',
        'aggregate_daily_metrics',
        'generate_daily_performance_report',
        'get_active_alerts'
    ];
    v_proc TEXT;
    v_missing_procs TEXT[] := '{}';
BEGIN
    FOREACH v_proc IN ARRAY v_key_procs
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = v_proc
        ) THEN
            v_missing_procs := array_append(v_missing_procs, v_proc);
        END IF;
    END LOOP;

    IF array_length(v_missing_procs, 1) IS NULL OR array_length(v_missing_procs, 1) = 0 THEN
        RAISE NOTICE '  ✓ All % key procedures present', array_length(v_key_procs, 1);
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ Missing procedures: %', array_to_string(v_missing_procs, ', ');
        v_fail := v_fail + 1;
    END IF;
END;


-- ═════════════════════════════════════════════════════════════
-- PHASE 7: TRIGGERS
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 7: TRIGGERS ═══';

SELECT COUNT(*) INTO v_count
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'availability');

IF v_count >= C_MIN_TRIGGERS THEN
    RAISE NOTICE '  ✓ Triggers: % (expected ≥ %)', v_count, C_MIN_TRIGGERS;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Triggers: % (expected ≥ %)', v_count, C_MIN_TRIGGERS;
    v_fail := v_fail + 1;
END IF;

-- trg_reservation_status_history must exist
IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND trigger_name = 'trg_reservation_status_history'
) THEN
    RAISE NOTICE '  ✓ trg_reservation_status_history exists';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ trg_reservation_status_history MISSING';
    v_fail := v_fail + 1;
END IF;


-- ═════════════════════════════════════════════════════════════
-- PHASE 8: COMMAND CENTER (templates, routes, features)
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 8: COMMAND CENTER ═══';

-- Command templates count
SELECT COUNT(*) INTO v_count FROM command_templates;
IF v_count >= C_MIN_COMMAND_TEMPLATES THEN
    RAISE NOTICE '  ✓ Command templates: % (expected ≥ %)', v_count, C_MIN_COMMAND_TEMPLATES;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Command templates: % (expected ≥ %)', v_count, C_MIN_COMMAND_TEMPLATES;
    v_fail := v_fail + 1;
END IF;

-- Command routes should match templates
SELECT COUNT(*) INTO v_count FROM command_routes;
IF v_count >= C_MIN_COMMAND_TEMPLATES THEN
    RAISE NOTICE '  ✓ Command routes: % (expected ≥ %)', v_count, C_MIN_COMMAND_TEMPLATES;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Command routes: % (expected ≥ %)', v_count, C_MIN_COMMAND_TEMPLATES;
    v_fail := v_fail + 1;
END IF;

-- Spot-check key command template domains
DECLARE
    v_expected_domains TEXT[] := ARRAY[
        'reservation', 'billing', 'housekeeping', 'rooms',
        'guest', 'loyalty', 'metasearch', 'notification', 'operations'
    ];
    v_domain TEXT;
    v_domain_count INT;
    v_missing_domains TEXT[] := '{}';
BEGIN
    FOREACH v_domain IN ARRAY v_expected_domains
    LOOP
        SELECT COUNT(*) INTO v_domain_count
        FROM command_templates
        WHERE command_name LIKE v_domain || '.%';

        IF v_domain_count = 0 THEN
            v_missing_domains := array_append(v_missing_domains, v_domain);
        END IF;
    END LOOP;

    IF array_length(v_missing_domains, 1) IS NULL OR array_length(v_missing_domains, 1) = 0 THEN
        RAISE NOTICE '  ✓ All % command domains have templates', array_length(v_expected_domains, 1);
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ Missing command domains: %', array_to_string(v_missing_domains, ', ');
        v_fail := v_fail + 1;
    END IF;
END;

-- Spot-check specific new commands from CG PR
DECLARE
    v_cg_commands TEXT[] := ARRAY[
        'loyalty.points.earn',
        'loyalty.points.redeem',
        'loyalty.points.expire_sweep',
        'metasearch.config.create',
        'metasearch.config.update',
        'metasearch.click.record'
    ];
    v_cmd TEXT;
    v_missing_cmds TEXT[] := '{}';
BEGIN
    FOREACH v_cmd IN ARRAY v_cg_commands
    LOOP
        IF NOT EXISTS (SELECT 1 FROM command_templates WHERE command_name = v_cmd) THEN
            v_missing_cmds := array_append(v_missing_cmds, v_cmd);
        END IF;
    END LOOP;

    IF array_length(v_missing_cmds, 1) IS NULL OR array_length(v_missing_cmds, 1) = 0 THEN
        RAISE NOTICE '  ✓ All % CG command templates present (loyalty + metasearch)', array_length(v_cg_commands, 1);
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ Missing CG commands: %', array_to_string(v_missing_cmds, ', ');
        v_fail := v_fail + 1;
    END IF;
END;


-- ═════════════════════════════════════════════════════════════
-- PHASE 9: REFERENCE / SEED DATA
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 9: REFERENCE & SEED DATA ═══';

-- Charge codes
SELECT COUNT(*) INTO v_count FROM charge_codes;
IF v_count >= C_MIN_CHARGE_CODES THEN
    RAISE NOTICE '  ✓ Charge codes: % (expected ≥ %)', v_count, C_MIN_CHARGE_CODES;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Charge codes: % (expected ≥ %)', v_count, C_MIN_CHARGE_CODES;
    v_fail := v_fail + 1;
END IF;

-- Key charge codes
DECLARE
    v_key_codes TEXT[] := ARRAY['ROOM', 'EARLY_CHECKIN', 'LATE_CHECKOUT'];
    v_code TEXT;
    v_missing_codes TEXT[] := '{}';
BEGIN
    FOREACH v_code IN ARRAY v_key_codes
    LOOP
        IF NOT EXISTS (SELECT 1 FROM charge_codes WHERE code = v_code) THEN
            v_missing_codes := array_append(v_missing_codes, v_code);
        END IF;
    END LOOP;

    IF array_length(v_missing_codes, 1) IS NULL OR array_length(v_missing_codes, 1) = 0 THEN
        RAISE NOTICE '  ✓ Key charge codes present (ROOM, EARLY_CHECKIN, LATE_CHECKOUT)';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ Missing charge codes: %', array_to_string(v_missing_codes, ', ');
        v_fail := v_fail + 1;
    END IF;
END;

-- Payment methods
SELECT COUNT(*) INTO v_count FROM payment_methods;
IF v_count >= 25 THEN
    RAISE NOTICE '  ✓ Payment methods: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Payment methods: % (expected ≥ 25)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Rate types
SELECT COUNT(*) INTO v_count FROM rate_types;
IF v_count >= 15 THEN
    RAISE NOTICE '  ✓ Rate types: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Rate types: % (expected ≥ 15)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Departments
SELECT COUNT(*) INTO v_count FROM departments;
IF v_count >= 8 THEN
    RAISE NOTICE '  ✓ Departments: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Departments: % (expected ≥ 8)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Reason codes
SELECT COUNT(*) INTO v_count FROM reason_codes;
IF v_count >= 20 THEN
    RAISE NOTICE '  ✓ Reason codes: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Reason codes: % (expected ≥ 20)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Room status codes
SELECT COUNT(*) INTO v_count FROM room_status_codes;
IF v_count >= 10 THEN
    RAISE NOTICE '  ✓ Room status codes: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Room status codes: % (expected ≥ 10)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Room categories
SELECT COUNT(*) INTO v_count FROM room_categories;
IF v_count >= 8 THEN
    RAISE NOTICE '  ✓ Room categories: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Room categories: % (expected ≥ 8)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Company types
SELECT COUNT(*) INTO v_count FROM company_types;
IF v_count >= 14 THEN
    RAISE NOTICE '  ✓ Company types: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Company types: % (expected ≥ 14)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Group booking types
SELECT COUNT(*) INTO v_count FROM group_booking_types;
IF v_count >= 12 THEN
    RAISE NOTICE '  ✓ Group booking types: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Group booking types: % (expected ≥ 12)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Setting definitions
SELECT COUNT(*) INTO v_count FROM setting_definitions;
IF v_count >= 25 THEN
    RAISE NOTICE '  ✓ Setting definitions: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Setting definitions: % (expected ≥ 25)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Setting categories
SELECT COUNT(*) INTO v_count FROM setting_categories;
IF v_count >= 6 THEN
    RAISE NOTICE '  ✓ Setting categories: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Setting categories: % (expected ≥ 6)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Communication templates
SELECT COUNT(*) INTO v_count FROM communication_templates;
IF v_count >= 10 THEN
    RAISE NOTICE '  ✓ Communication templates: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Communication templates: % (expected ≥ 10)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Folio routing rules
SELECT COUNT(*) INTO v_count FROM folio_routing_rules;
IF v_count >= 5 THEN
    RAISE NOTICE '  ✓ Folio routing rules: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Folio routing rules: % (expected ≥ 5)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Property feature flags
SELECT COUNT(*) INTO v_count FROM property_feature_flags;
IF v_count >= 10 THEN
    RAISE NOTICE '  ✓ Property feature flags: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Property feature flags: % (expected ≥ 10)', v_count;
    v_fail := v_fail + 1;
END IF;


-- ═════════════════════════════════════════════════════════════
-- PHASE 10: OPERATIONAL SEED DATA (JSON seed)
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 10: OPERATIONAL SEED DATA ═══';

-- Tenant
SELECT COUNT(*) INTO v_count FROM tenants;
IF v_count >= 1 THEN
    RAISE NOTICE '  ✓ Tenants: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ No tenants seeded';
    v_fail := v_fail + 1;
END IF;

-- Default tenant is ACTIVE
IF EXISTS (SELECT 1 FROM tenants WHERE status = 'ACTIVE') THEN
    RAISE NOTICE '  ✓ Default tenant is ACTIVE';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ No ACTIVE tenant found';
    v_fail := v_fail + 1;
END IF;

-- Users
SELECT COUNT(*) INTO v_count FROM users;
IF v_count >= 1 THEN
    RAISE NOTICE '  ✓ Users: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ No users seeded';
    v_fail := v_fail + 1;
END IF;

-- setup.admin user
IF EXISTS (SELECT 1 FROM users WHERE username = 'setup.admin') THEN
    RAISE NOTICE '  ✓ setup.admin user exists';
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ setup.admin user MISSING';
    v_fail := v_fail + 1;
END IF;

-- User-tenant association
SELECT COUNT(*) INTO v_count FROM user_tenant_associations;
IF v_count >= 1 THEN
    RAISE NOTICE '  ✓ User-tenant associations: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ No user-tenant associations';
    v_fail := v_fail + 1;
END IF;

-- Properties
SELECT COUNT(*) INTO v_count FROM properties;
IF v_count >= 1 THEN
    RAISE NOTICE '  ✓ Properties: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ No properties seeded';
    v_fail := v_fail + 1;
END IF;

-- Room types
SELECT COUNT(*) INTO v_count FROM room_types;
IF v_count >= 1 THEN
    RAISE NOTICE '  ✓ Room types: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ No room types seeded';
    v_fail := v_fail + 1;
END IF;

-- Rooms
SELECT COUNT(*) INTO v_count FROM rooms;
IF v_count >= 1 THEN
    RAISE NOTICE '  ✓ Rooms: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ No rooms seeded';
    v_fail := v_fail + 1;
END IF;

-- Rates
SELECT COUNT(*) INTO v_count FROM rates;
IF v_count >= 1 THEN
    RAISE NOTICE '  ✓ Rates: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ No rates seeded';
    v_fail := v_fail + 1;
END IF;

-- Booking sources
SELECT COUNT(*) INTO v_count FROM booking_sources;
IF v_count >= 5 THEN
    RAISE NOTICE '  ✓ Booking sources: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Booking sources: % (expected ≥ 5)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Market segments
SELECT COUNT(*) INTO v_count FROM market_segments;
IF v_count >= 5 THEN
    RAISE NOTICE '  ✓ Market segments: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Market segments: % (expected ≥ 5)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Room amenity catalog
SELECT COUNT(*) INTO v_count FROM room_amenity_catalog;
IF v_count >= 5 THEN
    RAISE NOTICE '  ✓ Room amenity catalog: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Room amenity catalog: % (expected ≥ 5)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Services
SELECT COUNT(*) INTO v_count FROM services;
IF v_count >= 3 THEN
    RAISE NOTICE '  ✓ Services: %', v_count;
    v_pass := v_pass + 1;
ELSE
    RAISE WARNING '  ✗ Services: % (expected ≥ 3)', v_count;
    v_fail := v_fail + 1;
END IF;

-- Total seed records
DECLARE
    v_total_records BIGINT;
    v_populated_tables INT;
BEGIN
    SELECT COALESCE(SUM(n_tup_ins)::bigint, 0) INTO v_total_records
    FROM pg_stat_user_tables
    WHERE schemaname IN ('public', 'availability');

    SELECT COUNT(*) INTO v_populated_tables
    FROM pg_stat_user_tables
    WHERE schemaname IN ('public', 'availability') AND n_tup_ins > 0;

    IF v_total_records >= C_MIN_SEED_RECORDS THEN
        RAISE NOTICE '  ✓ Total records: % across % tables (expected ≥ %)', v_total_records, v_populated_tables, C_MIN_SEED_RECORDS;
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '  ✗ Total records: % across % tables (expected ≥ %)', v_total_records, v_populated_tables, C_MIN_SEED_RECORDS;
        v_fail := v_fail + 1;
    END IF;
END;


-- ═════════════════════════════════════════════════════════════
-- PHASE 11: DATABASE HEALTH
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '═══ PHASE 11: DATABASE HEALTH ═══';

-- Database size
SELECT pg_size_pretty(pg_database_size('tartware')) INTO v_val;
RAISE NOTICE '  ℹ Database size: %', v_val;

-- Multi-tenant coverage (tables with tenant_id)
DECLARE
    v_total_tables INT;
    v_tenant_tables INT;
    v_pct NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total_tables
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'availability') AND table_type = 'BASE TABLE';

    SELECT COUNT(DISTINCT t.table_name) INTO v_tenant_tables
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON c.table_schema = t.table_schema AND c.table_name = t.table_name
    WHERE t.table_schema IN ('public', 'availability')
      AND t.table_type = 'BASE TABLE'
      AND c.column_name = 'tenant_id';

    v_pct := ROUND((v_tenant_tables::numeric / NULLIF(v_total_tables, 0)) * 100, 1);
    RAISE NOTICE '  ℹ Multi-tenant coverage: %/% tables (%)', v_tenant_tables, v_total_tables, v_pct || '%';
END;

-- Soft-delete coverage (tables with is_deleted + deleted_at + deleted_by)
DECLARE
    v_total_tables INT;
    v_sd_tables INT;
    v_pct NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total_tables
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'availability') AND table_type = 'BASE TABLE';

    SELECT COUNT(*) INTO v_sd_tables
    FROM information_schema.tables t
    WHERE t.table_schema IN ('public', 'availability') AND t.table_type = 'BASE TABLE'
      AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name AND c.column_name = 'is_deleted')
      AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name AND c.column_name = 'deleted_at')
      AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name AND c.column_name = 'deleted_by');

    v_pct := ROUND((v_sd_tables::numeric / NULLIF(v_total_tables, 0)) * 100, 1);
    RAISE NOTICE '  ℹ Soft-delete coverage: %/% tables (%)', v_sd_tables, v_total_tables, v_pct || '%';
END;


-- ═════════════════════════════════════════════════════════════
-- FINAL REPORT
-- ═════════════════════════════════════════════════════════════
RAISE NOTICE '';
RAISE NOTICE '██████████████████████████████████████████████████████████████';
RAISE NOTICE '█  VERIFICATION REPORT                                      █';
RAISE NOTICE '██████████████████████████████████████████████████████████████';
RAISE NOTICE '';
RAISE NOTICE '  ✓ Passed:   %', v_pass;
RAISE NOTICE '  ✗ Failed:   %', v_fail;
RAISE NOTICE '  ⊘ Warnings: %', v_warn;
RAISE NOTICE '';

IF v_fail = 0 THEN
    RAISE NOTICE '  ✅ ALL CHECKS PASSED — database is ready for use';
ELSE
    RAISE WARNING '  ❌ % CHECK(S) FAILED — review warnings above', v_fail;
    RAISE EXCEPTION 'Post-setup verification failed with % error(s)', v_fail;
END IF;

RAISE NOTICE '';
RAISE NOTICE 'Report generated: %', NOW()::TEXT;
RAISE NOTICE '';

END $$;
